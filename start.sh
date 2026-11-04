#!/bin/bash
echo "=================================================="
echo "      🚀 Launching Family S Pen Continuity       "
echo "=================================================="

# Check accessibility permissions
osascript -e 'tell application "System Events" to delay 0.1' 2>/dev/null

# 1. Start Swift Host Daemon in background
~/Desktop/family/macos_daemon/.build/debug/family-daemon &
DAEMON_PID=$!

# 2. Start Bridge Server (Web + WebSocket)
python3 ~/Desktop/family/macos_daemon/bridge_server.py &
BRIDGE_PID=$!

trap "kill $DAEMON_PID $BRIDGE_PID 2>/dev/null; exit" INT TERM EXIT

echo ""
echo "📱 OPEN THIS URL ON YOUR S23 ULTRA (CHROME / SAMSUNG INTERNET):"
echo "👉 http://10.7.17.83:8080"
echo ""
python3 -c "import qrcode; qr = qrcode.QRCode(); qr.add_data('http://10.7.17.83:8080'); qr.print_ascii(invert=True)" 2>/dev/null || true
echo "=================================================="
echo "Press Ctrl+C to stop the servers."

wait
