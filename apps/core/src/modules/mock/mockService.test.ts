import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const sharedHome = path.join(os.tmpdir(), `polaris-mock-service-test-${process.pid}`);

async function withMockService(
  run: (context: {
    mockService: import("./mockService").MockService;
    storage: import("../storage/storageAdapter").StorageAdapter;
  }) => Promise<void>
) {
  const previousHome = process.env.POLARIS_HOME;
  process.env.POLARIS_HOME = sharedHome;

  try {
    await rm(sharedHome, { recursive: true, force: true });
    const [{ StorageAdapter }, { ExtensionHost }, { MockService }] = await Promise.all([
      import("../storage/storageAdapter"),
      import("../extensions/extensionHost"),
      import("./mockService")
    ]);
    const storage = new StorageAdapter();
    await storage.init();
    const mockService = new MockService(storage, new ExtensionHost());
    await run({ mockService, storage });
    await storage.flush();
  } finally {
    process.env.POLARIS_HOME = previousHome;
  }
}

test("create respects explicit group null instead of falling back to active group", async () => {
  await withMockService(async ({ mockService }) => {
    await mockService.setActiveGroup("demo");

    const created = await mockService.create({
      name: "created without group",
      group: null,
      method: "GET",
      url: "https://polaris.local/create",
      responseStatus: 200,
      enabled: true
    });

    assert.equal(created.name, "created without group");
  });
});

test("update respects explicit group null and removes existing group prefix", async () => {
  await withMockService(async ({ mockService }) => {
    const created = await mockService.create({
      name: "[demo] grouped rule",
      method: "GET",
      url: "https://polaris.local/update",
      responseStatus: 200,
      enabled: true
    });

    const updated = await mockService.update(created.id, {
      name: "grouped rule",
      group: null,
      method: "GET",
      url: "https://polaris.local/update",
      responseStatus: 200,
      enabled: true
    });

    assert.equal(updated.name, "grouped rule");
  });
});
