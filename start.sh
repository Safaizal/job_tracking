#!/usr/bin/env bash
#
# Start the Job Tracker backend and frontend together.
#
#   ./start.sh              start both
#   ./start.sh --lan        bind 0.0.0.0 so other devices on your network can use it
#   ./start.sh --no-reload  don't restart the backend on file changes
#   ./start.sh --stop       stop anything left over from an earlier run
#   ./start.sh --help
#
# Ctrl+C stops both servers.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

HOST="127.0.0.1"
RELOAD=1

# Where PIDs are kept so a killed terminal can still be cleaned up later.
STATE_DIR="${TMPDIR:-/tmp}/jobtracker-dev"
BE_PID_FILE="$STATE_DIR/backend.pid"
FE_PID_FILE="$STATE_DIR/frontend.pid"

if [ -t 1 ]; then
  DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'
  BLUE=$'\033[34m'; BOLD=$'\033[1m'; OFF=$'\033[0m'
else
  DIM=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; BOLD=""; OFF=""
fi

info()  { printf '%s\n' "${DIM}$*${OFF}"; }
ok()    { printf '%s\n' "${GREEN}  ok${OFF}  $*"; }
warn()  { printf '%s\n' "${YELLOW}  !!${OFF}  $*"; }
fail()  { printf '%s\n' "${RED}  xx${OFF}  $*" >&2; }
step()  { printf '%s\n' "${BOLD}${BLUE}==>${OFF} ${BOLD}$*${OFF}"; }

die()   { fail "$*"; exit 1; }

# ---------------------------------------------------------------- arguments
while [ $# -gt 0 ]; do
  case "$1" in
    --lan)      HOST="0.0.0.0"; shift ;;
    --no-reload) RELOAD=0; shift ;;
    --stop)     STOP_ONLY=1; shift ;;
    -h|--help)  sed -n '3,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)          die "Unknown option: $1  (try --help)" ;;
  esac
done

mkdir -p "$STATE_DIR"

# ------------------------------------------------------------ stop helpers
# Kill a process group: npm and uvicorn both spawn children of their own.
kill_pidfile() {
  local file="$1" name="$2" pid
  [ -f "$file" ] || return 0
  pid="$(cat "$file" 2>/dev/null)"

  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
    for _ in $(seq 1 20); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.25
    done
    if kill -0 "$pid" 2>/dev/null; then
      kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null
    fi
    ok "$name stopped (pid $pid)"
  else
    info "  $name was not running"
  fi
  rm -f "$file"
}

if [ "${STOP_ONLY:-0}" = "1" ]; then
  step "Stopping Job Tracker"
  kill_pidfile "$FE_PID_FILE" "frontend"
  kill_pidfile "$BE_PID_FILE" "backend"
  exit 0
fi

# Clean up anything a previous run left behind, so ports are free.
kill_pidfile "$FE_PID_FILE" "stale frontend"
kill_pidfile "$BE_PID_FILE" "stale backend"

CHILD_PIDS=()
cleanup() {
  trap - INT TERM EXIT
  printf '\n%s\n' "${DIM}Stopping...${OFF}"
  for pid in "${CHILD_PIDS[@]:-}"; do
    [ -n "$pid" ] || continue
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
  done
  for _ in $(seq 1 20); do
    local_alive=0
    for pid in "${CHILD_PIDS[@]:-}"; do
      [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && local_alive=1
    done
    [ "$local_alive" = "0" ] && break
    sleep 0.25
  done
  for pid in "${CHILD_PIDS[@]:-}"; do
    [ -n "$pid" ] || continue
    kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null
  done
  rm -f "$BE_PID_FILE" "$FE_PID_FILE"
  printf '%s\n' "${DIM}Both servers stopped.${OFF}"
}
trap cleanup INT TERM EXIT

# ----------------------------------------------------------------- python
# The console scripts in this project's venv have stale absolute shebangs
# (they point at an old directory), so always invoke uvicorn as a module.
find_python() {
  local v
  for v in env venv .venv; do
    if [ -x "$BACKEND_DIR/$v/bin/python" ]; then
      printf '%s\n' "$BACKEND_DIR/$v/bin/python"
      return 0
    fi
  done
  command -v python3 2>/dev/null || printf '%s\n' ""
}

step "Checking the backend environment"

PY="$(find_python)"
[ -n "$PY" ] || die "No python3 found. Install Python 3.10 or newer."

if [ -x "$BACKEND_DIR/env/bin/python" ] || [ -x "$BACKEND_DIR/venv/bin/python" ]; then
  ok "Python: $PY ($("$PY" --version 2>&1))"
else
  warn "No virtualenv in backend/ — using $PY ($("$PY" --version 2>&1))"
  info "     Create one with:  python3 -m venv venv && venv/bin/pip install -r backend/requirements.txt"
fi

if ! "$PY" - <<'PYCHECK'
import sys
missing = []
for module in (
    "fastapi", "uvicorn", "requests", "googleapiclient",
    "google_auth_oauthlib", "google.oauth2.credentials",
):
    try:
        __import__(module)
    except ImportError:
        missing.append(module.split(".")[0])
if missing:
    print("  missing Python packages: " + ", ".join(sorted(set(missing))))
    sys.exit(1)
PYCHECK
then
  fail "Backend dependencies are missing."
  info "     Install them with:  $PY -m pip install -r backend/requirements.txt"
  exit 1
fi
ok "Backend dependencies present"

[ -f "$BACKEND_DIR/credentials.json" ] || {
  warn "backend/credentials.json not found."
  info "     Google sign-in will return an error until you add it (see README)."
}
[ -f "$BACKEND_DIR/requirements.txt" ] || warn "backend/requirements.txt is missing."

# -------------------------------------------------------------- port check
# Vite prefers the IPv6 loopback, so a port can be free on 127.0.0.1 and still
# be taken on [::1]. Check both before claiming the port is available.
port_in_use() {
  "$PY" - "$1" <<'PORTCheck'
import socket, sys
port = int(sys.argv[1])
targets = [socket.AF_INET, socket.AF_INET6]
addresses = [("127.0.0.1", port), ("::1", port)]
for family, address in zip(targets, addresses):
    try:
        with socket.socket(family, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind(address)
    except OSError:
        sys.exit(0)  # taken
sys.exit(1)  # free on both
PORTCheck
}

for entry in "backend:$BACKEND_PORT" "frontend:$FRONTEND_PORT"; do
  name="${entry%%:*}"; port="${entry##*:}"
  if port_in_use "$port"; then
    fail "Port $port is already in use, so the $name cannot start."
    info "     Something else is on that port. Stop it, or re-run with a different port:"
    info "       BACKEND_PORT=8001 ./start.sh"
    exit 1
  fi
done
ok "Ports $BACKEND_PORT and $FRONTEND_PORT are free"

# --------------------------------------------------------------- frontend
step "Checking the frontend"

command -v npm >/dev/null 2>&1 || die "npm not found. Install Node.js 18 or newer."

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  die "frontend/node_modules is missing. Run:  (cd frontend && npm install)"
fi
ok "node_modules present ($(node --version))"

# ----------------------------------------------------------------- backend
# Tell the frontend where the API lives, otherwise it falls back to
# http://localhost:8000 regardless of the ports chosen above.
if [ "$HOST" = "0.0.0.0" ]; then
  LAN_IP="$("$PY" - <<'IPLOOKUP'
import socket
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(("1.1.1.1", 80))  # no packets sent, just picks the outbound interface
    print(s.getsockname()[0])
    s.close()
except OSError:
    print("127.0.0.1")
IPLOOKUP
)"
  API_URL="http://$LAN_IP:$BACKEND_PORT"
else
  API_URL="http://localhost:$BACKEND_PORT"
fi

step "Starting the backend on port $BACKEND_PORT"

BACKEND_ARGS=(-m uvicorn main:app --host "$HOST" --port "$BACKEND_PORT")
if [ "$RELOAD" = "1" ]; then
  # Ignore the virtualenv: watching thousands of dependency files is slow and
  # can trigger reloads that have nothing to do with your code. Uvicorn only
  # honours a directory exclude that is an absolute path and really is a parent
  # of the file -- a glob like "env*" is silently ignored -- so pass real paths.
  BACKEND_ARGS+=(--reload)
  for skip in env venv .venv tokens; do
    if [ -d "$BACKEND_DIR/$skip" ]; then
      BACKEND_ARGS+=(--reload-exclude "$BACKEND_DIR/$skip")
    fi
  done
  # Without watchfiles, uvicorn falls back to a slower built-in watcher and
  # prints a warning that the excludes above have no effect.
  if ! "$PY" -c "import watchfiles" 2>/dev/null; then
    warn "watchfiles is not installed, so the backend uses the slower built-in reloader."
    info "     For a faster reload:  $PY -m pip install watchfiles"
  fi
fi

# setsid gives each server its own process group, so Ctrl+C can take down the
# children that npm and uvicorn spawn.
if command -v setsid >/dev/null 2>&1; then
  ( cd "$BACKEND_DIR" && setsid "$PY" "${BACKEND_ARGS[@]}" ) &
else
  ( cd "$BACKEND_DIR" && exec "$PY" "${BACKEND_ARGS[@]}" ) &
fi
BE_PID=$!
CHILD_PIDS+=("$BE_PID")
echo "$BE_PID" > "$BE_PID_FILE"

# Consider a server up as soon as any of the given URLs answers. Vite binds
# [::1] while uvicorn binds 127.0.0.1, so hard-coding one family is unreliable.
wait_for_http() {
  local name="$1"; shift
  local tries=60
  while [ "$tries" -gt 0 ]; do
    if "$PY" - "$@" <<'WAITFOR'
import sys, urllib.error, urllib.request

for url in sys.argv[1:]:
    try:
        urllib.request.urlopen(url, timeout=1)
    except urllib.error.HTTPError:
        pass  # Any HTTP answer means something is listening.
    except Exception:
        continue
    sys.exit(0)
sys.exit(1)
WAITFOR
    then
      ok "$name is up"
      return 0
    fi
    # If the backend died, stop waiting so the real error is not buried.
    if [ "$name" = "backend" ] && ! kill -0 "$BE_PID" 2>/dev/null; then
      return 1
    fi
    sleep 0.5
    tries=$((tries - 1))
  done
  return 1
}

if ! wait_for_http "backend" "http://127.0.0.1:$BACKEND_PORT/api/health"; then
  fail "The backend did not come up. Read the output above for the reason."
  exit 1
fi

# --------------------------------------------------------------- frontend
step "Starting the frontend on port $FRONTEND_PORT"

# Vite listens on the loopback only unless told otherwise, so --lan has to be
# passed through or the address we print is unreachable from other devices.
VITE_ARGS=(--port "$FRONTEND_PORT")
if [ "$HOST" = "0.0.0.0" ]; then
  VITE_ARGS+=(--host 0.0.0.0)
fi

if command -v setsid >/dev/null 2>&1; then
  ( cd "$FRONTEND_DIR" && VITE_API_URL="$API_URL" setsid npm run dev -- "${VITE_ARGS[@]}" ) &
else
  ( cd "$FRONTEND_DIR" && VITE_API_URL="$API_URL" npm run dev -- "${VITE_ARGS[@]}" ) &
fi
FE_PID=$!
CHILD_PIDS+=("$FE_PID")
echo "$FE_PID" > "$FE_PID_FILE"

FRONTEND_PROBES=(
  "http://127.0.0.1:$FRONTEND_PORT/"
  "http://[::1]:$FRONTEND_PORT/"
  "http://localhost:$FRONTEND_PORT/"
)
if [ "$HOST" = "0.0.0.0" ]; then
  # Also prove it answers on the address other devices will actually use.
  FRONTEND_PROBES+=("http://$LAN_IP:$FRONTEND_PORT/")
fi

if ! wait_for_http "frontend" "${FRONTEND_PROBES[@]}"; then
  fail "The frontend did not come up. Read the output above for the reason."
  exit 1
fi

# ------------------------------------------------------------------ ready
FRONTEND_URL="http://localhost:$FRONTEND_PORT"
if [ "$HOST" = "0.0.0.0" ]; then
  FRONTEND_URL="http://$LAN_IP:$FRONTEND_PORT"
fi

printf '\n%s\n' "${GREEN}${BOLD}Job Tracker is running${OFF}"
printf '  %sapp   %s%s\n' "$DIM" "$FRONTEND_URL" "$OFF"
printf '  %sapi   %s%s\n' "$DIM" "$API_URL" "$OFF"
if [ "$HOST" = "0.0.0.0" ]; then
  printf '  %slan   open that app address from another device on the same network%s\n' "$DIM" "$OFF"
fi
printf '  %ssign in with Google to see your own private list%s\n' "$DIM" "$OFF"
printf '\n%s\n\n' "${DIM}Press Ctrl+C to stop both.${OFF}"

# Keep the script alive so the trap stays armed and output keeps flowing.
wait
