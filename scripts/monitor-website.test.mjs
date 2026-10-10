import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { checkWebsite } from "./monitor-website.mjs";

test("availability checks reject error pages and successful responses with missing content", async () => {
  const server = createServer((req, res) => {
    res.statusCode = req.url === "/error" ? 503 : 200;
    res.end(req.url === "/missing" ? "Unexpected page" : "Expected content");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const results = await checkWebsite(`http://127.0.0.1:${server.address().port}`, [
      { path: "/ok", marker: "Expected content" },
      { path: "/missing", marker: "Expected content" },
      { path: "/error", marker: "Expected content" }
    ]);
    assert.deepEqual(results.map(({ ok }) => ok), [true, false, false]);
    assert.deepEqual(results.map(({ status }) => status), [200, 200, 503]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("network failures produce a failed result without exposing the error", async () => {
  assert.deepEqual(await checkWebsite("http://127.0.0.1:0", [{ path: "/", marker: "x" }]), [
    { path: "/", status: null, ok: false }
  ]);
});
