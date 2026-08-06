import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const authSource = await readFile(new URL("../src/auth/AuthContext.jsx", import.meta.url), "utf8");

assert.equal(
  (appSource.match(/\/auth\/me/g) || []).length,
  0,
  "App.jsx must reuse AuthContext instead of calling /auth/me directly.",
);
assert.equal(
  (authSource.match(/\/auth\/me/g) || []).length,
  1,
  "AuthContext must own exactly one /auth/me request path.",
);
assert.match(authSource, /startupSessionPromise/, "AuthContext must retain a module-level single-flight promise.");
assert.doesNotMatch(appSource, /setInterval\([^)]*\/auth\/me/s, "Session verification must not run on an interval.");

console.log("Auth bootstrap single-flight checks passed.");

