import http.server
import socketserver
import asyncio
import websockets
import threading
import socket
import os
import subprocess
import json
import time

WEB_PORT = 8080
WS_PORT = 9877
UDP_PORT = 9876
WEB_DIR = os.path.expanduser("~/Desktop/family/web_client")
DAEMON_BIN = os.path.expanduser("~/Desktop/family/macos_daemon/.build/debug/family-daemon")

# 1. Start daemon subprocess
daemon_proc = subprocess.Popen([DAEMON_BIN])

# 2. HTTP Static Web Server
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)
    def log_message(self, format, *args):
        pass

def start_http():
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", WEB_PORT), Handler) as httpd:
        httpd.serve_forever()

# 3. WebSocket bridge & Clipboard synchronizer
udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
connected_clients = set()
loop = None

def get_macos_clipboard():
    try:
        p = subprocess.run(["pbpaste"], capture_output=True, text=True, check=True)
        return p.stdout
    except Exception:
        return ""

def set_macos_clipboard(text):
    try:
        p = subprocess.Popen(["pbcopy"], stdin=subprocess.PIPE)
        p.communicate(text.encode("utf-8"))
    except Exception:
        pass

last_mac_clip = get_macos_clipboard()

def mac_clipboard_monitor():
    global last_mac_clip, loop
    while True:
        time.sleep(0.4)
        curr = get_macos_clipboard()
        if curr and curr != last_mac_clip:
            last_mac_clip = curr
            if connected_clients and loop:
                payload = json.dumps({"type": "clipboard_sync", "text": curr})
                for ws in list(connected_clients):
                    asyncio.run_coroutine_threadsafe(ws.send(payload), loop)

async def ws_handler(websocket):
    global last_mac_clip
    connected_clients.add(websocket)
    try:
        transport = websocket.transport
        if transport:
            raw_sock = transport.get_extra_info('socket')
            if raw_sock:
                raw_sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
    except Exception:
        pass

    # Send current Mac clipboard to phone immediately upon connection
    if last_mac_clip:
        try:
            await websocket.send(json.dumps({"type": "clipboard_sync", "text": last_mac_clip}))
        except Exception:
            pass

    try:
        async for message in websocket:
            if isinstance(message, bytes) and len(message) >= 12:
                # S Pen telemetry: Forward directly to native UDP listener
                udp_sock.sendto(message, ("127.0.0.1", UDP_PORT))
            elif isinstance(message, str):
                # Universal Clipboard JSON packet from Phone -> Mac
                try:
                    data = json.loads(message)
                    if data.get("type") == "clipboard_push":
                        txt = data.get("text", "")
                        if txt:
                            last_mac_clip = txt
                            set_macos_clipboard(txt)
                except Exception:
                    pass
    except Exception:
        pass
    finally:
        connected_clients.discard(websocket)

async def start_ws():
    global loop
    loop = asyncio.get_running_loop()
    async with websockets.serve(ws_handler, "0.0.0.0", WS_PORT, max_size=1024*1024, max_queue=32, compression=None):
        await asyncio.Future()

def run():
    t_http = threading.Thread(target=start_http, daemon=True)
    t_http.start()
    t_clip = threading.Thread(target=mac_clipboard_monitor, daemon=True)
    t_clip.start()
    print("Service Manager running with Universal Clipboard sync...")
    asyncio.run(start_ws())

if __name__ == "__main__":
    run()
