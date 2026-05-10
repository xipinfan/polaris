import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";
import path from "node:path";
import os from "node:os";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const require = createRequire(import.meta.url);

const coreNodeResolutionBase = path.join(rootDir, "apps/core");
const sdkClientIndexPath = require.resolve("@modelcontextprotocol/sdk/client/index.js", {
  paths: [coreNodeResolutionBase]
});
const sdkStreamableHttpPath = require.resolve("@modelcontextprotocol/sdk/client/streamableHttp.js", {
  paths: [coreNodeResolutionBase]
});
const sdkTypesPath = require.resolve("@modelcontextprotocol/sdk/types.js", {
  paths: [coreNodeResolutionBase]
});
const sdkStdioPath = require.resolve("@modelcontextprotocol/sdk/client/stdio.js", {
  paths: [coreNodeResolutionBase]
});

const { Client } = await import(pathToFileUrl(sdkClientIndexPath));
const { StreamableHTTPClientTransport } = await import(pathToFileUrl(sdkStreamableHttpPath));
const { StdioClientTransport } = await import(pathToFileUrl(sdkStdioPath));
const { McpError } = await import(pathToFileUrl(sdkTypesPath));

function pathToFileUrl(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  return `file:///${normalized}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function findAvailablePort() {
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

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function waitFor(url, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      await sleep(400);
    }
  }
  throw new Error(`Timeout waiting for ${url}`);
}

function getToolResult(callResult) {
  return callResult?.structuredContent?.result;
}

function parseResourceJson(resource) {
  return JSON.parse(resource.contents[0].text);
}

function assertShortText(callResult, maxChars = 160) {
  const text = callResult?.content?.[0]?.text ?? "";
  assert(text.length > 0 && text.length <= maxChars, `Expected short summary text, got length ${text.length}`);
}

function getItems(result) {
  return Array.isArray(result) ? result : result?.items;
}

async function postLegacy(baseUrl, tool, body) {
  const response = await fetch(`${baseUrl}/invoke/${tool}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {})
  });
  const payload = await response.json();
  return { response, payload };
}

async function callLegacyTool(baseUrl, tool, body) {
  const { response, payload } = await postLegacy(baseUrl, tool, body);
  assert(response.ok, `Legacy tool ${tool} failed: ${JSON.stringify(payload)}`);
  return {
    structuredContent: {
      result: payload.data
    },
    content: [{ type: "text", text: `legacy ${tool}` }]
  };
}

async function main() {
  const tsxCli = path.join(rootDir, "apps/core/node_modules/tsx/dist/cli.mjs");
  const smokeHome = path.join(os.tmpdir(), `polaris-mcp-selftest-${process.pid}`);

  await rm(smokeHome, { recursive: true, force: true });

  const ports = {
    proxy: await findAvailablePort(),
    api: await findAvailablePort(),
    mcp: await findAvailablePort()
  };

  const coreEnv = {
    ...process.env,
    POLARIS_HOME: smokeHome,
    POLARIS_PROXY_PORT: String(ports.proxy),
    POLARIS_API_PORT: String(ports.api),
    POLARIS_MCP_PORT: String(ports.mcp)
  };

  const coreProcess = spawn(process.execPath, [tsxCli, "src/app/bootstrap.ts"], {
    cwd: path.join(rootDir, "apps/core"),
    stdio: ["pipe", "inherit", "inherit"],
    env: coreEnv
  });

  const cleanup = async () => {
    if (!coreProcess.killed) {
      coreProcess.kill("SIGTERM");
    }
    await sleep(800);
    await rm(smokeHome, { recursive: true, force: true });
  };

  process.on("exit", () => {
    if (!coreProcess.killed) {
      coreProcess.kill("SIGTERM");
    }
  });

  const checks = [];
  let client;
  let transport;
  let stdioClient;
  let stdioTransport;

  try {
    await waitFor(`http://127.0.0.1:${ports.api}/api/health`);
    await waitFor(`http://127.0.0.1:${ports.mcp}/tools`);

    const mcpUrl = `http://127.0.0.1:${ports.mcp}/mcp`;
    const legacyUrl = `http://127.0.0.1:${ports.mcp}`;

    transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
    client = new Client({ name: "polaris-mcp-selftest", version: "0.1.0" });
    await client.connect(transport);

    const toolsList = await client.listTools();
    const toolNames = new Set(toolsList.tools.map((tool) => tool.name));
    const expectedTools = [
      "replay_request",
      "run_request",
      "clear_requests",
      "query_requests",
      "mutate_request",
      "query_mock",
      "mutate_mock",
      "test_mock_match",
      "query_proxy",
      "mutate_proxy",
      "get_workspace_snapshot",
      "setup_https"
    ];

    for (const tool of expectedTools) {
      assert(toolNames.has(tool), `Missing MCP tool: ${tool}`);
    }
    checks.push(`tools/list covers ${expectedTools.length} expected tools`);
    const legacyToolClient = {
      callTool: ({ name, arguments: args }) => callLegacyTool(legacyUrl, name, args)
    };

    const resourcesList = await client.listResources();
    const resourceUris = new Set(resourcesList.resources.map((resource) => resource.uri));
    const expectedResources = [
      "polaris://requests/recent",
      "polaris://requests/saved",
      "polaris://mock/rules",
      "polaris://proxy/mode",
      "polaris://proxy/rules"
    ];
    for (const uri of expectedResources) {
      assert(resourceUris.has(uri), `Missing MCP resource: ${uri}`);
      const resource = await client.readResource({ uri });
      assert(Array.isArray(resource.contents), `Resource ${uri} has invalid contents`);
    }
    const recentRequestsResource = await client.readResource({ uri: "polaris://requests/recent" });
    const recentRequestsJson = parseResourceJson(recentRequestsResource);
    assert(Array.isArray(recentRequestsJson), "recent_requests resource should be an array");
    if (recentRequestsJson[0]) {
      assert(!("requestBody" in recentRequestsJson[0]), "recent_requests resource must not return full request bodies");
    }
    checks.push("resources/list + resources/read passed");

    await legacyToolClient.callTool({ name: "clear_requests", arguments: {} });
    checks.push("clear_requests passed");

    const mockBase = {
      name: "[selftest] mock-A",
      method: "GET",
      url: "https://polaris.local/selftest",
      responseStatus: 200,
      responseHeaders: { "content-type": "application/json" },
      responseBody: { from: "mock-a" },
      enabled: true
    };

    const createMockACall = await legacyToolClient.callTool({
      name: "create_mock_rule",
      arguments: mockBase
    });
    assertShortText(createMockACall);
    const mockA = getToolResult(createMockACall);
    assert(mockA?.ok === true && mockA?.id, "create_mock_rule should return a receipt");
    checks.push("create_mock_rule passed");

    const runCall = await legacyToolClient.callTool({
      name: "run_request",
      arguments: {
        method: "GET",
        url: "https://polaris.local/selftest"
      }
    });
    assertShortText(runCall);
    const runResult = getToolResult(runCall);
    assert(runResult?.id && typeof runResult.statusCode === "number", "run_request should return a request summary");
    checks.push("run_request passed");

    const listRequestsResult = getToolResult(
      await legacyToolClient.callTool({
        name: "list_requests",
        arguments: { host: "polaris.local", limit: 10 }
      })
    );
    assert(Array.isArray(listRequestsResult) && listRequestsResult.length >= 1, "list_requests expected non-empty list");
    const requestId = listRequestsResult[0].id;
    checks.push("list_requests passed");

    const requestDetailSummary = getToolResult(
      await legacyToolClient.callTool({
        name: "get_request_detail",
        arguments: { id: requestId }
      })
    );
    assert(requestDetailSummary?.id === requestId, "get_request_detail summary mismatch");
    assert(!("requestBody" in requestDetailSummary), "default request detail should be summary-only");

    const requestDetailPreview = getToolResult(
      await legacyToolClient.callTool({
        name: "get_request_detail",
        arguments: { id: requestId, view: "preview", bodyPreviewChars: 32 }
      })
    );
    assert(typeof requestDetailPreview?.requestBodyPreview === "string", "preview should expose requestBodyPreview");

    const requestDetailFull = getToolResult(
      await legacyToolClient.callTool({
        name: "get_request_detail",
        arguments: { id: requestId, view: "full" }
      })
    );
    assert(requestDetailFull?.requestBody !== undefined, "full request detail should expose requestBody");
    checks.push("get_request_detail passed");

    const saveCall = await legacyToolClient.callTool({
      name: "save_request",
      arguments: {
        name: "selftest-saved",
        requestId
      }
    });
    assertShortText(saveCall);
    const saved = getToolResult(saveCall);
    assert(saved?.ok === true && saved?.id, "save_request failed");

    const savedId = saved.id;
    const updateSavedCall = await legacyToolClient.callTool({
      name: "update_saved_request",
      arguments: {
        id: savedId,
        name: "selftest-saved-updated",
        method: "GET",
        url: "https://polaris.local/selftest",
        headers: {},
        query: {},
        body: null,
        tags: ["selftest"]
      }
    });
    assertShortText(updateSavedCall);
    const updatedSaved = getToolResult(updateSavedCall);
    assert(updatedSaved?.ok === true && updatedSaved.changedFields.includes("name"), "update_saved_request failed");

    const savedList = getToolResult(await legacyToolClient.callTool({ name: "list_saved_requests", arguments: {} }));
    const savedItems = getItems(savedList);
    assert(Array.isArray(savedItems) && savedItems.some((item) => item.id === savedId), "list_saved_requests missing saved item");

    const savedDetail = getToolResult(
      await legacyToolClient.callTool({
        name: "get_saved_request_detail",
        arguments: { id: savedId }
      })
    );
    assert(savedDetail?.id === savedId, "get_saved_request_detail mismatch");
    assert(!("body" in savedDetail), "default saved request detail should be summary-only");

    const replayCall = await legacyToolClient.callTool({ name: "replay_request", arguments: { id: savedId } });
    assertShortText(replayCall);
    const replay = getToolResult(replayCall);
    assert(replay?.id && typeof replay.statusCode === "number", "replay_request should return a request summary");

    await legacyToolClient.callTool({ name: "delete_saved_request", arguments: { id: savedId } });
    checks.push("save/update/list/detail/replay/delete saved request flow passed");

    const mockListByName = getToolResult(
      await legacyToolClient.callTool({
        name: "list_mock_rules",
        arguments: { name: "[selftest]", limit: 20 }
      })
    );
    const mockItemsByName = getItems(mockListByName);
    assert(Array.isArray(mockItemsByName) && mockItemsByName.length >= 1, "list_mock_rules by name failed");

    const mockDetail = getToolResult(
      await legacyToolClient.callTool({
        name: "get_mock_rule_detail",
        arguments: { id: mockA.id }
      })
    );
    assert(mockDetail?.id === mockA.id, "get_mock_rule_detail mismatch");
    assert(!("responseBody" in mockDetail), "default mock detail should be summary-only");

    const createFromRequestReceipt = getToolResult(
      await legacyToolClient.callTool({
        name: "create_mock_rule",
        arguments: {
          name: "[selftest] mock-from-request",
          requestId: runResult.id,
          patch: {
            enabled: true
          }
        }
      })
    );
    assert(createFromRequestReceipt?.ok === true, "create_mock_rule requestId mode failed");

    const createFromTemplateReceipt = getToolResult(
      await legacyToolClient.callTool({
        name: "create_mock_rule",
        arguments: {
          name: "[selftest] mock-from-template",
          template: "json_ok",
          patch: {
            url: "https://polaris.local/template"
          }
        }
      })
    );
    assert(createFromTemplateReceipt?.ok === true, "create_mock_rule template mode failed");

    const createMockBCall = await legacyToolClient.callTool({
      name: "create_mock_rule",
      arguments: {
        ...mockBase,
        name: "[selftest] mock-B",
        enabled: false,
        responseStatus: 201,
        responseBody: { from: "mock-b" }
      }
    });
    assertShortText(createMockBCall);
    const mockB = getToolResult(createMockBCall);
    assert(mockB?.ok === true && mockB?.id, "second create_mock_rule failed");
    await legacyToolClient.callTool({ name: "enable_mock_rule", arguments: { id: mockB.id, enabled: true } });
    const sameEndpointRules = getToolResult(
      await legacyToolClient.callTool({
        name: "list_mock_rules",
        arguments: { url: "https://polaris.local/selftest", method: "GET" }
      })
    );
    const sameEndpointItems = getItems(sameEndpointRules);
    assert(Array.isArray(sameEndpointItems), "list_mock_rules endpoint result should contain items");
    const enabledRuleIds = sameEndpointItems.filter((rule) => rule.enabled).map((rule) => rule.id);
    assert(enabledRuleIds.includes(mockB.id), "enable_mock_rule should enable the target rule");

    const updateMockCall = await legacyToolClient.callTool({
      name: "update_mock_rule",
      arguments: {
        id: mockB.id,
        name: "[selftest] mock-B2",
        method: "GET",
        url: "https://polaris.local/selftest",
        responseStatus: 202,
        responseHeaders: { "content-type": "application/json" },
        responseBody: { from: "mock-b2" },
        enabled: true
      }
    });
    assertShortText(updateMockCall);
    const updatedMock = getToolResult(updateMockCall);
    assert(updatedMock?.ok === true && updatedMock.changedFields.includes("responseStatus"), "update_mock_rule failed");

    const patchUpdateReceipt = getToolResult(
      await legacyToolClient.callTool({
        name: "update_mock_rule",
        arguments: {
          id: mockB.id,
          patch: {
            enabled: true,
            method: "POST"
          }
        }
      })
    );
    assert(patchUpdateReceipt?.ok === true, "update_mock_rule patch mode failed");
    assert(patchUpdateReceipt.changedFields.includes("method"), "patch update should report method change");

    const operationsUpdateReceipt = getToolResult(
      await legacyToolClient.callTool({
        name: "update_mock_rule",
        arguments: {
          id: mockB.id,
          operations: [
            { op: "replace", path: "responseStatus", value: 204 },
            { op: "remove", path: "requestBodyExactMatch" }
          ]
        }
      })
    );
    assert(operationsUpdateReceipt?.ok === true, "update_mock_rule operations mode failed");

    const diagnosticDetail = getToolResult(
      await legacyToolClient.callTool({
        name: "get_mock_rule_detail",
        arguments: {
          id: mockB.id,
          view: "diagnostic",
          requestId: runResult.id
        }
      })
    );
    assert(diagnosticDetail?.diagnostic, "diagnostic detail should be returned");

    const activeGroup = getToolResult(await legacyToolClient.callTool({ name: "get_active_mock_group", arguments: {} }));
    assert(Object.prototype.hasOwnProperty.call(activeGroup, "group"), "get_active_mock_group missing group");

    const groupSet = getToolResult(
      await legacyToolClient.callTool({ name: "set_active_mock_group", arguments: { group: "selftest" } })
    );
    assert(groupSet?.group === "selftest", "set_active_mock_group failed");
    await legacyToolClient.callTool({ name: "set_active_mock_group", arguments: { group: null } });

    await legacyToolClient.callTool({ name: "delete_mock_rule", arguments: { id: mockA.id } });
    await legacyToolClient.callTool({ name: "delete_mock_rule", arguments: { id: createFromRequestReceipt.id } });
    await legacyToolClient.callTool({ name: "delete_mock_rule", arguments: { id: createFromTemplateReceipt.id } });
    await legacyToolClient.callTool({ name: "delete_mock_rule", arguments: { id: mockB.id } });
    checks.push("mock list/detail/create/enable/update/group/delete flow passed");

    const originalMode = getToolResult(await legacyToolClient.callTool({ name: "get_proxy_mode", arguments: {} })).mode;
    const modeSet = getToolResult(await legacyToolClient.callTool({ name: "set_proxy_mode", arguments: { mode: "rules" } }));
    assert(modeSet?.mode === "rules", "set_proxy_mode failed");

    const upsertedRule = getToolResult(
      await legacyToolClient.callTool({
        name: "upsert_proxy_rule",
        arguments: { host: "example.com", action: "proxy" }
      })
    );
    assert(upsertedRule?.ok === true && upsertedRule?.id, "upsert_proxy_rule failed");

    const proxyRules = getToolResult(await legacyToolClient.callTool({ name: "list_proxy_rules", arguments: {} }));
    assert(Array.isArray(proxyRules) && proxyRules.some((rule) => rule.pattern === "example.com"), "list_proxy_rules failed");

    await legacyToolClient.callTool({ name: "remove_proxy_rule", arguments: { host: "example.com" } });
    const proxyRulesAfterRemove = getToolResult(await legacyToolClient.callTool({ name: "list_proxy_rules", arguments: {} }));
    assert(!proxyRulesAfterRemove.some((rule) => rule.pattern === "example.com"), "remove_proxy_rule failed");

    await legacyToolClient.callTool({ name: "set_proxy_mode", arguments: { mode: originalMode } });
    checks.push("proxy get/set/upsert/list/remove flow passed");

    const decision = getToolResult(
      await legacyToolClient.callTool({
        name: "get_proxy_decision",
        arguments: { host: "example.com" }
      })
    );
    assert(typeof decision?.mode === "string", "get_proxy_decision failed");

    const serviceHealth = getToolResult(await legacyToolClient.callTool({ name: "get_service_health", arguments: {} }));
    assert(serviceHealth?.online === true, "get_service_health failed");

    const runtimeSettings = getToolResult(await legacyToolClient.callTool({ name: "get_runtime_settings", arguments: {} }));
    assert(runtimeSettings && typeof runtimeSettings === "object", "get_runtime_settings failed");

    const certStatus = getToolResult(await legacyToolClient.callTool({ name: "get_certificate_status", arguments: {} }));
    assert(certStatus && typeof certStatus.available === "boolean", "get_certificate_status failed");
    const installGuide = getToolResult(await legacyToolClient.callTool({ name: "get_certificate_install_guide", arguments: {} }));
    assert(installGuide && Array.isArray(installGuide.steps), "get_certificate_install_guide failed");

    const interceptionReady = getToolResult(
      await legacyToolClient.callTool({ name: "verify_https_interception_ready", arguments: {} })
    );
    assert(interceptionReady && typeof interceptionReady.ready === "boolean", "verify_https_interception_ready failed");
    checks.push("proxy decision + ops tools flow passed");

    let standardErrorValidated = false;
    try {
      const invalidCallResult = await client.callTool({
        name: "query_requests",
        arguments: { action: "detail", id: "missing-id-selftest" }
      });
      if (invalidCallResult?.isError === true) {
        standardErrorValidated = true;
      }
    } catch (error) {
      const maybeMcpLikeError =
        error instanceof McpError ||
        (error &&
          typeof error === "object" &&
          typeof error.code === "number" &&
          "message" in error);
      assert(maybeMcpLikeError, "Standard MCP returned non-MCP-shaped error");
      const data = error?.data;
      if (data && typeof data === "object") {
        assert(data.code === "NOT_FOUND", "MCP error code mismatch");
        assert(typeof data.message === "string", "MCP error message missing");
        assert(typeof data.retryable === "boolean", "MCP error retryable missing");
      }
      standardErrorValidated = true;
    }
    assert(standardErrorValidated, "Standard MCP error validation did not run");
    checks.push("standard MCP structured error validation passed");

    const legacyNotFound = await postLegacy(legacyUrl, "get_request_detail", { id: "missing-id-selftest" });
    assert(legacyNotFound.response.status === 404, "legacy get_request_detail expected 404");
    assert(legacyNotFound.payload?.error?.code === "NOT_FOUND", "legacy error code mismatch");
    assert(typeof legacyNotFound.payload?.error?.retryable === "boolean", "legacy retryable missing");

    const legacyUnknown = await postLegacy(legacyUrl, "not_real_tool", {});
    assert(legacyUnknown.response.status === 404, "legacy unknown tool expected 404");
    assert(legacyUnknown.payload?.error?.code === "UNKNOWN_TOOL", "legacy unknown tool code mismatch");
    checks.push("legacy structured error validation passed");

    const stdioHome = path.join(os.tmpdir(), `polaris-mcp-stdio-selftest-${process.pid}`);
    await rm(stdioHome, { recursive: true, force: true });
    stdioTransport = new StdioClientTransport({
      command: process.execPath,
      args: ["scripts/mcp-stdio.mjs"],
      cwd: rootDir,
      env: {
        ...process.env,
        POLARIS_HOME: stdioHome,
        POLARIS_MCP_START_PROXY: "false"
      },
      stderr: "pipe"
    });
    stdioClient = new Client({ name: "polaris-mcp-stdio-selftest", version: "0.1.0" });
    await stdioClient.connect(stdioTransport);

    const stdioTools = await stdioClient.listTools();
    const stdioToolNames = new Set(stdioTools.tools.map((tool) => tool.name));
    assert(stdioToolNames.has("query_requests"), "stdio MCP missing query_requests");
    assert(stdioToolNames.has("query_proxy"), "stdio MCP missing query_proxy");
    assert(stdioToolNames.has("mutate_proxy"), "stdio MCP missing mutate_proxy");

    const stdioListRequests = getToolResult(
      await stdioClient.callTool({ name: "query_requests", arguments: { action: "list", limit: 1 } })
    );
    assert(Array.isArray(getItems(stdioListRequests)), "stdio query_requests failed");

    const stdioMode = getToolResult(
      await stdioClient.callTool({ name: "query_proxy", arguments: { action: "mode" } })
    );
    assert(typeof stdioMode?.mode === "string", "stdio query_proxy mode failed");

    let stdioErrorOk = false;
    let stdioErrorResult;
    try {
      stdioErrorResult = await stdioClient.callTool({
        name: "query_requests",
        arguments: { action: "detail", id: "missing-id-selftest" }
      });
    } catch (error) {
      stdioErrorOk = error instanceof McpError || (error && typeof error === "object" && "message" in error);
    }
    if (!stdioErrorOk) {
      stdioErrorOk = stdioErrorResult?.isError === true;
    }
    assert(stdioErrorOk, "stdio MCP error path validation failed");
    checks.push("stdio MCP tools + call + error path validation passed");

    await stdioClient.close();
    stdioClient = undefined;
    await stdioTransport.close();
    stdioTransport = undefined;
    await rm(stdioHome, { recursive: true, force: true });

    const summary = {
      ports,
      passedChecks: checks.length,
      checks
    };

    console.log("MCP self-test passed");
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    try {
      await stdioClient?.close();
    } catch {}
    try {
      await stdioTransport?.close();
    } catch {}
    try {
      await client?.close();
    } catch {}
    try {
      await transport?.close();
    } catch {}
    await cleanup();
  }
}

main().catch((error) => {
  console.error("MCP self-test failed");
  console.error(error);
  process.exitCode = 1;
});
