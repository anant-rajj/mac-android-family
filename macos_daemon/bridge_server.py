import http.server
import socketserver
import asyncio
import websockets
import threading
import socket
import os
import sys

WEB_PORT = 8080
WS_PORT = 9877
UDP_PORT = 9876

# Locate web_client directory relative to this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "web_client"))

def get_lan_ip():
    """Detect primary local network IP address."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

LOCAL_IP = get_lan_ip()

# 1. HTTP Static Web Server for Browser Client
class SilentHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def log_message(self, format, *args):
        # Silence routine static asset logs for minimal CLI overhead
        pass

def start_http():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", WEB_PORT), SilentHandler) as httpd:
        print(f"🌐 [Web] Canvas portal ready at: http://{LOCAL_IP}:{WEB_PORT}")
        httpd.serve_forever()

# 2. Fast-Path WebSocket Bridge -> UDP Forwarder
udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

async def ws_handler(websocket):
    # Enable TCP_NODELAY on underlying TCP socket to eliminate buffering
    try:
        transport = websocket.transport
        if transport:
            raw_sock = transport.get_extra_info('socket')
            if raw_sock:
                raw_sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
    except Exception:
        pass

    print(f"📱 [Link] Stylus device connected via low-latency socket.")
    try:
        async for message in websocket:
            # Handles both 12-byte turbo packets and 23-byte legacy frames
            if isinstance(message, bytes) and len(message) >= 12:
                udp_sock.sendto(message, ("127.0.0.1", UDP_PORT))
    except Exception:
        pass
    finally:
        print("📱 [Link] Stylus device disconnected.")

async def start_ws():
    async with websockets.serve(
        ws_handler,
        "0.0.0.0",
        WS_PORT,
        max_size=1024*1024,
        max_queue=32,
        compression=None,
        ping_interval=10,
        ping_timeout=5
    ):
        print(f"⚡ [Bridge] WebSocket ingress active on ws://0.0.0.0:{WS_PORT}")
        await asyncio.Future()

def run():
    t = threading.Thread(target=start_http, daemon=True)
    t.start()
    try:
        asyncio.run(start_ws())
    except KeyboardInterrupt:
        print("\n🛑 [Bridge] Server stopped.")

if __name__ == "__main__":
    run()
