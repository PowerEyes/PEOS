import test from "node:test"; import assert from "node:assert/strict";
import { checkLink } from "../src/lib/link-check.ts";
test("internal links", () => {
  assert.equal(checkLink("/about"), null); assert.equal(checkLink("/"), null); assert.equal(checkLink("/product/x?a=1"), null);
  assert.match(checkLink("/nope"), /not a page/); assert.equal(checkLink("/my-guide", ["my-guide"]), null);
});
test("external and unsafe links", () => {
  assert.equal(checkLink("https://example.com/x"), null); assert.equal(checkLink("mailto:a@b.co"), null);
  assert.ok(checkLink("javascript:alert(1)")); assert.ok(checkLink("//evil.com")); assert.ok(checkLink("http://x.com")); assert.equal(checkLink(""), null);
});
