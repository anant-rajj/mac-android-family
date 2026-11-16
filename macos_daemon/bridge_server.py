import http.server
import socketserver
import asyncio
import websockets
import threading
import socket
import os
import sys
import json
import ctypes
from ctypes import c_uint32, byref, Structure, c_double

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

# Query active macOS connected displays
class CGPoint(Structure):
    _fields_ = [('x', c_double), ('y', c_double)]
class CGSize(Structure):
    _fields_ = [('width', c_double), ('height', c_double)]
class CGRect(Structure):
    _fields_ = [('origin', CGPoint), ('size', CGSize)]

def get_connected_displays():
    displays_info = []
    try:
        cg = ctypes.cdll.LoadLibrary('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics')
        cg.CGDisplayBounds.restype = CGRect
        cg.CGDisplayBounds.argtypes = [c_uint32]
        count = c_uint32()
        cg.CGGetActiveDisplayList(0, None, byref(count))
        displays = (c_uint32 * count.value)()
        cg.CGGetActiveDisplayList(count.value, displays, byref(count))
        for i in range(count.value):
            b = cg.CGDisplayBounds(displays[i])
            name = f"Screen {i + 1}"
            if i == 0:
                name += " (MacBook)"
            else:
                name += f" (Ext {i})"
            displays_info.append({
                "index": i + 1,
                "name": name,
                "width": int(b.size.width),
                "height": int(b.size.height),
                "x": int(b.origin.x),
                "y": int(b.origin.y)
            })
    except Exception as e:
        displays_info = [{"index": 1, "name": "Primary Screen", "width": 1920, "height": 1080, "x": 0, "y": 0}]
    return displays_info

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

    print(f"📱 [Link] Stylus / Touch device connected via low-latency socket.")
    
    # Send displays metadata to browser client
    try:
        displays = get_connected_displays()
        init_payload = json.dumps({"type": "init", "displays": displays})
        await websocket.send(init_payload)
    except Exception:
        pass

    try:
        async for message in websocket:
            # Handles both 12-byte turbo packets and 23-byte legacy frames
            if isinstance(message, bytes) and len(message) >= 12:
                udp_sock.sendto(message, ("127.0.0.1", UDP_PORT))
    except Exception:
        pass
    finally:
        print("📱 [Link] Stylus / Touch device disconnected.")

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
