import http.server
import socketserver
import asyncio
import websockets
import threading
import socket
import os
import subprocess
import time
import sys

WEB_PORT = 8080
WS_PORT = 9877
UDP_PORT = 9876
WEB_DIR = os.path.expanduser("~/Desktop/family/web_client")
DAEMON_BIN = os.path.expanduser("~/Desktop/family/macos_daemon/.build/debug/family-daemon")

# 1. Start daemon subprocess
daemon_proc = subprocess.Popen([DAEMON_BIN])

# 2. Start HTTP static server
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)
    def log_message(self, format, *args):
        pass

def start_http():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", WEB_PORT), Handler) as httpd:
        httpd.serve_forever()

# 3. WebSocket bridge
udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

async def ws_handler(websocket):
    try:
        transport = websocket.transport
        if transport:
            raw_sock = transport.get_extra_info('socket')
            if raw_sock:
                raw_sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
    except Exception:
        pass

    try:
        async for message in websocket:
            if isinstance(message, bytes) and len(message) >= 12:
                udp_sock.sendto(message, ("127.0.0.1", UDP_PORT))
    except Exception:
        pass

async def start_ws():
    async with websockets.serve(ws_handler, "0.0.0.0", WS_PORT, max_size=1024*1024, max_queue=32, compression=None):
        await asyncio.Future()

def run():
    t = threading.Thread(target=start_http, daemon=True)
    t.start()
    print("Service Manager running...")
    asyncio.run(start_ws())

if __name__ == "__main__":
    run()
