import express, { type Router } from "express";
import type {
  CreateMockRuleInput,
  RequestFilters,
  RunRequestInput,
  SaveRequestInput,
  UpdateMockRuleInput
} from "@polaris/shared-contracts";
import { MockService } from "../../modules/mock/mockService";
import { ProxyService } from "../../modules/proxy/proxyService";
import { RequestService } from "../../modules/requests/requestService";

export function createApiRouter(
  requestService: RequestService,
  mockService: MockService,
  proxyService: ProxyService
): Router {
  const router = express.Router();

  router.get("/health", (_req, res) => {
    const settings = proxyService.getSettings();
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
  });

  router.get("/bootstrap", (_req, res) => {
    const settings = proxyService.getSettings();
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
  });

  router.get("/requests", (req, res) => {
    const filters: RequestFilters = {
      keyword: typeof req.query.keyword === "string" ? req.query.keyword : undefined,
      method: typeof req.query.method === "string" ? req.query.method : undefined,
      host: typeof req.query.host === "string" ? req.query.host : undefined,
      statusCode: typeof req.query.statusCode === "string" ? Number(req.query.statusCode) : undefined
    };
    res.json({ data: requestService.list(filters) });
  });

  router.get("/requests/:id", (req, res) => {
    const result = requestService.getById(req.params.id);
    if (!result) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    res.json({ data: result });
  });

  router.post("/requests/:id/save", async (req, res) => {
    res.json({
      data: await requestService.save({
        ...(req.body as SaveRequestInput),
        requestId: req.params.id
      })
    });
  });

  router.post("/requests/:id/replay", async (req, res) => {
    res.json({ data: await requestService.replayRequest(req.params.id) });
  });

  router.get("/saved-requests", (_req, res) => {
    res.json({ data: requestService.listSaved() });
  });

  router.post("/saved-requests", async (req, res) => {
    res.json({ data: await requestService.save(req.body as SaveRequestInput) });
  });

  router.put("/saved-requests/:id", async (req, res) => {
    res.json({ data: await requestService.updateSaved(req.params.id, req.body as SaveRequestInput) });
  });

  router.delete("/saved-requests/:id", async (req, res) => {
    await requestService.removeSaved(req.params.id);
    res.json({ data: { id: req.params.id } });
  });

  router.post("/saved-requests/:id/replay", async (req, res) => {
    res.json({ data: await requestService.replayRequest(req.params.id) });
  });

  router.get("/mock-rules", (_req, res) => {
    res.json({ data: mockService.list() });
  });

  router.post("/mock-rules", async (req, res) => {
    res.json({ data: await mockService.create(req.body as CreateMockRuleInput) });
  });

  router.put("/mock-rules/:id", async (req, res) => {
    res.json({ data: await mockService.update(req.params.id, req.body as UpdateMockRuleInput) });
  });

  router.delete("/mock-rules/:id", async (req, res) => {
    await mockService.remove(req.params.id);
    res.json({ data: { id: req.params.id } });
  });

  router.post("/mock-rules/:id/enable", async (req, res) => {
    res.json({ data: await mockService.toggle(req.params.id, Boolean(req.body.enabled)) });
  });

  router.get("/proxy-rules", (_req, res) => {
    res.json({ data: proxyService.listRules() });
  });

  router.post("/proxy-rules/site", async (req, res) => {
    res.json({ data: await proxyService.upsertSiteRule(req.body.host, req.body.action) });
  });

  router.delete("/proxy-rules/site/:host", async (req, res) => {
    await proxyService.removeSiteRule(req.params.host);
    res.json({ data: { host: req.params.host } });
  });

  router.post("/proxy-mode", async (req, res) => {
    res.json({ data: { mode: await proxyService.setMode(req.body.mode) } });
  });

  router.post("/debug/run", async (req, res) => {
    res.json({ data: await requestService.run(req.body as RunRequestInput) });
  });

  router.get("/settings", (_req, res) => {
    res.json({ data: proxyService.getSettings() });
  });

  router.get("/proxy/pac", (_req, res) => {
    res.type("application/x-ns-proxy-autoconfig").send(proxyService.generatePacScript());
  });

  return router;
}
