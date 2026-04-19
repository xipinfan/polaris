import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type {
  WhistleImportCandidate,
  WhistleMockImportCandidate,
  WhistleProxyImportCandidate,
} from "@polaris/shared-contracts";

const sharedPolarisHome = path.join(os.tmpdir(), `polaris-whistle-runtime-${process.pid}`);

function isMockCandidate(
  candidate: WhistleImportCandidate | undefined,
): candidate is WhistleMockImportCandidate {
  return candidate?.candidateType === "mock";
}

function isProxyCandidate(
  candidate: WhistleImportCandidate | undefined,
): candidate is WhistleProxyImportCandidate {
  return candidate?.candidateType === "proxy";
}

async function writeWhistleStorageFile(
  rootDir: string,
  storageName: "rules" | "values",
  index: number,
  fileName: string,
  content: string,
) {
  const encodedName = `${index}.${encodeURIComponent(fileName)}`;
  const filePath = path.join(rootDir, storageName, "files", encodedName);
  await writeFile(filePath, content, "utf8");
}

async function createWhistleFixture() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "polaris-whistle-import-"));
  const whistleDir = path.join(tempRoot, ".whistle");
  await mkdir(path.join(whistleDir, "rules", "files"), { recursive: true });
  await mkdir(path.join(whistleDir, "values", "files"), { recursive: true });
  await mkdir(path.join(whistleDir, "properties", "files"), { recursive: true });

  await writeWhistleStorageFile(whistleDir, "rules", 0, "\rMocks", "");
  await writeWhistleStorageFile(
    whistleDir,
    "rules",
    1,
    "orders-mock",
    "https://api.example.com/orders method://POST statusCode://201 resHeaders://{mockHeaders} resBody://{mockBody}",
  );
  await writeWhistleStorageFile(whistleDir, "rules", 2, "\rProxy", "");
  await writeWhistleStorageFile(
    whistleDir,
    "rules",
    3,
    "orders-proxy",
    "https://gateway.example.com proxy://http://127.0.0.1:3000",
  );
  await writeWhistleStorageFile(
    whistleDir,
    "rules",
    4,
    "unsupported-plugin",
    "https://plugin.example.com whistle.demo://enabled",
  );

  await writeWhistleStorageFile(whistleDir, "values", 0, "mockBody", '{"ok":true}');
  await writeWhistleStorageFile(whistleDir, "values", 1, "mockHeaders", '{"x-source":"whistle"}');

  await writeFile(
    path.join(whistleDir, "rules", "properties"),
    JSON.stringify({
      filesOrder: ["\rMocks", "orders-mock", "\rProxy", "orders-proxy", "unsupported-plugin"],
      selectedList: ["orders-mock", "orders-proxy", "unsupported-plugin"],
      defalutRules: "",
      disabledDefalutRules: true,
    }),
    "utf8",
  );
  await writeFile(path.join(whistleDir, "values", "properties"), JSON.stringify({ filesOrder: ["mockBody", "mockHeaders"] }), "utf8");
  await writeFile(path.join(whistleDir, "properties", "properties"), JSON.stringify({}), "utf8");

  return {
    tempRoot,
    whistleDir,
  };
}

async function withWhistleImportService(
  run: (context: {
    service: import("./whistleImportService").WhistleImportService;
    mockService: import("../mock/mockService").MockService;
    storage: import("../storage/storageAdapter").StorageAdapter;
    whistleDir: string;
  }) => Promise<void>,
) {
  const fixture = await createWhistleFixture();
  const previousEnv = {
    POLARIS_HOME: process.env.POLARIS_HOME,
    WHISTLE_PATH: process.env.WHISTLE_PATH,
  };

  process.env.POLARIS_HOME = sharedPolarisHome;
  process.env.WHISTLE_PATH = fixture.tempRoot;

  try {
    await rm(sharedPolarisHome, { recursive: true, force: true });
    const [{ StorageAdapter }, { ExtensionHost }, { MockService }, { WhistleImportService }] = await Promise.all([
      import("../storage/storageAdapter"),
      import("../extensions/extensionHost"),
      import("../mock/mockService"),
      import("./whistleImportService"),
    ]);
    const storage = new StorageAdapter();
    await storage.init();
    const mockService = new MockService(storage, new ExtensionHost());
    const service = new WhistleImportService(mockService);

    await run({
      service,
      mockService,
      storage,
      whistleDir: fixture.whistleDir,
    });

    await storage.flush();
  } finally {
    process.env.POLARIS_HOME = previousEnv.POLARIS_HOME;
    process.env.WHISTLE_PATH = previousEnv.WHISTLE_PATH;
    await rm(sharedPolarisHome, { recursive: true, force: true }).catch(() => undefined);
    await rm(fixture.tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

test("scan restores whistle groups and maps supported candidates", async () => {
  await withWhistleImportService(async ({ service, whistleDir }) => {
    const result = await service.scan();

    assert.equal(result.source.resolvedDir, whistleDir);
    assert.equal(result.source.autoDetected, true);
    assert.equal(result.source.groupCount, 2);
    assert.equal(result.source.enabledRuleFileCount, 3);
    assert.equal(result.groupSummaries.length, 2);
    assert.equal(result.groupSummaries[0]?.name, "Mocks");
    assert.equal(result.groupSummaries[1]?.name, "Proxy");
    assert.equal(result.candidates.length, 3);

    const mockCandidate = result.candidates.find((candidate) => candidate.candidateType === "mock");
    assert.ok(isMockCandidate(mockCandidate));
    assert.equal(mockCandidate.groupName, "Mocks");
    assert.equal(mockCandidate.enabled, true);
    assert.equal(mockCandidate.mockPayload.method, "POST");
    assert.equal(mockCandidate.mockPayload.name, "mockBody");
    assert.equal(mockCandidate.mockPayload.url, "https://api.example.com/orders");
    assert.deepEqual(mockCandidate.mockPayload.responseHeaders, { "x-source": "whistle" });
    assert.deepEqual(mockCandidate.mockPayload.responseBody, { ok: true });

    const proxyCandidate = result.candidates.find((candidate) => candidate.candidateType === "proxy");
    assert.ok(isProxyCandidate(proxyCandidate));
    assert.equal(proxyCandidate.groupName, "Proxy");
    assert.equal(proxyCandidate.proxyPayload.pattern, "gateway.example.com");
    assert.equal(proxyCandidate.proxyPayload.forwardMode, "rewriteTarget");
    assert.equal(proxyCandidate.proxyPayload.method, "ALL");
    assert.equal(proxyCandidate.proxyPayload.targetUrl, "http://127.0.0.1:3000");

    const unsupportedCandidate = result.candidates.find((candidate) => candidate.candidateType === "unsupported");
    assert.ok(unsupportedCandidate);
    assert.equal(unsupportedCandidate.skipReason, "unsupported_plugin_rule");
  });
});

test("execute duplicates conflicting mock and proxy imports instead of overwriting", async () => {
  await withWhistleImportService(async ({ service, mockService }) => {
    const scanResult = await service.scan();
    const mockCandidate = scanResult.candidates.find((candidate) => candidate.candidateType === "mock");
    const proxyCandidate = scanResult.candidates.find((candidate) => candidate.candidateType === "proxy");
    assert.ok(isMockCandidate(mockCandidate));
    assert.ok(isProxyCandidate(proxyCandidate));

    await mockService.create({
      ...mockCandidate.mockPayload,
      name: "mockBody",
      group: "Mocks",
    });

    const now = "2026-01-01T00:00:00.000Z";
    const existingProxyRule = {
      ...proxyCandidate.proxyPayload,
      id: "existing-proxy-rule",
      name: "orders-proxy",
      createdAt: now,
      updatedAt: now,
    };

    const result = await service.execute({
      mockRules: [mockCandidate.mockPayload],
      proxyGroups: [
        {
          id: "import-proxy-group",
          name: "Proxy",
          rules: [proxyCandidate.proxyPayload],
        },
      ],
      currentProxyGroups: [
        {
          id: "existing-proxy-group",
          name: "Proxy",
          rules: [existingProxyRule],
        },
      ],
      currentProxyActiveGroupId: "existing-proxy-group",
    });

    assert.equal(result.createdMockCount, 1);
    assert.equal(result.createdProxyCount, 1);
    assert.equal(result.createdGroupCount, 0);
    assert.equal(result.duplicatedCount, 2);
    assert.equal(result.skippedCount, 0);

    const createdMock = mockService.list().find((rule) => /mockBody \d+$/.test(rule.name));
    assert.ok(createdMock);

    assert.equal(result.nextProxyGroups.length, 1);
    assert.equal(result.nextProxyGroups[0]?.rules.length, 2);
    assert.ok(result.nextProxyGroups[0]?.rules.some((rule) => /orders-proxy \d+$/.test(rule.name)));
    assert.equal(result.nextProxyActiveGroupId, "existing-proxy-group");
  });
});

test("scan maps resBody-only rule without method as GET mock", async () => {
  await withWhistleImportService(async ({ service, whistleDir }) => {
    await writeWhistleStorageFile(
      whistleDir,
      "rules",
      5,
      "orders-get-infer",
      "https://api.example.com/orders resBody://{mockBody}",
    );

    const result = await service.scan();
    const candidate = result.candidates.find(
      (item) => item.candidateType === "mock" && item.sourceFileName === "orders-get-infer",
    );

    assert.ok(isMockCandidate(candidate));
    assert.equal(candidate.mockPayload.method, "GET");
    assert.equal(candidate.mockPayload.name, "mockBody");
  });
});

test("scan maps bare hostname as implicit host proxy", async () => {
  await withWhistleImportService(async ({ service, whistleDir }) => {
    await writeWhistleStorageFile(
      whistleDir,
      "rules",
      6,
      "bare-host-proxy",
      "a.com b.com",
    );

    const result = await service.scan();
    const candidate = result.candidates.find(
      (item) => item.candidateType === "proxy" && item.sourceFileName === "bare-host-proxy",
    );

    assert.ok(isProxyCandidate(candidate));
    assert.equal(candidate.proxyPayload.pattern, "a.com");
    assert.equal(candidate.proxyPayload.forwardMode, "rewriteHost");
    assert.equal(candidate.proxyPayload.rewriteHost, "b.com");
  });
});

test("scan maps IP:PORT as implicit host proxy", async () => {
  await withWhistleImportService(async ({ service, whistleDir }) => {
    await writeWhistleStorageFile(
      whistleDir,
      "rules",
      7,
      "bare-ip-port-proxy",
      "a.com 127.0.0.1:3000",
    );

    const result = await service.scan();
    const candidate = result.candidates.find(
      (item) => item.candidateType === "proxy" && item.sourceFileName === "bare-ip-port-proxy",
    );

    assert.ok(isProxyCandidate(candidate));
    assert.equal(candidate.proxyPayload.pattern, "a.com");
    assert.equal(candidate.proxyPayload.forwardMode, "rewriteHost");
    assert.equal(candidate.proxyPayload.rewriteHost, "127.0.0.1:3000");
  });
});

test("scan preserves defalutRules from properties", async () => {
  await withWhistleImportService(async ({ service, whistleDir }) => {
    await writeFile(
      path.join(whistleDir, "rules", "properties"),
      JSON.stringify({
        filesOrder: ["\rMocks", "orders-mock", "\rProxy", "orders-proxy", "unsupported-plugin"],
        selectedList: ["orders-mock", "orders-proxy", "unsupported-plugin"],
        defalutRules: "api.default.com default-target.com",
        disabledDefalutRules: false,
      }),
      "utf8",
    );

    const result = await service.scan();
    const candidate = result.candidates.find(
      (item) => item.sourceFileKind === "defaultRule" && item.candidateType === "proxy",
    );

    assert.ok(isProxyCandidate(candidate));
    assert.equal(candidate.groupName, "默认规则");
    assert.equal(candidate.proxyPayload.pattern, "api.default.com");
  });
});

test("proxy rules use ALL as method instead of GET", async () => {
  await withWhistleImportService(async ({ service }) => {
    const result = await service.scan();
    const proxyCandidates = result.candidates.filter(
      (item): item is WhistleProxyImportCandidate => item.candidateType === "proxy",
    );

    assert.ok(proxyCandidates.length > 0);
    proxyCandidates.forEach((candidate) => {
      assert.equal(candidate.proxyPayload.method, "ALL");
    });
  });
});
