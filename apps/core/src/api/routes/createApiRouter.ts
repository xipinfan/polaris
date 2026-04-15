import express, { type NextFunction, type Request, type Response, type Router } from "express";
import type {
  CreateMockRuleInput,
  RequestFilters,
  RunRequestInput,
  SaveRequestInput,
  SetActiveMockGroupInput,
  UpdateMockRuleInput
} from "@polaris/shared-contracts";
import { MockService } from "../../modules/mock/mockService";
import { CertificateManager } from "../../modules/proxy/certificateManager";
import { ProxyService } from "../../modules/proxy/proxyService";
import { RequestService } from "../../modules/requests/requestService";
import { WhistleImportService } from "../../modules/whistle-import/whistleImportService";
import { getLanIpv4Address } from "../../shared/network";

export function createApiRouter(
  requestService: RequestService,
  mockService: MockService,
  proxyService: ProxyService,
  certificateManager: CertificateManager
): Router {
  const router = express.Router();
  const whistleImportService = new WhistleImportService(mockService);
  const readSettings = async () => ({
    ...(await proxyService.setCertificateInstalled(await certificateManager.isRootCertificateTrusted())),
    lanIp: getLanIpv4Address()
  });
  const withAsync =
    (handler: (req: Request, res: Response, next: NextFunction) => Promise<void> | void) =>
    (req: Request, res: Response, next: NextFunction) =>
      Promise.resolve(handler(req, res, next)).catch(next);

  router.get(
    "/health",
    withAsync(async (_req, res) => {
      const settings = await readSettings();
      res.json({
        data: {
          online: true,
          proxyPort: settings.localProxyPort,
          apiPort: settings.localApiPort,
          mcpPort: settings.mcpPort,
          proxyMode: settings.currentProxyMode,
          mcpEnabled: settings.mcpEnabled,
          certificateInstalled: settings.certificateInstalled,
          activeRequestCount: requestService.list().length
        }
      });
    })
  );

  router.get(
    "/bootstrap",
    withAsync(async (_req, res) => {
      const settings = await readSettings();
      res.json({
        data: {
          status: {
            online: true,
            proxyPort: settings.localProxyPort,
            apiPort: settings.localApiPort,
            mcpPort: settings.mcpPort,
            proxyMode: settings.currentProxyMode,
            mcpEnabled: settings.mcpEnabled,
            certificateInstalled: settings.certificateInstalled,
            activeRequestCount: requestService.list().length
          },
          settings,
          proxyRules: proxyService.listRules(),
          recentRequests: requestService.list().slice(0, 10),
          savedRequests: requestService.listSaved().slice(0, 10),
          mockRules: mockService.list().slice(0, 10)
        }
      });
    })
  );

  router.get("/requests", (req, res) => {
    const filters: RequestFilters = {
      keyword: typeof req.query.keyword === "string" ? req.query.keyword : undefined,
      method: typeof req.query.method === "string" ? req.query.method : undefined,
      host: typeof req.query.host === "string" ? req.query.host : undefined,
      statusCode: typeof req.query.statusCode === "string" ? Number(req.query.statusCode) : undefined,
      limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined
    };
    res.json({ data: requestService.list(filters) });
  });

  router.delete(
    "/requests",
    withAsync(async (_req, res) => {
      await requestService.clear();
      res.json({ data: { cleared: true } });
    })
  );

  router.get("/requests/:id", (req, res) => {
    const result = requestService.getById(req.params.id);
    if (!result) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    res.json({ data: result });
  });

  router.post(
    "/requests/:id/save",
    withAsync(async (req, res) => {
      res.json({
        data: await requestService.save({
          ...(req.body as SaveRequestInput),
          requestId: req.params.id
        })
      });
    })
  );

  router.post(
    "/requests/:id/replay",
    withAsync(async (req, res) => {
      res.json({ data: await requestService.replayRequest(req.params.id) });
    })
  );

  router.get("/saved-requests", (_req, res) => {
    res.json({ data: requestService.listSaved() });
  });

  router.post(
    "/saved-requests",
    withAsync(async (req, res) => {
      res.json({ data: await requestService.save(req.body as SaveRequestInput) });
    })
  );

  router.put(
    "/saved-requests/:id",
    withAsync(async (req, res) => {
      res.json({ data: await requestService.updateSaved(req.params.id, req.body as SaveRequestInput) });
    })
  );

  router.delete(
    "/saved-requests/:id",
    withAsync(async (req, res) => {
      await requestService.removeSaved(req.params.id);
      res.json({ data: { id: req.params.id } });
    })
  );

  router.post(
    "/saved-requests/:id/replay",
    withAsync(async (req, res) => {
      res.json({ data: await requestService.replayRequest(req.params.id) });
    })
  );

  router.get("/mock-rules", (_req, res) => {
    res.json({ data: mockService.list() });
  });

  router.post(
    "/mock-rules",
    withAsync(async (req, res) => {
      res.json({ data: await mockService.create(req.body as CreateMockRuleInput) });
    })
  );

  router.put(
    "/mock-rules/:id",
    withAsync(async (req, res) => {
      res.json({ data: await mockService.update(req.params.id, req.body as UpdateMockRuleInput) });
    })
  );

  router.delete(
    "/mock-rules/:id",
    withAsync(async (req, res) => {
      await mockService.remove(req.params.id);
      res.json({ data: { id: req.params.id } });
    })
  );

  router.post(
    "/mock-rules/:id/enable",
    withAsync(async (req, res) => {
      res.json({ data: await mockService.toggle(req.params.id, Boolean(req.body.enabled)) });
    })
  );

  router.get("/mock-groups/active", (_req, res) => {
    res.json({ data: { group: mockService.getActiveGroup() } });
  });

  router.post(
    "/mock-groups/active",
    withAsync(async (req, res) => {
      const { group } = req.body as SetActiveMockGroupInput;
      res.json({ data: { group: await mockService.setActiveGroup(group) } });
    })
  );

  router.get("/proxy-rules", (_req, res) => {
    res.json({ data: proxyService.listRules() });
  });

  router.post(
    "/proxy-rules/site",
    withAsync(async (req, res) => {
      res.json({ data: await proxyService.upsertSiteRule(req.body) });
    })
  );

  router.delete(
    "/proxy-rules/site/:host",
    withAsync(async (req, res) => {
      await proxyService.removeSiteRule(req.params.host);
      res.json({ data: { host: req.params.host } });
    })
  );

  router.post(
    "/proxy-mode",
    withAsync(async (req, res) => {
      res.json({ data: { mode: await proxyService.setMode(req.body.mode) } });
    })
  );

  router.get(
    "/whistle-import/scan",
    withAsync(async (_req, res) => {
      res.json({ data: await whistleImportService.scan() });
    })
  );

  router.post(
    "/whistle-import/execute",
    withAsync(async (req, res) => {
      res.json({ data: await whistleImportService.execute(req.body) });
    })
  );

  router.post(
    "/debug/run",
    withAsync(async (req, res) => {
      res.json({ data: await requestService.run(req.body as RunRequestInput) });
    })
  );

  router.get(
    "/settings",
    withAsync(async (_req, res) => {
      res.json({ data: await readSettings() });
    })
  );

  router.get("/proxy/pac", (_req, res) => {
    res.type("application/x-ns-proxy-autoconfig").send(proxyService.generatePacScript());
  });

  router.get(
    "/certificates/root-ca",
    withAsync(async (_req, res) => {
      res.setHeader("Content-Disposition", 'attachment; filename="polaris-root-ca.crt"');
      res.type("application/x-x509-ca-cert").send(await certificateManager.getRootCertificatePem());
    })
  );

  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = /not found/i.test(message) ? 404 : /invalid|required|missing/i.test(message) ? 400 : 500;
    res.status(status).json({ error: message });
  });

  return router;
}
