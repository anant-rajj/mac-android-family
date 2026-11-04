import http.server
import socketserver
import asyncio
import websockets
import threading
import socket
import os

WEB_PORT = 8080
WS_PORT = 9877
UDP_PORT = 9876
WEB_DIR = os.path.expanduser("~/Desktop/family/web_client")

# 1. Start HTTP Server for S23 Ultra Browser
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def log_message(self, format, *args):
        # Silence routine static file log spam for minimum CPU overhead
        pass

def start_http():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", WEB_PORT), Handler) as httpd:
        print(f"🌐 Web App available at http://10.7.17.83:{WEB_PORT}")
        httpd.serve_forever()

# 2. Optimized UDP Socket & WebSocket bridge
udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

async def ws_handler(websocket):
    # Enable TCP_NODELAY on the underlying TCP socket to kill Nagle's buffering
    try:
        transport = websocket.transport
        if transport:
            raw_sock = transport.get_extra_info('socket')
            if raw_sock:
                raw_sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
    except Exception:
        pass

    print("📱 S23 Ultra connected via Low-Latency Fast-Path!")
    try:
        async for message in websocket:
            if isinstance(message, bytes) and len(message) >= 23:
                # Forward immediately to native Swift family-daemon
                udp_sock.sendto(message, ("127.0.0.1", UDP_PORT))
    except Exception:
        pass
    finally:
        print("📱 S23 Ultra disconnected")

async def start_ws():
    # max_queue=None, compression=None to ensure 0ms queuing & compression overhead
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
        print(f"⚡ Fast-Path WebSocket bridge ready on ws://0.0.0.0:{WS_PORT}")
        await asyncio.Future()

def run():
    t = threading.Thread(target=start_http, daemon=True)
    t.start()
    asyncio.run(start_ws())

if __name__ == "__main__":
    run()
