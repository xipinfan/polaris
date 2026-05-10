import assert from "node:assert/strict";
import test from "node:test";
import { normalizeUpdateSavedRequestInput } from "./requestMutationInput";

test("normalizes headers and query patches to stored string maps", () => {
  const result = normalizeUpdateSavedRequestInput(
    {
      name: "updated",
      headers: {
        "x-count": 42,
        "x-enabled": true,
        "x-remove": null
      },
      query: {
        page: 1,
        debug: false,
        roles: ["admin", "tester"],
        empty: [],
        obsolete: null
      },
      tags: ["api"]
    },
    {
      headers: {
        "x-remove": "old",
        kept: "yes"
      },
      query: {
        obsolete: "old",
        kept: "yes"
      }
    }
  );

  assert.deepEqual(result, {
    name: "updated",
    headers: {
      kept: "yes",
      "x-count": "42",
      "x-enabled": "true"
    },
    query: {
      kept: "yes",
      page: "1",
      debug: "false",
      roles: "admin,tester",
      empty: ""
    },
    tags: ["api"]
  });
});

test("keeps null body as an explicit update value", () => {
  const result = normalizeUpdateSavedRequestInput({ body: null }, { headers: {}, query: {} });

  assert.deepEqual(result, { body: null });
});

test("rejects object header and query values with field paths", () => {
  assert.throws(
    () =>
      normalizeUpdateSavedRequestInput(
        {
          headers: {
            "x-meta": { env: "dev" } as never
          }
        },
        { headers: {}, query: {} }
      ),
    /headers\.x-meta/
  );

  assert.throws(
    () =>
      normalizeUpdateSavedRequestInput(
        {
          query: {
            filter: { status: "open" } as never
          }
        },
        { headers: {}, query: {} }
      ),
    /query\.filter/
  );
});

test("rejects object query array items with field paths", () => {
  assert.throws(
    () =>
      normalizeUpdateSavedRequestInput(
        {
          query: {
            bad: [{ env: "dev" } as never]
          }
        },
        { headers: {}, query: {} }
      ),
    /query\.bad\[0\]/
  );
});
