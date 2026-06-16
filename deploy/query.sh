#!/usr/bin/env bash
# ============================================================================
# query.sh — talk to the reflight backend deployed on Render.
#
# Reads connection details + secrets from the sibling render.env file.
#
# Usage:
#   ./query.sh health            # hit GET /api/healthz   (default)
#   ./query.sh discover          # GET /api/discover/trips (public feed)
#   ./query.sh trip <id>         # GET /api/discover/trips/<id>
#   ./query.sh user <handle>     # GET /api/users/<handle>
#   ./query.sh get <path>        # GET <BASE_URL><path>, e.g. ./query.sh get /api/healthz
#   ./query.sh status            # Render service + latest-deploy status (uses RENDER_API_KEY)
#   ./query.sh deploys           # list recent deploys
#   ./query.sh logs              # open the live log dashboard URL
#   ./query.sh wait              # poll the service until /api/healthz returns 200
#
# Add  TOKEN=<clerk-jwt>  in front of any request to send an auth header, e.g.
#   TOKEN=eyJ... ./query.sh get /api/trips
# ============================================================================
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$DIR/render.env"
[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE" >&2; exit 1; }
# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

BASE_URL="${BASE_URL:?BASE_URL not set in render.env}"
AUTH=()
[ -n "${TOKEN:-}" ] && AUTH=(-H "Authorization: Bearer ${TOKEN}")

api() { # GET against the public service
  local path="$1"
  echo "GET ${BASE_URL}${path}" >&2
  curl -fsS --max-time 90 "${AUTH[@]}" "${BASE_URL}${path}"
  echo
}

render() { # GET against the Render management API
  curl -fsS -H "Authorization: Bearer ${RENDER_API_KEY:?set RENDER_API_KEY}" "https://api.render.com/v1$1"
}

cmd="${1:-health}"; shift || true
case "$cmd" in
  health)   api "${HEALTH_PATH:-/api/healthz}" | (python3 -m json.tool 2>/dev/null || cat) ;;
  discover) api "/api/discover/trips" | (python3 -m json.tool 2>/dev/null || cat) ;;
  trip)     api "/api/discover/trips/${1:?need a trip id}" | (python3 -m json.tool 2>/dev/null || cat) ;;
  user)     api "/api/users/${1:?need a handle}" | (python3 -m json.tool 2>/dev/null || cat) ;;
  get)      api "${1:?need a path}" | (python3 -m json.tool 2>/dev/null || cat) ;;
  status)
    render "/services/${SERVICE_ID:?}" \
      | python3 -c 'import sys,json;s=json.load(sys.stdin);print("service:",s["name"],s["id"]);print("url:    ",s.get("serviceDetails",{}).get("url"));print("suspended:",s.get("suspended"))'
    echo "--- latest deploy ---"
    render "/services/${SERVICE_ID}/deploys?limit=1" \
      | python3 -c 'import sys,json;d=json.load(sys.stdin)[0]["deploy"];print("deploy:",d["id"]);print("status:",d["status"]);print("created:",d.get("createdAt"));print("finished:",d.get("finishedAt"))'
    ;;
  deploys)
    render "/services/${SERVICE_ID:?}/deploys?limit=10" \
      | python3 -c 'import sys,json;[print(x["deploy"]["status"].ljust(12), x["deploy"]["id"], x["deploy"].get("createdAt")) for x in json.load(sys.stdin)]'
    ;;
  logs)  echo "${DASHBOARD_URL%/}/logs" ;;
  wait)
    url="${BASE_URL}${HEALTH_PATH:-/api/healthz}"
    echo "waiting for 200 from $url (free instances cold-start slowly) ..." >&2
    for i in $(seq 1 60); do
      code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 90 "$url" || true)
      echo "  attempt $i: HTTP $code" >&2
      [ "$code" = "200" ] && { echo "up."; exit 0; }
      sleep 10
    done
    echo "did not come up in time" >&2; exit 1
    ;;
  *) echo "unknown command: $cmd (try: health discover trip user get status deploys logs wait)" >&2; exit 2 ;;
esac
