import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

function closeServer(server: http.Server | undefined): Promise<void> {
  if (!server) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to determine an available port")));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function proxyGet(
  proxyPort: number,
  targetUrl: string
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: proxyPort,
        method: "GET",
        path: targetUrl
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8")
          });
        });
      }
    );

    req.on("error", reject);
    req.end();
  });
}

test("core endpoints serve legacy MCP invoke and mobile certificate downloads", async () => {
  const tempHome = await mkdtemp(path.join(os.tmpdir(), "polaris-mcp-http-test-"));
  const ports = {
    proxy: await findAvailablePort(),
    api: await findAvailablePort(),
    mcp: await findAvailablePort()
  };
  const previousEnv = {
    POLARIS_HOME: process.env.POLARIS_HOME,
    POLARIS_PROXY_PORT: process.env.POLARIS_PROXY_PORT,
    POLARIS_API_PORT: process.env.POLARIS_API_PORT,
    POLARIS_MCP_PORT: process.env.POLARIS_MCP_PORT
  };

  process.env.POLARIS_HOME = tempHome;
  process.env.POLARIS_PROXY_PORT = String(ports.proxy);
  process.env.POLARIS_API_PORT = String(ports.api);
  process.env.POLARIS_MCP_PORT = String(ports.mcp);

  const { startServers } = await import("./server");
  const runtime = await startServers();

  try {
    const legacyResponse = await fetch(`http://127.0.0.1:${runtime.runtimeSettings.mcpPort}/invoke/get_service_health`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({})
    });

    assert.equal(legacyResponse.status, 200);
    assert.equal((await legacyResponse.json()).data.online, true);
    const portalResponse = await proxyGet(runtime.runtimeSettings.localProxyPort, "http://polaris.local/");

    assert.equal(portalResponse.statusCode, 200);
    assert.match(
      portalResponse.body,
      /http:\/\/polaris\.local\/certificates\/root-ca/
    );

    const certificateResponse = await proxyGet(
      runtime.runtimeSettings.localProxyPort,
      "http://polaris.local/certificates/root-ca"
    );

    assert.equal(certificateResponse.statusCode, 200);
    assert.equal(
      certificateResponse.headers["content-disposition"],
      'attachment; filename="polaris-root-ca.crt"'
    );
    assert.match(certificateResponse.body, /BEGIN CERTIFICATE/);
  } finally {
    process.env.POLARIS_HOME = previousEnv.POLARIS_HOME;
    process.env.POLARIS_PROXY_PORT = previousEnv.POLARIS_PROXY_PORT;
    process.env.POLARIS_API_PORT = previousEnv.POLARIS_API_PORT;
    process.env.POLARIS_MCP_PORT = previousEnv.POLARIS_MCP_PORT;

    await closeServer(runtime.proxyServer).catch(() => undefined);
    await closeServer(runtime.apiServer).catch(() => undefined);
    await closeServer(runtime.mcpHttpServer).catch(() => undefined);
    await runtime.streamableMcpServer.close().catch(() => undefined);
    await runtime.sseMcpServer.close().catch(() => undefined);
    await runtime.proxyEngine.closeMitmServer().catch(() => undefined);
    await runtime.storage.flush().catch(() => undefined);
    await rm(tempHome, { recursive: true, force: true }).catch(() => undefined);
  }
});
