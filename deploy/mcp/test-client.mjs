#!/usr/bin/env node
// ============================================================================
// test-client.mjs — drive reflight-mcp over stdio like a real MCP host would.
//
// Spawns the server, performs the MCP handshake, lists tools, then calls
// get_connection_info (reads creds FROM RENDER) and health (reaches the
// backend). Prints a PASS/FAIL summary and exits non-zero on failure.
//
//   RENDER_API_KEY=... node test-client.mjs
// ============================================================================
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const server = spawn(process.execPath, [path.join(here, "reflight-mcp.mjs")], {
  stdio: ["pipe", "pipe", "inherit"],
  env: process.env,
});

let buf = "";
const waiters = new Map();
server.stdout.setEncoding("utf8");
server.stdout.on("data", (c) => {
  buf += c;
  let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id && waiters.has(msg.id)) { waiters.get(msg.id)(msg); waiters.delete(msg.id); }
  }
});

let nextId = 1;
function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve) => {
    waiters.set(id, resolve);
    server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}
function notify(method, params) {
  server.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

function unwrap(res) {
  const txt = res?.result?.content?.[0]?.text;
  try { return JSON.parse(txt); } catch { return txt; }
}

const checks = [];
function check(name, cond, detail) { checks.push({ name, ok: !!cond, detail }); console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); }

try {
  const init = await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test-client", version: "1" } });
  check("initialize", init?.result?.serverInfo?.name === "reflight-mcp", init?.result?.serverInfo?.name);
  notify("notifications/initialized", {});

  const list = await rpc("tools/list", {});
  const names = (list?.result?.tools || []).map((t) => t.name);
  check("tools/list", names.includes("get_connection_info") && names.includes("health"), names.join(", "));

  const infoRes = await rpc("tools/call", { name: "get_connection_info", arguments: {} });
  const info = unwrap(infoRes);
  console.log("\n--- connection info read FROM RENDER ---\n" + JSON.stringify(info, null, 2) + "\n");
  check("read credentials from Render", info?.source === "render-api" && !!info?.baseUrl, info?.baseUrl);
  check("DATABASE_URL present in Render env", info?.hasDatabaseUrl === true);

  const healthRes = await rpc("tools/call", { name: "health", arguments: {} });
  const health = unwrap(healthRes);
  check("backend health 200/ok", health?.status === 200 && health?.body?.status === "ok", JSON.stringify(health?.body));

  const discRes = await rpc("tools/call", { name: "discover", arguments: {} });
  const disc = unwrap(discRes);
  check("public discover reachable", disc?.status === 200 && Array.isArray(disc?.body?.items), JSON.stringify(disc?.body));
} finally {
  server.kill();
}

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
