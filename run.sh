#!/usr/bin/env bash
# ==============================================================================
# DCSS Stats Dashboard Launcher (Cross-Platform macOS & Linux)
# Starts the local Express web server and automatically opens the dashboard
# in your default web browser.
# ==============================================================================

PORT="${PORT:-3333}"
HOST="${HOST:-127.0.0.1}"
URL="http://${HOST}:${PORT}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Function to launch browser cross-platform (macOS open, Linux xdg-open, headless fallback)
open_browser() {
  local target="$1"
  if command -v open >/dev/null 2>&1; then
    open "${target}"
  elif command -v xdg-open >/dev/null 2>&1; then
    if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
      xdg-open "${target}" >/dev/null 2>&1 &
    else
      echo " Headless environment detected. Please navigate to: ${target}"
    fi
  else
    echo " Open your browser and navigate to: ${target}"
  fi
}

echo "════════════════════════════════════════════════════════════════"
echo " 🗡️  DCSS Stats Dashboard & Run Recommender"
echo "════════════════════════════════════════════════════════════════"

# Check if dashboard server is already running on port
if lsof -i :${PORT} -sTCP:LISTEN >/dev/null 2>&1; then
  echo " ✓ Server is already active on port ${PORT}."
  echo " 🌐 Opening browser at ${URL}..."
  open_browser "${URL}"
  echo "════════════════════════════════════════════════════════════════"
  exit 0
fi

cd "${APP_DIR}" || exit 1

# Check node availability
if ! command -v node >/dev/null 2>&1; then
  echo " Error: Node.js is required to run DCSS Dashboard."
  echo " Please install Node.js (v22.5.0+ recommended for built-in SQLite)."
  exit 1
fi

echo " 🚀 Launching Express server on ${URL}..."

# Start the server and record PID
node src/server.js &
SERVER_PID=$!

# Trap Ctrl+C and exit signals to cleanly kill child process
trap "echo -e '\nStopping DCSS Dashboard...'; kill ${SERVER_PID} 2>/dev/null; exit 0" SIGINT SIGTERM

# Wait for server to bind port
for i in {1..25}; do
  if lsof -i :${PORT} -sTCP:LISTEN >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

echo " 🌐 Opening browser at ${URL}..."
open_browser "${URL}"

echo ""
echo " Dashboard is running! Press Ctrl+C anytime to stop."
echo "════════════════════════════════════════════════════════════════"

# Wait on background process
wait ${SERVER_PID}
