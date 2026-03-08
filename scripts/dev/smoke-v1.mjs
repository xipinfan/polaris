import { spawn } from "node:child_process";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const smokePorts = {
  proxy: 9100,
  api: 9101,
  mcp: 9102
};
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(url, timeoutMs = 15000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }
    } catch {
      await sleep(500);
    }
  }

  throw new Error(`Timeout waiting for ${url}`);
}

async function api(pathname, init) {
  const response = await fetch(`http://127.0.0.1:${smokePorts.api}${pathname}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed for ${pathname}`);
  }

  return payload.data;
}

async function main() {
  const tsxCli = path.join(rootDir, "apps/core/node_modules/tsx/dist/cli.mjs");
  const coreEnv = {
    ...process.env,
    POLARIS_PROXY_PORT: String(smokePorts.proxy),
    POLARIS_API_PORT: String(smokePorts.api),
    POLARIS_MCP_PORT: String(smokePorts.mcp)
  };
  const coreProcess = spawn(process.execPath, [tsxCli, "src/app/bootstrap.ts"], {
    cwd: path.join(rootDir, "apps/core"),
    stdio: "inherit",
    env: coreEnv
  });

  const cleanup = () => {
    if (!coreProcess.killed) {
      coreProcess.kill("SIGTERM");
    }
  };

  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  try {
    await waitFor(`http://127.0.0.1:${smokePorts.api}/api/health`);
    await waitFor(`http://127.0.0.1:${smokePorts.mcp}/tools`);

    const health = await api("/api/health");
    const mock = await api("/api/mock-rules", {
      method: "POST",
      body: JSON.stringify({
        name: "smoke-mock",
        method: "GET",
        url: "https://polaris.local/smoke",
        responseStatus: 200,
        responseHeaders: {
          "content-type": "application/json"
        },
        responseBody: {
          ok: true,
          source: "smoke-test"
        },
        enabled: true
      })
    });

    const run = await api("/api/debug/run", {
      method: "POST",
      body: JSON.stringify({
        method: "GET",
        url: "https://polaris.local/smoke"
      })
    });

    const saved = await api("/api/saved-requests", {
      method: "POST",
      body: JSON.stringify({
        name: "smoke-saved-request",
        method: "GET",
        url: "https://polaris.local/smoke",
        headers: {},
        query: {},
        body: null,
        tags: ["smoke"]
      })
    });

    const replay = await api(`/api/saved-requests/${saved.id}/replay`, {
      method: "POST"
    });

    const proxyMode = await api("/api/proxy-mode", {
      method: "POST",
      body: JSON.stringify({ mode: "rules" })
    });

    await api("/api/proxy-rules/site", {
      method: "POST",
      body: JSON.stringify({ host: "example.com", action: "proxy" })
    });

    const proxyRules = await api("/api/proxy-rules");
    const mcpTools = await (await fetch(`http://127.0.0.1:${smokePorts.mcp}/tools`)).json();
    const mcpResources = await (await fetch(`http://127.0.0.1:${smokePorts.mcp}/resources`)).json();
    const pacText = await (await fetch(`http://127.0.0.1:${smokePorts.api}/api/proxy/pac`)).text();

    const summary = {
      healthOnline: health.online,
      mockId: mock.id,
      runStatus: run.statusCode,
      replayStatus: replay.statusCode,
      proxyMode: proxyMode.mode,
      proxyRuleCount: proxyRules.length,
      mcpToolCount: mcpTools.data.length,
      mcpResourceCount: mcpResources.data.length,
      pacContainsExample: pacText.includes("example.com")
    };

    const checks = [
      summary.healthOnline === true,
      summary.runStatus === 200,
      summary.replayStatus === 200,
      summary.proxyMode === "rules",
      summary.proxyRuleCount >= 1,
      summary.mcpToolCount === 8,
      summary.mcpResourceCount === 5,
      summary.pacContainsExample === true
    ];

    if (checks.some((item) => !item)) {
      throw new Error(`Smoke test failed: ${JSON.stringify(summary)}`);
    }

    console.log("Smoke test passed");
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    cleanup();
    await sleep(800);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
