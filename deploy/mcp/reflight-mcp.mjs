#!/usr/bin/env node
// ============================================================================
// reflight-mcp — a Model Context Protocol (stdio) server that lets any agent
// connect to the reflight backend deployed on Render.
//
// Design goal: credentials/config live IN RENDER, not hard-coded here. This
// server bootstraps from a single secret — RENDER_API_KEY — and reads the
// live service URL + environment (DATABASE_URL, Clerk keys, ...) straight from
// the Render API. Another agent only needs the Render key to discover how to
// connect; everything else is fetched at runtime.
//
// No npm dependencies — pure Node (>=18, uses global fetch) speaking JSON-RPC
// 2.0 over stdio, which is all MCP requires.
//
// Env:
//   RENDER_API_KEY     (required) Render API token — the only secret.
//   RENDER_SERVICE_ID  (optional) defaults to the reflight-backend service.
//   BASE_URL           (optional) skip Render lookup, talk to this URL directly.
//
// Tools exposed:
//   get_connection_info  -> read service URL + env config FROM RENDER
//   health               -> GET /api/healthz
//   discover             -> GET /api/discover/trips  (public feed)
//   request              -> arbitrary call to the backend (optional Clerk JWT)
// ============================================================================

const RENDER_API = "https://api.render.com/v1";
const RENDER_API_KEY = process.env.RENDER_API_KEY || "";
const SERVICE_ID = process.env.RENDER_SERVICE_ID || "srv-d8oaspnlk1mc7391lhl0";
let BASE_URL_OVERRIDE = process.env.BASE_URL || "";

// ---- tiny Render API client -------------------------------------------------
async function render(path) {
  if (!RENDER_API_KEY) throw new Error("RENDER_API_KEY is not set — cannot read credentials from Render.");
  const r = await fetch(RENDER_API + path, {
    headers: { Authorization: "Bearer " + RENDER_API_KEY },
  });
  if (!r.ok) throw new Error(`Render API ${path} -> HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}

// Read everything we need to connect, FROM RENDER.
async function connectionInfo() {
  const svc = await render(`/services/${SERVICE_ID}`);
  const baseUrl = BASE_URL_OVERRIDE || svc?.serviceDetails?.url || "";
  let envKeys = [];
  let hasDatabaseUrl = false, hasClerkSecret = false;
  try {
    const ev = await render(`/services/${SERVICE_ID}/env-vars?limit=100`);
    const items = Array.isArray(ev) ? ev.map((e) => e.envVar || e) : [];
    envKeys = items.map((e) => e.key);
    hasDatabaseUrl = envKeys.includes("DATABASE_URL");
    hasClerkSecret = envKeys.includes("CLERK_SECRET_KEY");
  } catch { /* env-var read may be restricted; URL is enough to connect */ }
  return {
    serviceId: SERVICE_ID,
    name: svc?.name,
    baseUrl,
    healthUrl: baseUrl + "/api/healthz",
    region: svc?.serviceDetails?.region,
    suspended: svc?.suspended,
    source: "render-api",
    envKeys,
    hasDatabaseUrl,
    hasClerkSecret,
    note: "All of the above was read live from the Render API using RENDER_API_KEY.",
  };
}

async function baseUrl() {
  if (BASE_URL_OVERRIDE) return BASE_URL_OVERRIDE;
  const info = await connectionInfo();
  if (!info.baseUrl) throw new Error("Could not resolve backend URL from Render.");
  BASE_URL_OVERRIDE = info.baseUrl; // cache for the session
  return info.baseUrl;
}

async function backend(method, path, { token, body } = {}) {
  const url = (await baseUrl()) + path;
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  const r = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { url, method, status: r.status, ok: r.ok, body: parsed };
}

// ---- MCP tool definitions ---------------------------------------------------
const TOOLS = [
  {
    name: "get_connection_info",
    description:
      "Read the reflight backend's connection details (URL, region, which env/credentials are set) live from the Render API using RENDER_API_KEY. Use this first to learn how to connect.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => connectionInfo(),
  },
  {
    name: "health",
    description: "GET /api/healthz on the live reflight backend. Returns {status:'ok'} when up.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => backend("GET", "/api/healthz"),
  },
  {
    name: "discover",
    description: "GET /api/discover/trips — the public trip feed (no auth). Optional cursor for pagination.",
    inputSchema: {
      type: "object",
      properties: { cursor: { type: "string", description: "opaque pagination cursor" } },
      additionalProperties: false,
    },
    handler: async (args) => backend("GET", "/api/discover/trips" + (args?.cursor ? `?cursor=${encodeURIComponent(args.cursor)}` : "")),
  },
  {
    name: "request",
    description:
      "Make an arbitrary request to the reflight backend. Provide path (e.g. /api/trips). Optional method, token (Clerk session JWT for authed routes), and JSON body.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "request path beginning with /" },
        method: { type: "string", enum: ["GET", "PUT", "POST", "DELETE", "PATCH"], default: "GET" },
        token: { type: "string", description: "Clerk session JWT for authed routes" },
        body: { type: "object", description: "JSON request body" },
      },
      required: ["path"],
      additionalProperties: false,
    },
    handler: async (args) => backend(args.method || "GET", args.path, { token: args.token, body: args.body }),
  },
];

// ---- minimal JSON-RPC 2.0 / MCP plumbing over stdio -------------------------
const PROTOCOL_VERSION = "2024-11-05";
function send(msg) { process.stdout.write(JSON.stringify(msg) + "\n"); }
function reply(id, result) { send({ jsonrpc: "2.0", id, result }); }
function fail(id, code, message) { send({ jsonrpc: "2.0", id, error: { code, message } }); }

async function handle(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") {
    return reply(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: "reflight-mcp", version: "1.0.0" },
    });
  }
  if (method === "notifications/initialized" || method === "notifications/cancelled") return; // no response
  if (method === "ping") return reply(id, {});
  if (method === "tools/list") {
    return reply(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
  }
  if (method === "tools/call") {
    const tool = TOOLS.find((t) => t.name === params?.name);
    if (!tool) return fail(id, -32602, `Unknown tool: ${params?.name}`);
    try {
      const out = await tool.handler(params.arguments || {});
      return reply(id, { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] });
    } catch (e) {
      return reply(id, { isError: true, content: [{ type: "text", text: "Error: " + (e?.message || String(e)) }] });
    }
  }
  if (id !== undefined) fail(id, -32601, `Method not found: ${method}`);
}

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg; try { msg = JSON.parse(line); } catch { continue; }
    Promise.resolve(handle(msg)).catch((e) => process.stderr.write("handler error: " + e?.message + "\n"));
  }
});
process.stderr.write(`reflight-mcp ready (service ${SERVICE_ID})\n`);
