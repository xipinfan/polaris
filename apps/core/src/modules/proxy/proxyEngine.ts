import http from "node:http";
import https from "node:https";
import net from "node:net";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, RequestOptions, ServerResponse } from "node:http";
import { PassThrough, type Duplex, type Readable } from "node:stream";
import type { RequestRecord, RequestResolution } from "@polaris/shared-types";
import { normalizeBody } from "../../shared/normalizeBody";
import { getLanIpv4Address } from "../../shared/network";
import {
  normalizeCapturedBody,
  parseSearchParamsRecord,
} from "../../shared/requestParsing";
import { MockService } from "../mock/mockService";
import { ProxyService } from "./proxyService";
import { RequestService } from "../requests/requestService";
import { CertificateManager } from "./certificateManager";

const MAX_CAPTURE_BODY_SIZE = 2 * 1024 * 1024;

function collectBody(req: Readable, maxSize?: number): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let overflow = false;

    req.on("data", (chunk) => {
      if (overflow) {
        return;
      }

      const buffer = Buffer.from(chunk);
      size += buffer.length;
      if (typeof maxSize === "number" && size > maxSize) {
        overflow = true;
        chunks.length = 0;
        return;
      }

      chunks.push(buffer);
    });
    req.on("end", () => resolve(overflow ? Buffer.alloc(0) : Buffer.concat(chunks)));
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
  delete nextHeaders.connection;
  delete nextHeaders["keep-alive"];
  delete nextHeaders["transfer-encoding"];
  delete nextHeaders.upgrade;
  return nextHeaders;
}

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function joinUrlPaths(basePath: string, requestPath: string): string {
  const normalizedBase = basePath && basePath !== "/" ? basePath.replace(/\/+$/, "") : "";
  const normalizedRequest = requestPath.startsWith("/") ? requestPath : `/${requestPath}`;
  const joined = `${normalizedBase}${normalizedRequest}`;
  return joined || "/";
}

function mergeSearchParams(targetSearch: string, requestSearch: string): string {
  const targetQuery = targetSearch.replace(/^\?/, "");
  const requestQuery = requestSearch.replace(/^\?/, "");

  if (targetQuery && requestQuery) {
    return `?${targetQuery}&${requestQuery}`;
  }
  if (targetQuery) {
    return `?${targetQuery}`;
  }
  if (requestQuery) {
    return `?${requestQuery}`;
  }
  return "";
}

function createCorsHeaders(req: IncomingMessage): Record<string, string> {
  return {
    "access-control-allow-origin": getHeaderValue(req.headers.origin) ?? "*",
    "access-control-allow-credentials": "true"
  };
}

function isLoopbackHost(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase();
  return normalizedHostname === "127.0.0.1" || normalizedHostname === "localhost" || normalizedHostname === "::1";
}

function isSelfProxyHost(hostname: string, lanIp?: string): boolean {
  const normalizedHostname = hostname.toLowerCase();
  return (
    isLoopbackHost(normalizedHostname) ||
    normalizedHostname === "0.0.0.0" ||
    normalizedHostname === "polaris.local" ||
    (Boolean(lanIp) && normalizedHostname === lanIp)
  );
}

function isPolarisControlPlaneRequest(targetUrl: URL): boolean {
  return isLoopbackHost(targetUrl.hostname) && targetUrl.pathname.startsWith("/api/");
}

function isProxyLoopRequest(targetUrl: URL, proxyPort: number, lanIp?: string): boolean {
  const targetPort = Number(targetUrl.port || (targetUrl.protocol === "https:" ? 443 : 80));
  return targetPort === proxyPort && isSelfProxyHost(targetUrl.hostname, lanIp);
}

function buildPortalHtml(lanIp: string | undefined, apiPort: number, proxyPort: number): string {
  const apiHost = lanIp ?? "127.0.0.1";
  const certificateUrl = `http://${apiHost}:${apiPort}/api/certificates/root-ca`;
  const lanAddress = lanIp ?? "鏈娴嬪埌灞€鍩熺綉 IP锛岃纭褰撳墠鐢佃剳宸茬粡鎺ュ叆 Wi-Fi 鎴栨湁绾跨綉缁溿€?";

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Polaris 鎵嬫満浠ｇ悊瀹夎</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f7fb;
        --card: rgba(255, 255, 255, 0.96);
        --text: #101828;
        --muted: #667085;
        --line: rgba(208, 216, 227, 0.9);
        --accent: #3159c9;
        --accent-soft: rgba(49, 89, 201, 0.08);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top, rgba(49, 89, 201, 0.14), transparent 36%),
          linear-gradient(180deg, #f8fbff 0%, var(--bg) 100%);
        color: var(--text);
      }
      main {
        width: min(100%, 720px);
        margin: 0 auto;
        padding: 24px 16px 48px;
      }
      .card {
        display: grid;
        gap: 16px;
        padding: 20px;
        border: 1px solid var(--line);
        border-radius: 24px;
        background: var(--card);
        box-shadow: 0 20px 48px rgba(15, 23, 42, 0.08);
      }
      .eyebrow {
        display: inline-flex;
        width: fit-content;
        padding: 6px 10px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      h1, h2, h3, p { margin: 0; }
      h1 { font-size: 28px; line-height: 1.1; }
      h2 { font-size: 18px; line-height: 1.2; }
      h3 { font-size: 15px; line-height: 1.4; }
      p, li { color: var(--muted); line-height: 1.65; font-size: 15px; }
      .metrics {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .metric {
        padding: 14px 16px;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: #fff;
      }
      .metric span {
        display: block;
        color: var(--muted);
        font-size: 12px;
        margin-bottom: 8px;
      }
      .metric strong {
        display: block;
        font-size: 18px;
        line-height: 1.3;
        word-break: break-word;
      }
      ol {
        margin: 0;
        padding-left: 20px;
        display: grid;
        gap: 10px;
      }
      .tips, .platform-grid {
        display: grid;
        gap: 12px;
      }
      .platform-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .platform-card, .tips {
        padding: 14px 16px;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.88);
      }
      a.button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 48px;
        width: 100%;
        border-radius: 16px;
        text-decoration: none;
        background: var(--accent);
        color: #fff;
        font-weight: 700;
      }
      code {
        padding: 2px 6px;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.06);
        color: #0f172a;
      }
      @media (max-width: 560px) {
        .metrics { grid-template-columns: 1fr; }
        .platform-grid { grid-template-columns: 1fr; }
        h1 { font-size: 24px; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="card">
        <span class="eyebrow">Polaris Proxy</span>
        <h1>鎵嬫満 / 灞€鍩熺綉浠ｇ悊瀹夎鍚戝</h1>
        <p>褰撳墠椤甸潰鐢?Polaris 鏈湴浠ｇ悊鐩存帴杩斿洖銆傝纭繚鎵嬫満鍜岀數鑴戝浜庡悓涓€灞€鍩熺綉锛屽啀鎸変笅闈㈡楠ゅ畬鎴愪唬鐞嗛厤缃拰璇佷功瀹夎銆?/p>
        <div class="metrics">
          <div class="metric">
            <span>灞€鍩熺綉鍦板潃</span>
            <strong>${lanAddress}</strong>
          </div>
          <div class="metric">
            <span>浠ｇ悊绔彛</span>
            <strong>${proxyPort}</strong>
          </div>
        </div>
      </section>

      <section class="card" style="margin-top: 16px;">
        <h2>绗?1 姝ワ細鍏堣繛鎺?Polaris 浠ｇ悊</h2>
        <ol>
          <li>纭繚鎵嬫満涓庣數鑴戝湪鍚屼竴涓?Wi-Fi 缃戠粶涓嬨€?/li>
          <li>Android锛氳繘鍏ュ綋鍓?Wi-Fi 鐨勮鎯呴〉锛屽湪鈥滀唬鐞嗏€濋噷閫夋嫨鈥滄墜鍔ㄢ€濓紝鏈嶅姟鍣ㄥ～鍐?<code>${lanAddress}</code>锛岀鍙ｅ～鍐?<code>${proxyPort}</code>銆?/li>
          <li>iPhone / iPad锛氳繘鍏モ€滆缃?鈫?Wi-Fi 鈫?褰撳墠缃戠粶 鈫?閰嶇疆浠ｇ悊鈥濓紝閫夋嫨鈥滄墜鍔ㄢ€濓紝鏈嶅姟鍣ㄥ～鍐?<code>${lanAddress}</code>锛岀鍙ｅ～鍐?<code>${proxyPort}</code>銆?/li>
          <li>浠ｇ悊淇濆瓨鎴愬姛鍚庯紝鍐嶇户缁笅杞?Polaris 鏍硅瘉涔︺€?/li>
        </ol>
      </section>

      <section class="card" style="margin-top: 16px;">
        <h2>绗?2 姝ワ細涓嬭浇骞跺畨瑁?Polaris 鏍硅瘉涔?/h2>
        <p>浠ｇ悊鐢熸晥鍚庯紝鐐瑰嚮涓嬮潰鐨勬寜閽笅杞芥牴璇佷功銆傚鏋滄寜閽棤娉曟墦寮€锛屼篃鍙互鎵嬪姩璁块棶鏂囨湯鐨勮瘉涔︾洿閾俱€?/p>
        <a class="button" href="${certificateUrl}">涓嬭浇 Polaris Root CA</a>
        <p>璇佷功鐩撮摼锛?br /><code>${certificateUrl}</code></p>
        <div class="platform-grid">
          <section class="platform-card">
            <h3>Android 瀹夎璇存槑</h3>
            <ol>
              <li>涓嬭浇璇佷功鍚庯紝濡傛灉绯荤粺鑷姩寮瑰嚭瀹夎椤甸潰锛屾寜鎻愮ず缁х画瀹夎銆?/li>
              <li>鑻ユ湭鑷姩寮瑰嚭锛屽彲杩涘叆鈥滆缃?鈫?瀹夊叏 / 闅愮 鈫?瀹夎璇佷功 / 浠庡瓨鍌ㄨ澶囧畨瑁呰瘉涔︹€濓紝鎵嬪姩閫夋嫨涓嬭浇鐨勮瘉涔︽枃浠躲€?/li>
              <li>璇佷功鐢ㄩ€旇閫夋嫨鈥淰PN 鍜屽簲鐢ㄢ€濇垨绯荤粺鍏佽鐨勭瓑鏁堥€夐」銆?/li>
              <li>瀹夎瀹屾垚鍚庯紝閲嶆柊鎵撳紑闇€瑕佹姄鍖呯殑娴忚鍣ㄦ垨 App 鍐嶆祴璇?HTTPS 璇锋眰銆?/li>
            </ol>
          </section>
          <section class="platform-card">
            <h3>iPhone / iPad 瀹夎璇存槑</h3>
            <ol>
              <li>鍦?Safari 涓笅杞借瘉涔﹀悗锛岀郴缁熶細鎻愮ず鈥滃凡涓嬭浇鎻忚堪鏂囦欢鈥濄€?/li>
              <li>杩涘叆鈥滆缃?鈫?宸蹭笅杞芥弿杩版枃浠垛€濓紝鎴栨€滆缃?鈫?閫氱敤 鈫?VPN 涓庤澶囩鐞嗏€濓紝瀹夎 Polaris 鎻忚堪鏂囦欢銆?/li>
              <li>瀹夎瀹屾垚鍚庯紝鍐嶈繘鍏モ€滆缃?鈫?閫氱敤 鈫?鍏充簬鏈満 鈫?璇佷功淇′换璁剧疆鈥濄€?/li>
              <li>鎵惧埌 Polaris 鏍硅瘉涔﹀苟鎵嬪姩寮€鍚€滃畬鍏ㄤ俊浠烩€濓紝鍚﹀垯 HTTPS 鏃犳硶姝ｅ父瑙ｅ瘑銆?/li>
            </ol>
          </section>
        </div>
        <div class="tips">
          <h3>杩炴帴澶辫触鏃朵紭鍏堟鏌?/h3>
          <ol>
            <li>鎵嬫満鏄惁鍜岀數鑴戝湪鍚屼竴涓眬鍩熺綉銆?/li>
            <li>浠ｇ悊 IP 鍜岀鍙ｆ槸鍚﹀～鍐欐纭€?/li>
            <li>鐢佃剳闃茬伀澧欐槸鍚︽嫤鎴簡 Polaris 绔彛銆?/li>
            <li>瀹夎璇佷功鍚庢槸鍚︾湡鐨勫畬鎴愪簡淇′换姝ラ锛屽挨鍏舵槸 iPhone 鐨勨€滃畬鍏ㄤ俊浠烩€濄€?/li>
          </ol>
        </div>
      </section>
    </main>
  </body>
</html>`;
}

export class ProxyEngine {
  private mitmServer: https.Server | null = null;

  constructor(
    private readonly requestService: RequestService,
    private readonly mockService: MockService,
    private readonly certificateManager: CertificateManager,
    private readonly proxyService: ProxyService
  ) {}

  private buildResolution(partial: Omit<RequestResolution, "decidedAt">): RequestResolution {
    return {
      ...partial,
      decidedAt: new Date().toISOString()
    };
  }

  createServer(): http.Server {
    const server = http.createServer(async (req, res) => {
      await this.handleHttpRequest(req, res, "http:");
    });

    server.on("connect", async (req, clientSocket, head) => {
      await this.handleConnectRequest(req, clientSocket, head);
    });

    return server;
  }

  async closeMitmServer(): Promise<void> {
    const server = this.mitmServer;
    if (!server) {
      return;
    }

    this.mitmServer = null;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }

  private ensureMitmServer(): https.Server {
    if (this.mitmServer) {
      return this.mitmServer;
    }

    this.mitmServer = https.createServer(
      {
        SNICallback: (hostname, callback) => {
          void this.certificateManager
            .getSecureContext(hostname)
            .then((secureContext) => callback?.(null, secureContext))
            .catch((error) => callback?.(error));
        }
      },
      async (req, res) => {
        await this.handleHttpRequest(req, res, "https:");
      }
    );

    this.mitmServer.on("tlsClientError", () => {});
    this.mitmServer.on("clientError", () => {});
    return this.mitmServer;
  }

  private async handleConnectRequest(req: IncomingMessage, clientSocket: Duplex, head: Buffer): Promise<void> {
    const [host, portValue] = (req.url ?? "").split(":");
    const targetPort = Number(portValue || 443);
    const settings = this.proxyService.getSettings();
    const lanIp = settings.lanIp ?? getLanIpv4Address();

    if (!host || Number.isNaN(targetPort)) {
      clientSocket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
      return;
    }

    if (targetPort === settings.localProxyPort && isSelfProxyHost(host, lanIp)) {
      clientSocket.end("HTTP/1.1 508 Loop Detected\r\n\r\n");
      return;
    }

    try {
      await this.certificateManager.getSecureContext(host);
      clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) {
        clientSocket.unshift(head);
      }
      this.ensureMitmServer().emit("connection", clientSocket);
    } catch {
      this.createTunnel(clientSocket, head, host, targetPort);
    }
  }

  private createTunnel(clientSocket: Duplex, head: Buffer, host: string, port: number): void {
    const targetSocket = net.connect(port, host, () => {
      clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) {
        targetSocket.write(head);
      }
      targetSocket.pipe(clientSocket);
      clientSocket.pipe(targetSocket);
    });

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) {
        return;
      }
      cleanedUp = true;
      clientSocket.unpipe(targetSocket);
      targetSocket.unpipe(clientSocket);
      if (!clientSocket.destroyed) {
        clientSocket.destroy();
      }
      if (!targetSocket.destroyed) {
        targetSocket.destroy();
      }
    };

    targetSocket.on("error", cleanup);
    targetSocket.on("close", cleanup);
    clientSocket.on("error", cleanup);
    clientSocket.on("close", cleanup);
  }

  private async handleHttpRequest(req: IncomingMessage, res: ServerResponse, protocol: "http:" | "https:"): Promise<void> {
    const corsHeaders = createCorsHeaders(req);

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        ...corsHeaders,
        "access-control-allow-methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "access-control-allow-headers": getHeaderValue(req.headers["access-control-request-headers"]) ?? "*",
        "access-control-max-age": "86400"
      });
      res.end();
      return;
    }

    if (!req.url || !req.headers.host) {
      res.writeHead(400, corsHeaders).end("Invalid proxy request");
      return;
    }

    const absoluteUrl = req.url.startsWith("http") ? req.url : `${protocol}//${req.headers.host}${req.url}`;
    const targetUrl = new URL(absoluteUrl);
    const settings = this.proxyService.getSettings();
    const lanIp = settings.lanIp ?? getLanIpv4Address();

    if (isProxyLoopRequest(targetUrl, settings.localProxyPort, lanIp)) {
      res.writeHead(508, corsHeaders).end("Proxy loop detected");
      return;
    }

    if (targetUrl.hostname.toLowerCase() === "polaris.local") {
      res.writeHead(200, {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      });
      res.end(buildPortalHtml(lanIp, settings.localApiPort, settings.localProxyPort));
      return;
    }

    const shouldCapture = !isPolarisControlPlaneRequest(targetUrl);
    const requestBuffer = await collectBody(req);
    const requestHeaders = sanitizeProxyHeaders(req.headers);
    const normalizedRequestBody = normalizeCapturedBody(requestBuffer, requestHeaders);
    const startedAt = Date.now();
    const forwardDecision = this.proxyService.getForwardDecision(targetUrl.host);

    const mockRule = await this.mockService.match(req.method ?? "GET", targetUrl.toString(), normalizedRequestBody);
    if (mockRule) {
      await this.mockService.registerHit(mockRule.id);
      const mockResponseHeaders = {
        ...mockRule.responseHeaders,
        ...corsHeaders
      };
      res.writeHead(mockRule.responseStatus, mockResponseHeaders);
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
        requestBody: normalizedRequestBody,
        responseHeaders: mockResponseHeaders,
        responseBody: normalizeBody(mockRule.responseBody),
        createdAt: new Date().toISOString(),
        source: "proxy",
        secure: targetUrl.protocol === "https:",
        resolution: this.buildResolution({
          mode: "mock",
          source: "mock_engine",
          matchedRuleId: mockRule.id,
          matchedRuleName: mockRule.name,
          target: `${targetUrl.protocol}//${targetUrl.host}`,
          reason: `Matched mock rule ${mockRule.name}`
        })
      };

      if (shouldCapture) {
        await this.requestService.capture(mockRecord);
      }
      return;
    }

    let finalProtocol = targetUrl.protocol;
    let finalHostname = targetUrl.hostname;
    let finalPort = targetUrl.port || (targetUrl.protocol === "https:" ? "443" : "80");
    let finalPathname = targetUrl.pathname;
    let finalSearch = targetUrl.search;

    if (forwardDecision.mode === "proxy_forward" && forwardDecision.forwardMode) {
      switch (forwardDecision.forwardMode) {
        case "rewriteTarget": {
          if (forwardDecision.targetUrl) {
            const rewrittenTarget = new URL(forwardDecision.targetUrl);
            finalProtocol = rewrittenTarget.protocol;
            finalHostname = rewrittenTarget.hostname;
            finalPort = rewrittenTarget.port || (rewrittenTarget.protocol === "https:" ? "443" : "80");
            finalPathname = joinUrlPaths(rewrittenTarget.pathname || "/", targetUrl.pathname);
            finalSearch = mergeSearchParams(rewrittenTarget.search, targetUrl.search);
          }
          break;
        }
        case "rewriteHost": {
          if (forwardDecision.rewriteHost) {
            const rewrittenHost = new URL(`http://${forwardDecision.rewriteHost}`);
            finalHostname = rewrittenHost.hostname;
            finalPort = rewrittenHost.port || finalPort;
          }
          break;
        }
        case "rewritePath": {
          if (forwardDecision.rewritePath) {
            finalPathname = forwardDecision.rewritePath.startsWith("/")
              ? forwardDecision.rewritePath
              : `/${forwardDecision.rewritePath}`;
          }
          break;
        }
        case "direct":
        default:
          break;
      }
    }

    const finalHost =
      (finalProtocol === "http:" && finalPort === "80") || (finalProtocol === "https:" && finalPort === "443")
        ? finalHostname
        : `${finalHostname}:${finalPort}`;
    const finalTargetUrl = `${finalProtocol}//${finalHost}${finalPathname}${finalSearch}`;
    requestHeaders.host = finalHost;

    const options: RequestOptions = {
      protocol: finalProtocol,
      hostname: finalHostname,
      port: finalPort,
      method: req.method,
      path: `${finalPathname}${finalSearch}`,
      headers: requestHeaders
    };

    const client = finalProtocol === "https:" ? https : http;
    const proxyReq = client.request(options, (proxyRes) => {
      const responseHeaders = {
        ...normalizeHeaders(proxyRes.headers),
        ...corsHeaders
      };
      res.writeHead(proxyRes.statusCode ?? 502, responseHeaders);

      if (!shouldCapture) {
        proxyRes.pipe(res);
      } else {
        const captureStream = new PassThrough();
        const capturePromise = collectBody(captureStream, MAX_CAPTURE_BODY_SIZE);
        proxyRes.pipe(res);
        proxyRes.pipe(captureStream);
        proxyRes.on("end", () => {
          void capturePromise
            .then((responseBuffer) => {
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
                requestBody: normalizedRequestBody,
                responseHeaders,
                responseBody: normalizeCapturedBody(responseBuffer, responseHeaders),
                createdAt: new Date().toISOString(),
                source: "proxy",
                secure: targetUrl.protocol === "https:",
                resolution: this.buildResolution({
                  mode:
                    forwardDecision.source === "proxy_rules" && forwardDecision.mode === "proxy_forward"
                      ? "proxy_forward"
                      : "direct",
                  source: forwardDecision.source,
                  matchedRuleId: forwardDecision.matchedRuleId ?? null,
                  matchedRuleName: forwardDecision.matchedRuleName ?? null,
                  target: finalTargetUrl,
                  reason: forwardDecision.reason
                })
              };
              return this.requestService.capture(record);
            })
            .catch(() => {});
        });
      }

      proxyRes.on("error", () => {
        res.destroy();
      });
    });

    req.on("close", () => {
      proxyReq.destroy();
    });

    proxyReq.on("error", (error) => {
      proxyReq.destroy();
      if (!res.headersSent) {
        res.writeHead(502, corsHeaders).end(error.message);
        return;
      }
      res.destroy();
    });

    if (requestBuffer.length) {
      proxyReq.write(requestBuffer);
    }

    proxyReq.end();
  }
}
