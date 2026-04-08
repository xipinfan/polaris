import assert from "node:assert/strict";
import test from "node:test";
import { getBodyPathValue, hasBodyKeyPath, parseExactBodyMatch } from "./mockMatchers";

test("parseExactBodyMatch returns null for invalid JSON literal instead of throwing", () => {
  assert.equal(parseExactBodyMatch("popType: \"bad\\uZZZZ\""), null);
});

test("empty or whitespace-only body key paths are rejected", () => {
  const body = { nested: { flag: "yes" } };

  assert.equal(hasBodyKeyPath(body, ""), false);
  assert.equal(hasBodyKeyPath(body, "   "), false);
  assert.deepEqual(getBodyPathValue(body, ""), { found: false });
  assert.deepEqual(getBodyPathValue(body, "   "), { found: false });
});
