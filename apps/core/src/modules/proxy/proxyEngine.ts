import http from "node:http";
import https from "node:https";
import net from "node:net";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, RequestOptions, ServerResponse } from "node:http";
import type { RequestRecord } from "@polaris/shared-types";
import { RequestService } from "../requests/requestService";

function collectBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => resolve(""));
  });
}

function normalizeHeaders(headers: IncomingMessage["headers"] | http.IncomingHttpHeaders): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).flatMap(([key, value]) => {
      if (!value) {
        return [];
      }

      return [[key, Array.isArray(value) ? value.join(",") : value]];
    })
  );
}

export class ProxyEngine {
  constructor(private readonly requestService: RequestService) {}

  createServer(port: number): http.Server {
    const server = http.createServer(async (req, res) => {
      await this.handleHttpRequest(req, res);
    });

    server.on("connect", (req, clientSocket, head) => {
      const [host, portValue] = (req.url ?? "").split(":");
      const targetSocket = net.connect(Number(portValue || 443), host, () => {
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        targetSocket.write(head);
        targetSocket.pipe(clientSocket);
        clientSocket.pipe(targetSocket);
      });
    });

    server.listen(port);
    return server;
  }

  private async handleHttpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!req.url || !req.headers.host) {
      res.writeHead(400).end("Invalid proxy request");
      return;
    }

    const absoluteUrl = req.url.startsWith("http") ? req.url : `http://${req.headers.host}${req.url}`;
    const targetUrl = new URL(absoluteUrl);
    const body = await collectBody(req);
    const startedAt = Date.now();
    const options: RequestOptions = {
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === "https:" ? 443 : 80),
      method: req.method,
      path: `${targetUrl.pathname}${targetUrl.search}`,
      headers: req.headers
    };

    const client = targetUrl.protocol === "https:" ? https : http;
    const proxyReq = client.request(options, async (proxyRes) => {
      const chunks: Buffer[] = [];
      proxyRes.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      proxyRes.on("end", async () => {
        const responseText = Buffer.concat(chunks).toString("utf8");
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        res.end(responseText);

        const record: RequestRecord = {
          id: randomUUID(),
          method: req.method ?? "GET",
          url: targetUrl.toString(),
          host: targetUrl.host,
          path: targetUrl.pathname,
          statusCode: proxyRes.statusCode ?? 0,
          duration: Date.now() - startedAt,
          requestHeaders: normalizeHeaders(req.headers),
          requestQuery: Object.fromEntries(targetUrl.searchParams.entries()),
          requestBody: body || null,
          responseHeaders: normalizeHeaders(proxyRes.headers),
          responseBody: responseText,
          createdAt: new Date().toISOString(),
          source: "proxy",
          secure: targetUrl.protocol === "https:"
        };

        await this.requestService.capture(record);
      });
    });

    proxyReq.on("error", (error) => {
      res.writeHead(502).end(error.message);
    });

    if (body) {
      proxyReq.write(body);
    }

    proxyReq.end();
  }
}
