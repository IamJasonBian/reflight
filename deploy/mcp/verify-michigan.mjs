#!/usr/bin/env node
// Drive reflight-mcp over stdio and call its `discover` tool, then print the
// NYC<->Michigan trips it returns. Proves the seed is visible via the MCP.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const server = spawn(process.execPath, [path.join(here, "reflight-mcp.mjs")], {
  stdio: ["pipe", "pipe", "inherit"], env: process.env,
});
let buf = ""; const waiters = new Map();
server.stdout.setEncoding("utf8");
server.stdout.on("data", (c) => {
  buf += c; let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
    if (!line) continue; const m = JSON.parse(line);
    if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); }
  }
});
let id = 1;
const rpc = (method, params) => new Promise((res) => {
  const i = id++; waiters.set(i, res);
  server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: i, method, params }) + "\n");
});
const unwrap = (r) => { try { return JSON.parse(r?.result?.content?.[0]?.text); } catch { return r?.result; } };

try {
  await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "verify", version: "1" } });
  server.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");
  const disc = unwrap(await rpc("tools/call", { name: "discover", arguments: {} }));
  const raw = disc?.body?.items ?? disc?.body ?? [];
  const items = raw.map((x) => x.trip ?? x); // discover wraps entries as {trip:{...}}
  const mi = items.filter((t) => String(t.id).startsWith("mi-"));
  console.log(`MCP discover -> HTTP ${disc?.status}, ${items.length} public trip(s), ${mi.length} NYC↔Michigan:\n`);
  for (const t of mi) {
    console.log(`  • ${t.title}  [origin ${t.originCode}]  start ${String(t.startDate).slice(0, 10)}`);
    for (const b of t.branches ?? []) {
      const route = (b.segments ?? []).map((s) => `${s.fromCode}→${s.toCode} ${s.flightNo}`).join("  ›  ");
      const total = (b.segments ?? []).reduce((s, x) => s + (x.price ?? 0), 0);
      console.log(`      ${b.label.padEnd(22)} ${route}   ($${total})`);
    }
    console.log("");
  }
} finally { server.kill(); }
