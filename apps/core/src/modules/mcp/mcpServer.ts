import express, { type Express, type Request } from "express";
import type {
  RequestFilters,
  RunRequestInput,
  SaveRequestInput,
  SetActiveMockGroupInput,
  UpdateMockRuleInput
} from "@polaris/shared-contracts";
import {
  getMcpResourceRegistryByPackId,
  getMcpToolRegistryByPackId,
  mcpPackRegistry,
  resolveMcpPackId
} from "@polaris/mcp-contracts";
import { MockService } from "../mock/mockService";
import { CertificateManager } from "../proxy/certificateManager";
import { ProxyService } from "../proxy/proxyService";
import { RequestService } from "../requests/requestService";
import { toLegacyErrorResponse, unknownPackError, unknownResourceError, unknownToolError } from "./errorHandling";

function getInstallGuideForPlatform(certificatePath?: string) {
  if (process.platform === "win32") {
    return {
      platform: "win32",
      steps: [
        `Download or locate the Polaris root certificate${certificatePath ? ` (${certificatePath})` : ""}.`,
        "In Edge, open edge://certificate-manager/ (or Settings -> Privacy, search, and services -> Security -> Manage certificates).",
        "In Chrome, open chrome://settings/certificates and click Manage certificates.",
        "Import the certificate into Current User -> Trusted Root Certification Authorities.",
        "Confirm the subject Polaris Development Root CA exists in Trusted Root Certification Authorities.",
        "Optional PowerShell check: Get-ChildItem Cert:\\CurrentUser\\Root | Where-Object { $_.Subject -like '*Polaris Development Root CA*' }",
        "Restart Edge/Chrome and verify certificate trust status again from Polaris."
      ]
    };
  }

  if (process.platform === "darwin") {
    return {
      platform: "darwin",
      steps: [
        `Open Keychain Access and import the certificate${certificatePath ? ` at ${certificatePath}` : ""}.`,
        "Add it to the System keychain.",
        "Set trust to Always Trust for SSL."
      ]
    };
  }

  return {
    platform: process.platform,
    steps: [
      `Import the certificate${certificatePath ? ` from ${certificatePath}` : ""} into your OS/browser trust store.`,
      "Trust the certificate authority for HTTPS interception.",
      "Restart browsers/apps that should use the local proxy."
    ]
  };
}

export class MpcServer {
  constructor(
    private readonly requestService: RequestService,
    private readonly mockService: MockService,
    private readonly proxyService: ProxyService,
    private readonly certificateManager?: CertificateManager
  ) {}

  private resolvePackId(req: Request): string | undefined {
    const packFromQuery = typeof req.query?.pack === "string" ? req.query.pack : undefined;
    const packFromHeader = typeof req.headers["x-polaris-mcp-pack"] === "string" ? req.headers["x-polaris-mcp-pack"] : undefined;
    return resolveMcpPackId(packFromQuery ?? packFromHeader);
  }

  private assertToolAllowed(toolName: string, packId?: string): void {
    if (!packId) {
      return;
    }
    const allowed = new Set(getMcpToolRegistryByPackId(packId).map((tool) => tool.name));
    if (!allowed.has(toolName)) {
      throw unknownToolError(toolName);
    }
  }

  createApp(): Express {
    const app = express();
    app.use(express.json({ limit: "2mb" }));

    app.get("/packs", (_req, res) => {
      res.json({
        data: mcpPackRegistry.map((pack) => ({
          ...pack,
          toolsCount: pack.toolNames.length,
          resourcesCount: pack.resourceNames.length
        }))
      });
    });

    app.get("/packs/:pack/tools", (req, res) => {
      const packId = resolveMcpPackId(req.params.pack);
      if (!packId) {
        const response = toLegacyErrorResponse(unknownPackError(req.params.pack));
        res.status(response.status).json({ error: response.error });
        return;
      }
      res.json({ data: getMcpToolRegistryByPackId(packId) });
    });

    app.get("/tools", (req, res) => {
      const packId = this.resolvePackId(req);
      if (req.query.pack && !packId) {
        const response = toLegacyErrorResponse(unknownPackError(String(req.query.pack)));
        res.status(response.status).json({ error: response.error });
        return;
      }
      res.json({ data: getMcpToolRegistryByPackId(packId) });
    });

    app.get("/resources", (req, res) => {
      const packId = this.resolvePackId(req);
      if (req.query.pack && !packId) {
        const response = toLegacyErrorResponse(unknownPackError(String(req.query.pack)));
        res.status(response.status).json({ error: response.error });
        return;
      }
      res.json({ data: getMcpResourceRegistryByPackId(packId) });
    });

    app.post("/invoke/:tool", async (req, res) => {
      try {
        const tool = req.params.tool;
        const packId = this.resolvePackId(req);
        this.assertToolAllowed(tool, packId);
        switch (tool) {
          case "list_requests":
            {
              const filters = req.body as RequestFilters & { offset?: number };
              const { offset, limit, ...rawFilters } = filters;
              const records = this.requestService.list(rawFilters);
              const start = offset ?? 0;
              const sliced = records.slice(start);
              res.json({ data: typeof limit === "number" ? sliced.slice(0, limit) : sliced });
            }
            return;
          case "get_request_detail":
            {
              const request = this.requestService.getById(req.body.id);
              if (!request) {
                throw new Error("Request not found");
              }
              res.json({ data: request });
            }
            return;
          case "list_saved_requests":
            {
              const limit = typeof req.body.limit === "number" ? req.body.limit : undefined;
              const offset = typeof req.body.offset === "number" ? req.body.offset : 0;
              const saved = this.requestService.listSaved().slice(offset);
              res.json({ data: typeof limit === "number" ? saved.slice(0, limit) : saved });
            }
            return;
          case "get_saved_request_detail":
            {
              const savedRequest = this.requestService.getSavedById(req.body.id);
              if (!savedRequest) {
                throw new Error("Saved request not found");
              }
              res.json({ data: savedRequest });
            }
            return;
          case "save_request":
            res.json({ data: await this.requestService.save(req.body as SaveRequestInput) });
            return;
          case "update_saved_request":
            res.json({ data: await this.requestService.updateSaved(req.body.id, req.body as SaveRequestInput) });
            return;
          case "delete_saved_request":
            await this.requestService.removeSaved(req.body.id);
            res.json({ data: { id: req.body.id } });
            return;
          case "replay_request":
            res.json({ data: await this.requestService.replayRequest(req.body.id) });
            return;
          case "clear_requests":
            await this.requestService.clear();
            res.json({ data: { cleared: true } });
            return;
          case "list_mock_rules":
            {
              const limit = typeof req.body.limit === "number" ? req.body.limit : undefined;
              const offset = typeof req.body.offset === "number" ? req.body.offset : 0;
              const filtered = this.mockService.list().filter((rule) => {
                const nameMatch = !req.body.name || rule.name.includes(req.body.name);
                const methodMatch = !req.body.method || rule.method === String(req.body.method).toUpperCase();
                const urlMatch = !req.body.url || rule.url.includes(req.body.url);
                const enabledMatch = typeof req.body.enabled !== "boolean" || rule.enabled === req.body.enabled;
                return nameMatch && methodMatch && urlMatch && enabledMatch;
              });
              const sliced = filtered.slice(offset);
              res.json({ data: typeof limit === "number" ? sliced.slice(0, limit) : sliced });
            }
            return;
          case "get_mock_rule_detail":
            {
              const mockRule = this.mockService.list().find((item) => item.id === req.body.id);
              if (!mockRule) {
                throw new Error("Mock rule not found");
              }
              res.json({ data: mockRule });
            }
            return;
          case "create_mock_rule":
            res.json({ data: await this.mockService.create(req.body) });
            return;
          case "update_mock_rule":
            res.json({ data: await this.mockService.update(req.body.id, req.body as UpdateMockRuleInput) });
            return;
          case "delete_mock_rule":
            await this.mockService.remove(req.body.id);
            res.json({ data: { id: req.body.id } });
            return;
          case "enable_mock_rule":
            {
              if (req.body.id) {
                res.json({ data: await this.mockService.toggle(req.body.id, req.body.enabled) });
                return;
              }
              const matched = this.mockService.list().filter((rule) => rule.name === req.body.name);
              if (matched.length === 0) {
                throw new Error("Mock rule not found");
              }
              if (matched.length > 1) {
                throw new Error("Multiple mock rules matched this name, please use id");
              }
              res.json({ data: await this.mockService.toggle(matched[0].id, req.body.enabled) });
            }
            return;
          case "get_active_mock_group":
            res.json({ data: { group: this.mockService.getActiveGroup() } });
            return;
          case "set_active_mock_group":
            res.json({ data: { group: await this.mockService.setActiveGroup((req.body as SetActiveMockGroupInput).group) } });
            return;
          case "run_request":
            res.json({ data: await this.requestService.run(req.body as RunRequestInput) });
            return;
          case "list_proxy_rules":
            {
              const limit = typeof req.body.limit === "number" ? req.body.limit : undefined;
              const offset = typeof req.body.offset === "number" ? req.body.offset : 0;
              const filtered = this.proxyService.listRules().filter((rule) => {
                const hostMatch = !req.body.host || rule.pattern.includes(req.body.host);
                const enabledMatch = typeof req.body.enabled !== "boolean" || rule.enabled === req.body.enabled;
                const actionMatch = !req.body.action || rule.action === req.body.action;
                return hostMatch && enabledMatch && actionMatch;
              });
              const sliced = filtered.slice(offset);
              res.json({ data: typeof limit === "number" ? sliced.slice(0, limit) : sliced });
            }
            return;
          case "get_proxy_mode":
            res.json({ data: this.proxyService.getMode() });
            return;
          case "set_proxy_mode":
            res.json({ data: { mode: await this.proxyService.setMode(req.body.mode) } });
            return;
          case "upsert_proxy_rule":
            res.json({ data: await this.proxyService.upsertSiteRule(req.body.host, req.body.action) });
            return;
          case "remove_proxy_rule":
            await this.proxyService.removeSiteRule(req.body.host);
            res.json({ data: { host: req.body.host } });
            return;
          case "get_proxy_decision":
            {
              const host = req.body.host ?? (req.body.url ? new URL(req.body.url).host : undefined);
              if (!host) {
                throw new Error("Host or url is required");
              }
              const forwardDecision = this.proxyService.getForwardDecision(host);
              res.json({
                data: {
                  host,
                  mode: this.proxyService.getMode(),
                  decision: forwardDecision.mode === "proxy_forward" ? "proxy" : "direct",
                  routeMode: forwardDecision.mode,
                  source: forwardDecision.source,
                  matchedRuleId: forwardDecision.matchedRuleId ?? null,
                  matchedRuleName: forwardDecision.matchedRuleName ?? null,
                  reason: forwardDecision.reason
                }
              });
            }
            return;
          case "get_service_health":
            res.json({
              data: {
                online: true,
                activeRequestCount: this.requestService.list({ limit: 200 }).length,
                settings: this.proxyService.getSettings()
              }
            });
            return;
          case "get_runtime_settings":
            res.json({ data: this.proxyService.getSettings() });
            return;
          case "get_certificate_status":
            res.json({
              data: {
                available: Boolean(this.certificateManager),
                trusted: this.certificateManager ? await this.certificateManager.isRootCertificateTrusted() : undefined
              }
            });
            return;
          case "get_certificate_install_guide":
            {
              const certificatePath = this.certificateManager?.getRootCertificatePath();
              res.json({
                data: {
                  ...getInstallGuideForPlatform(certificatePath),
                  certificatePath: certificatePath ?? null
                }
              });
            }
            return;
          case "verify_https_interception_ready":
            {
              const settings = this.proxyService.getSettings();
              const certificateTrusted = this.certificateManager
                ? await this.certificateManager.isRootCertificateTrusted()
                : settings.certificateInstalled;
              const proxyModeReady = settings.currentProxyMode === "rules" || settings.currentProxyMode === "global";
              const checks = {
                certificateTrusted,
                mcpEnabled: settings.mcpEnabled,
                proxyModeReady,
                localProxyPortValid: Number.isInteger(settings.localProxyPort) && settings.localProxyPort > 0
              };
              res.json({ data: { ready: Object.values(checks).every(Boolean), checks } });
            }
            return;
          default:
            throw unknownToolError(tool);
        }
      } catch (error) {
        const response = toLegacyErrorResponse(error);
        res.status(response.status).json({ error: response.error });
      }
    });

    app.get("/resource/:name", (req, res) => {
      try {
        const { name } = req.params;
        const packId = this.resolvePackId(req);
        if (packId) {
          const allowedResources = new Set(getMcpResourceRegistryByPackId(packId).map((resource) => resource.name));
          if (!allowedResources.has(name)) {
            throw unknownResourceError(name);
          }
        }
        switch (name) {
          case "recent_requests":
            res.json({ data: this.requestService.list().slice(0, 20) });
            return;
          case "saved_requests":
            res.json({ data: this.requestService.listSaved() });
            return;
          case "mock_rules":
            res.json({ data: this.mockService.list() });
            return;
          case "proxy_mode":
            res.json({ data: this.proxyService.getMode() });
            return;
          case "proxy_rules":
            res.json({ data: this.proxyService.listRules() });
            return;
          default:
            throw unknownResourceError(name);
        }
      } catch (error) {
        const response = toLegacyErrorResponse(error);
        res.status(response.status).json({ error: response.error });
      }
    });

    return app;
  }
}
