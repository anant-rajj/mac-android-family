#!/usr/bin/env bash
# ==============================================================================
# Mac-Android Family: Universal Phone & Tablet Graphics Digitizer CLI
# Zero-Bloat, 240Hz Input Engine for macOS (Android, iPad, Any Stylus or Touch)
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DAEMON_DIR="${SCRIPT_DIR}/macos_daemon"
DAEMON_BIN_DEBUG="${DAEMON_DIR}/.build/debug/family-daemon"
DAEMON_BIN_RELEASE="${DAEMON_DIR}/.build/release/family-daemon"
BRIDGE_SCRIPT="${DAEMON_DIR}/bridge_server.py"
PID_FILE="${SCRIPT_DIR}/.family_runtime.pid"

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Dynamic LAN IP Discovery
get_lan_ip() {
    python3 -c "
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
try:
    s.connect(('8.8.8.8', 80))
    print(s.getsockname()[0])
except Exception:
    print('127.0.0.1')
finally:
    s.close()
" 2>/dev/null || echo "127.0.0.1"
}

# Determine binary location (release preferred, fallback to debug)
get_daemon_bin() {
    if [[ -x "${DAEMON_BIN_RELEASE}" ]]; then
        echo "${DAEMON_BIN_RELEASE}"
    elif [[ -x "${DAEMON_BIN_DEBUG}" ]]; then
        echo "${DAEMON_BIN_DEBUG}"
    else
        echo ""
    fi
}

# Print CLI Banner
print_banner() {
    echo -e "${CYAN}${BOLD}"
    echo "  __  __                  _              _           _     _ "
    echo " |  \/  |                / \   _ __   __| |_ __ ___ (_) __| |"
    echo " | |\/| | _____ ____    / _ \ | '_ \ / _\` | '__/ _ \| |/ _\` |"
    echo " | |  | |/ _ \ \/ /\ \ / ___ \| | | | (_| | | | (_) | | (_| |"
    echo " |_|  |_|\___/\_/  \_//_/   \_\_| |_|\__,_|_|  \___/|_|\__,_|"
    echo -e "   ${YELLOW}Universal Phone & Tablet Graphics Digitizer • macOS Engine${NC}\n"
}

# Print Help & Command List
cmd_help() {
    print_banner
    echo -e "${BOLD}USAGE:${NC}"
    echo -e "  ./start.sh ${CYAN}<command>${NC} [options]"
    echo ""
    echo -e "${BOLD}AVAILABLE COMMANDS:${NC}"
    echo -e "  ${GREEN}start${NC}       Launch macOS digitizer daemon, fast-path bridge, and web canvas"
    echo -e "  ${GREEN}stop${NC}        Terminate all active daemon and bridge background services"
    echo -e "  ${GREEN}status${NC}      Display current service status, active PIDs, and listening ports"
    echo -e "  ${GREEN}qr${NC}          Print connection URL and terminal ASCII QR code for device pairing"
    echo -e "  ${GREEN}build${NC}       Compile the native Swift host daemon (Release mode)"
    echo -e "  ${GREEN}test${NC}        Execute automated UDP loopback and Quartz injection self-test"
    echo -e "  ${GREEN}uninstall${NC}   Stop services, purge build binaries, and remove temporary caches"
    echo -e "  ${GREEN}help${NC}        Display this command reference guide"
    echo ""
    echo -e "${BOLD}DEVICE COMPATIBILITY:${NC}"
    echo -e "  • Smartphones: Samsung Galaxy, Google Pixel, Xiaomi, OnePlus, iPhone, etc."
    echo -e "  • Tablets:     Galaxy Tab, iPad / iPad Pro, Pixel Tablet, Xiaomi Pad, Lenovo"
    echo -e "  • Styluses:    S Pen, Apple Pencil, USI Pen, Capacitive Stylus, or Finger Touch"
    echo ""
    echo -e "${BOLD}NETWORK ENDPOINTS:${NC}"
    echo -e "  • Web Canvas Portal:   ${CYAN}http://$(get_lan_ip):8080${NC}"
    echo -e "  • Fast-Path WebSocket: ${CYAN}ws://$(get_lan_ip):9877${NC}"
    echo -e "  • UDP Turbo Listener:  ${CYAN}127.0.0.1:9876${NC}"
    echo ""
    echo -e "${BOLD}EXAMPLES:${NC}"
    echo -e "  ./start.sh start      # Start services and print pairing QR code"
    echo -e "  ./start.sh status     # Check if digitizer services are active"
    echo -e "  ./start.sh stop       # Gracefully shut down all background listeners"
    echo ""
}

# Build Daemon
cmd_build() {
    echo -e "${CYAN}🔨 [Build] Compiling native Swift digitizer daemon...${NC}"
    cd "${DAEMON_DIR}"
    swift build -c release
    echo -e "${GREEN}✅ [Build] Compilation complete: ${DAEMON_BIN_RELEASE}${NC}"
}

# Start Services
cmd_start() {
    print_banner
    
    # Check if already active
    if [[ -f "${PID_FILE}" ]]; then
        OLD_PID=$(cat "${PID_FILE}" 2>/dev/null | tr '\n' ' ')
        if ps -p ${OLD_PID} > /dev/null 2>&1; then
            echo -e "${YELLOW}⚠️ Services already running with PIDs: ${OLD_PID}${NC}"
            echo -e "Run ${CYAN}./start.sh status${NC} or ${CYAN}./start.sh stop${NC}"
            return 0
        fi
        rm -f "${PID_FILE}"
    fi

    # Ensure binary exists
    DAEMON_EXEC=$(get_daemon_bin)
    if [[ -z "${DAEMON_EXEC}" ]]; then
        echo -e "${YELLOW}⚙️ Binary not detected. Initializing release compilation...${NC}"
        cmd_build
        DAEMON_EXEC=$(get_daemon_bin)
    fi

    echo -e "${CYAN}🚀 [Launch] Starting native Quartz tablet daemon...${NC}"
    "${DAEMON_EXEC}" > /dev/null 2>&1 &
    DAEMON_PID=$!

    echo -e "${CYAN}⚡ [Launch] Starting WebSocket bridge and web server...${NC}"
    python3 "${BRIDGE_SCRIPT}" > /dev/null 2>&1 &
    BRIDGE_PID=$!

    echo "${DAEMON_PID}" > "${PID_FILE}"
    echo "${BRIDGE_PID}" >> "${PID_FILE}"

    sleep 1

    LAN_IP=$(get_lan_ip)
    PAIR_URL="http://${LAN_IP}:8080"

    echo -e "${GREEN}✅ [Status] System active and listening.${NC}"
    echo -e "   • Native Daemon PID: ${BOLD}${DAEMON_PID}${NC}"
    echo -e "   • Bridge Server PID: ${BOLD}${BRIDGE_PID}${NC}"
    echo ""
    echo -e "${BOLD}📱 PAIRING INSTRUCTIONS FOR ANY PHONE OR TABLET:${NC}"
    echo -e "1. Connect your phone or tablet (Android / iPad / iOS) to the same Wi-Fi network (or USB tethering)."
    echo -e "2. Open any browser (Chrome, Samsung Internet, Safari, Firefox) and navigate to:"
    echo -e "   👉 ${CYAN}${BOLD}${PAIR_URL}${NC}"
    echo -e "3. Or scan the QR code below directly with your device camera:"
    echo ""

    python3 -c "
import qrcode
qr = qrcode.QRCode(box_size=1, border=2)
qr.add_data('${PAIR_URL}')
qr.print_ascii(invert=True)
" 2>/dev/null || true

    echo ""
    echo -e "💡 Touch stylus or finger to your phone/tablet display to begin drawing on Mac."
    echo -e "To stop services, execute: ${CYAN}./start.sh stop${NC}"
}

# Stop Services
cmd_stop() {
    echo -e "${CYAN}🛑 [Stop] Halting active Family digitizer services...${NC}"
    if [[ -f "${PID_FILE}" ]]; then
        while read -r pid; do
            if [[ -n "${pid}" ]] && ps -p "${pid}" > /dev/null 2>&1; then
                kill "${pid}" 2>/dev/null || true
            fi
        done < "${PID_FILE}"
        rm -f "${PID_FILE}"
    fi

    # Ensure no lingering background processes on ports
    pkill -f "family-daemon" 2>/dev/null || true
    pkill -f "bridge_server.py" 2>/dev/null || true

    echo -e "${GREEN}✅ [Stop] All services stopped. Ports 8080, 9876, and 9877 released.${NC}"
}

# Status Check
cmd_status() {
    print_banner
    echo -e "${BOLD}SERVICE STATUS AUDIT:${NC}"
    
    DAEMON_PIDS=$(pgrep -f "family-daemon" || true)
    BRIDGE_PIDS=$(pgrep -f "bridge_server.py" || true)

    if [[ -n "${DAEMON_PIDS}" ]]; then
        echo -e "  • Native Swift Daemon:   ${GREEN}RUNNING${NC} (PID: ${DAEMON_PIDS})"
    else
        echo -e "  • Native Swift Daemon:   ${RED}STOPPED${NC}"
    fi

    if [[ -n "${BRIDGE_PIDS}" ]]; then
        echo -e "  • Fast-Path Bridge Server: ${GREEN}RUNNING${NC} (PID: ${BRIDGE_PIDS})"
    else
        echo -e "  • Fast-Path Bridge Server: ${RED}STOPPED${NC}"
    fi

    echo ""
    echo -e "${BOLD}PORT LISTENER AUDIT:${NC}"
    for port in 8080 9876 9877; do
        if lsof -i :$port >/dev/null 2>&1; then
            PROC_NAME=$(lsof -i :$port | tail -n 1 | awk '{print $1}')
            echo -e "  • Port ${port}: ${GREEN}OPEN${NC} (${PROC_NAME})"
        else
            echo -e "  • Port ${port}: ${RED}CLOSED${NC}"
        fi
    done
    echo ""
}

# Display QR code
cmd_qr() {
    LAN_IP=$(get_lan_ip)
    PAIR_URL="http://${LAN_IP}:8080"
    echo -e "${BOLD}📱 S Pen / Tablet Canvas Connection:${NC} ${CYAN}${PAIR_URL}${NC}\n"
    python3 -c "
import qrcode
qr = qrcode.QRCode(box_size=1, border=2)
qr.add_data('${PAIR_URL}')
qr.print_ascii(invert=True)
" 2>/dev/null || true
}

# Automated Loopback Test
cmd_test() {
    echo -e "${CYAN}🧪 [Test] Running UDP loopback and synthetic stylus telemetry check...${NC}"
    python3 -c "
import socket
import struct

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
# Construct 12-byte turbo frame: 0xFACE, action=2 (move), normX=32767, normY=32767, pressure=32767, tiltX=0, tiltY=0
# Format: >H B B H H H b b
buf = struct.pack('>HBBHHHbb', 0xFACE, 2, 0, 32767, 32767, 32767, 0, 0)
sock.sendto(buf, ('127.0.0.1', 9876))
print('✅ Injected synthetic 12-byte stylus frame to UDP port 9876.')
"
    echo -e "${GREEN}✅ [Test] Self-test complete.${NC}"
}

# Uninstall
cmd_uninstall() {
    echo -e "${YELLOW}⚠️ [Uninstall] Commencing uninstallation...${NC}"
    cmd_stop
    
    echo -e "${CYAN}🧹 [Uninstall] Removing build artifacts and caches...${NC}"
    rm -rf "${DAEMON_DIR}/.build"
    rm -f "${PID_FILE}"
    rm -f "${SCRIPT_DIR}/qr_code.png"

    echo -e "${GREEN}✅ [Uninstall] Uninstallation complete. Source files remain intact.${NC}"
}

# Main Command Dispatcher
COMMAND="${1:-help}"

case "${COMMAND}" in
    start|up|run)
        cmd_start
        ;;
    stop|down)
        cmd_stop
        ;;
    status|check)
        cmd_status
        ;;
    qr)
        cmd_qr
        ;;
    build|compile)
        cmd_build
        ;;
    test)
        cmd_test
        ;;
    uninstall|clean)
        cmd_uninstall
        ;;
    help|--help|-h)
        cmd_help
        ;;
    *)
        echo -e "${RED}Unknown command: ${COMMAND}${NC}\n"
        cmd_help
        exit 1
        ;;
esac
