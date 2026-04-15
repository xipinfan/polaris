import assert from "node:assert/strict";
import test from "node:test";
import { buildProxyConfig, resolveProxySyncAction, shouldPollCore } from "./proxyState";

test("resolveProxySyncAction clears extension proxy control when core is offline", () => {
  assert.deepEqual(resolveProxySyncAction(null), { type: "clear" });
});

test("buildProxyConfig uses fixed servers for global mode", () => {
  assert.deepEqual(buildProxyConfig("global", 1080, 19601), {
    mode: "fixed_servers",
    rules: {
      singleProxy: {
        scheme: "http",
        host: "127.0.0.1",
        port: 1080
      },
      bypassList: ["<local>"]
    }
  });
});

test("buildProxyConfig uses PAC for rules mode", () => {
  assert.deepEqual(buildProxyConfig("rules", 1080, 19601), {
    mode: "pac_script",
    pacScript: {
      url: "http://127.0.0.1:19601/api/proxy/pac"
    }
  });
});

test("shouldPollCore polls while popup is open even when not connected", () => {
  assert.equal(shouldPollCore(true, false), true);
});

test("shouldPollCore keeps polling after popup closes when already connected", () => {
  assert.equal(shouldPollCore(false, true), true);
});

test("shouldPollCore stops polling when popup is closed and core is not connected", () => {
  assert.equal(shouldPollCore(false, false), false);
});
