# reflight-mcp — connect to the reflight backend

A zero-dependency [MCP](https://modelcontextprotocol.io) stdio server that lets
any agent connect to the **reflight backend deployed on Render**
(`https://reflight-backend.onrender.com`).

The design point: **credentials live in Render, not in this repo.** The server
bootstraps from a single secret — `RENDER_API_KEY` — and reads the live service
URL and which env/credentials are set (`DATABASE_URL`, `CLERK_SECRET_KEY`, …)
straight from the Render API at runtime. Another agent only needs the Render
key to discover how to connect; nothing else is hard-coded.

## Tools

| Tool | What it does |
|------|--------------|
| `get_connection_info` | Reads service URL + env/credential keys **from the Render API**. Call this first. |
| `health` | `GET /api/healthz` → `{"status":"ok"}` |
| `discover` | `GET /api/discover/trips` — public trip feed (no auth) |
| `request` | Arbitrary call: `{path, method?, token?, body?}`. Pass a Clerk JWT as `token` for authed routes. |

## Run / test it

```bash
# the only secret you need:
export RENDER_API_KEY=rnd_...          # see ../render.env

# drive the full MCP handshake + live calls and print PASS/FAIL:
node test-client.mjs
```

## Wire it into an MCP host

**Claude Code** — add to `.mcp.json` (project) or `~/.claude.json`:

```json
{
  "mcpServers": {
    "reflight": {
      "command": "node",
      "args": ["/Users/jasonzb/Desktop/apollo/alpha/reflight/deploy/mcp/reflight-mcp.mjs"],
      "env": { "RENDER_API_KEY": "rnd_..." }
    }
  }
}
```

Or via CLI:

```bash
claude mcp add reflight -e RENDER_API_KEY=rnd_... -- \
  node /Users/jasonzb/Desktop/apollo/alpha/reflight/deploy/mcp/reflight-mcp.mjs
```

**Claude Desktop** — same block under `mcpServers` in
`~/Library/Application Support/Claude/claude_desktop_config.json`.

## Env vars the server reads

| Var | Required | Default |
|-----|----------|---------|
| `RENDER_API_KEY` | yes | — (the bootstrap secret) |
| `RENDER_SERVICE_ID` | no | `srv-d8oaspnlk1mc7391lhl0` (reflight-backend) |
| `BASE_URL` | no | resolved from Render; set to skip the lookup |

## Why credentials stay in Render

Storing config as **Render service env vars** means a second agent (or a
scheduled job) can fetch the current connection details with just the Render
token — `GET /v1/services/{id}` and `/v1/services/{id}/env-vars` — instead of
copying a `.env` around. Rotate a value in the Render dashboard and every
consumer of this MCP picks it up on the next `get_connection_info` call.
