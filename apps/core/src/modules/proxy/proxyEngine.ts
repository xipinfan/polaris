import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { Duplex } from "node:stream";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, RequestOptions, ServerResponse } from "node:http";
import type { RequestRecord } from "@polaris/shared-types";
import { normalizeBody } from "../../shared/normalizeBody";
import {
  normalizeCapturedBody,
  parseSearchParamsRecord,
} from "../../shared/requestParsing";
import { MockService } from "../mock/mockService";
import { RequestService } from "../requests/requestService";
import { CertificateManager } from "./certificateManager";

function collectBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", () => resolve(Buffer.alloc(0)));
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

function sanitizeProxyHeaders(headers: IncomingMessage["headers"]): Record<string, string> {
  const nextHeaders = normalizeHeaders(headers);
  delete nextHeaders["proxy-connection"];
  delete nextHeaders["proxy-authorization"];
  delete nextHeaders["connection"];
  delete nextHeaders["keep-alive"];
  delete nextHeaders["transfer-encoding"];
  delete nextHeaders["upgrade"];
  return nextHeaders;
}

export class ProxyEngine {
  constructor(
    private readonly requestService: RequestService,
    private readonly mockService: MockService,
    private readonly certificateManager: CertificateManager
  ) {}

  createServer(): http.Server {
    const server = http.createServer(async (req, res) => {
      await this.handleHttpRequest(req, res, "http:");
    });

    server.on("connect", async (req, clientSocket, head) => {
      await this.handleConnectRequest(req, clientSocket, head);
    });

    return server;
  }

  private async handleConnectRequest(req: IncomingMessage, clientSocket: Duplex, head: Buffer): Promise<void> {
    const [host, portValue] = (req.url ?? "").split(":");
    const targetPort = Number(portValue || 443);

    if (!host || Number.isNaN(targetPort)) {
      clientSocket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
      return;
    }

    try {
      const { key, cert } = await this.certificateManager.getServerCredentials(host);
      const mitmServer = https.createServer({ key, cert }, async (mitmReq, mitmRes) => {
        await this.handleHttpRequest(mitmReq, mitmRes, "https:");
      });

      mitmServer.on("tlsClientError", () => {
        clientSocket.destroy();
      });
      mitmServer.on("error", () => {
        clientSocket.destroy();
      });
      clientSocket.on("close", () => {
        mitmServer.close();
      });

      clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) {
        clientSocket.unshift(head);
      }
      mitmServer.emit("connection", clientSocket);
    } catch {
      this.createTunnel(clientSocket, head, host, targetPort);
    }
  }

  private createTunnel(clientSocket: Duplex, head: Buffer, host: string, port: number): void {
    const targetSocket = net.connect(port, host, () => {
      clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      targetSocket.write(head);
      targetSocket.pipe(clientSocket);
      clientSocket.pipe(targetSocket);
    });

    targetSocket.on("error", () => {
      clientSocket.destroy();
    });
    clientSocket.on("error", () => {
      targetSocket.destroy();
    });
  }

  private async handleHttpRequest(req: IncomingMessage, res: ServerResponse, protocol: "http:" | "https:"): Promise<void> {
    if (!req.url || !req.headers.host) {
      res.writeHead(400).end("Invalid proxy request");
      return;
    }

    const absoluteUrl = req.url.startsWith("http") ? req.url : `${protocol}//${req.headers.host}${req.url}`;
    const targetUrl = new URL(absoluteUrl);
    const requestBuffer = await collectBody(req);
    const requestHeaders = sanitizeProxyHeaders(req.headers);
    requestHeaders.host = targetUrl.host;
    const startedAt = Date.now();

    const mockRule = await this.mockService.match(req.method ?? "GET", targetUrl.toString());
    if (mockRule) {
      await this.mockService.registerHit(mockRule.id);
      res.writeHead(mockRule.responseStatus, mockRule.responseHeaders);
      res.end(typeof mockRule.responseBody === "string" ? mockRule.responseBody : JSON.stringify(mockRule.responseBody));

      const mockRecord: RequestRecord = {
        id: randomUUID(),
        method: req.method ?? "GET",
        url: targetUrl.toString(),
        host: targetUrl.host,
        path: targetUrl.pathname,
        statusCode: mockRule.responseStatus,
        duration: Date.now() - startedAt,
        requestHeaders,
        requestQuery: parseSearchParamsRecord(targetUrl.searchParams),
        requestBody: normalizeCapturedBody(requestBuffer, requestHeaders),
        responseHeaders: mockRule.responseHeaders,
        responseBody: normalizeBody(mockRule.responseBody),
        createdAt: new Date().toISOString(),
        source: "proxy",
        secure: targetUrl.protocol === "https:"
      };

      await this.requestService.capture(mockRecord);
      return;
    }

    const options: RequestOptions = {
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === "https:" ? 443 : 80),
      method: req.method,
      path: `${targetUrl.pathname}${targetUrl.search}`,
      headers: requestHeaders
    };

    const client = targetUrl.protocol === "https:" ? https : http;
    const proxyReq = client.request(options, async (proxyRes) => {
      const chunks: Buffer[] = [];
      proxyRes.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      proxyRes.on("end", async () => {
        const responseBuffer = Buffer.concat(chunks);
        const responseHeaders = normalizeHeaders(proxyRes.headers);
        const responseBody = normalizeCapturedBody(responseBuffer, responseHeaders);
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        res.end(responseBuffer);

        const record: RequestRecord = {
          id: randomUUID(),
          method: req.method ?? "GET",
          url: targetUrl.toString(),
          host: targetUrl.host,
          path: targetUrl.pathname,
          statusCode: proxyRes.statusCode ?? 0,
          duration: Date.now() - startedAt,
          requestHeaders,
          requestQuery: parseSearchParamsRecord(targetUrl.searchParams),
          requestBody: normalizeCapturedBody(requestBuffer, requestHeaders),
          responseHeaders,
          responseBody,
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

    if (requestBuffer.length) {
      proxyReq.write(requestBuffer);
    }

    proxyReq.end();
  }
}
