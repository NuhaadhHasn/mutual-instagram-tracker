#!/usr/bin/env bash
# Start Mutual locally and open it in your browser.
cd "$(dirname "$0")" || exit 1
PORT=8321

open_browser() {
  sleep 1
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:$PORT"
  elif command -v open >/dev/null 2>&1; then open "http://localhost:$PORT"
  fi
}

if command -v node >/dev/null 2>&1; then
  open_browser &
  exec node server.js "$PORT"
elif command -v python3 >/dev/null 2>&1; then
  open_browser &
  exec python3 -m http.server "$PORT" --bind 127.0.0.1
else
  echo
  echo "  Mutual needs either Node.js or Python installed to run locally."
  echo "    Node.js   https://nodejs.org"
  echo "    Python    https://python.org"
  echo
  exit 1
fi
