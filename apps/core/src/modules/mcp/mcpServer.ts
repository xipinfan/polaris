import express, { type Express } from "express";
import type { RequestFilters, RunRequestInput, SaveRequestInput } from "@polaris/shared-contracts";
import { mcpResourceRegistry, mcpToolRegistry } from "@polaris/mcp-contracts";
import { MockService } from "../mock/mockService";
import { ProxyService } from "../proxy/proxyService";
import { RequestService } from "../requests/requestService";

export class MpcServer {
  constructor(
    private readonly requestService: RequestService,
    private readonly mockService: MockService,
    private readonly proxyService: ProxyService
  ) {}

  createApp(): Express {
    const app = express();
    app.use(express.json({ limit: "2mb" }));

    app.get("/tools", (_req, res) => {
      res.json({ data: mcpToolRegistry });
    });

    app.get("/resources", (_req, res) => {
      res.json({ data: mcpResourceRegistry });
    });

    app.post("/invoke/:tool", async (req, res) => {
      try {
        const tool = req.params.tool;
        switch (tool) {
          case "list_requests":
            res.json({ data: this.requestService.list(req.body as RequestFilters) });
            return;
          case "get_request_detail":
            res.json({ data: this.requestService.getById(req.body.id) });
            return;
          case "list_saved_requests":
            res.json({ data: this.requestService.listSaved() });
            return;
          case "get_saved_request_detail":
            res.json({ data: this.requestService.getSavedById(req.body.id) });
            return;
          case "save_request":
            res.json({ data: await this.requestService.save(req.body as SaveRequestInput) });
            return;
          case "replay_request":
            res.json({ data: await this.requestService.replayRequest(req.body.id) });
            return;
          case "create_mock_rule":
            res.json({ data: await this.mockService.create(req.body) });
            return;
          case "enable_mock_rule":
            res.json({ data: await this.mockService.toggle(req.body.id, req.body.enabled) });
            return;
          case "run_request":
            res.json({ data: await this.requestService.run(req.body as RunRequestInput) });
            return;
          case "list_proxy_rules":
            res.json({ data: this.proxyService.listRules() });
            return;
          case "get_proxy_mode":
            res.json({ data: this.proxyService.getMode() });
            return;
          default:
            res.status(404).json({ error: "Unknown tool" });
        }
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Unknown error" });
      }
    });

    app.get("/resource/:name", (req, res) => {
      const { name } = req.params;
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
          res.status(404).json({ error: "Unknown resource" });
      }
    });

    return app;
  }
}
