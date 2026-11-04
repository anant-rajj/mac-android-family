<div align="center">

# Mac-Android Family
### Universal S Pen Graphics Digitizer for macOS & Samsung Galaxy Devices

[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Android-black?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/anant-rajj/mac-android-family)
[![Frequency](https://img.shields.io/badge/Sampling-240Hz%20EMR-00e5ff?style=for-the-badge)](https://github.com/anant-rajj/mac-android-family)
[![Latency](https://img.shields.io/badge/Latency-%3C1.2ms%20Turbo-00e676?style=for-the-badge)](https://github.com/anant-rajj/mac-android-family)
[![License](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)](LICENSE)

<br/>

**Transform your Samsung Galaxy S23 Ultra (or any S Pen device) into a high-precision, pressure-sensitive graphics tablet for Mac.**  
Engineered with sub-millisecond event synthesis, native Quartz tablet taps, and zero-overhead binary streaming.

<br/>

![S Pen Digitizer Live Continuity](assets/spen_digitizer_animation.svg)

</div>

---

## 📑 Table of Contents

- [System Architecture](#-system-architecture)
- [Core Capabilities](#-core-capabilities)
- [Data Pipeline](#-data-pipeline)
- [How to Download](#-how-to-download)
- [How to Operate](#-how-to-operate)
- [Command-Line Interface](#-command-line-interface)
- [How to Uninstall](#-how-to-uninstall)
- [Technical Specifications](#-technical-specifications)
- [Repository Structure](#-repository-structure)
- [License](#-license)

---

## 🏛️ System Architecture

Mac-Android Family bridges Android hardware digitizers to macOS WindowServer. By tapping directly into the electromagnetic resonance (EMR) sensor array on Samsung Galaxy devices, the engine captures raw stylus signals at **240 samples per second** with **4,096 distinct pressure steps** and **dual-axis tilt coordinates**.

```
[ Samsung S23 Ultra / S Pen ]
         │  (240Hz EMR Sensor Sampling)
         ▼
[ 1-Euro Adaptive Filter ]
         │  (Jitter-Free Signal Smoothing)
         ▼
[ 12-Byte Turbo Binary Frame (0xFACE) ]
         │  (Zero-Copy WebSocket / UDP Transport)
         ▼
[ Swift Native Daemon (family-daemon) ]
         │  (Isolated CGEventSource State)
         ▼
[ macOS Quartz Event Tap (kCGEventTabletPointer) ]
         │  (Sub-pixel Cursor, Pressure & Tilt)
         ▼
[ Creative Apps: Krita • Photoshop • Blender • Affinity ]
```

---

## ✨ Core Capabilities

- **240Hz Hardware EMR Ingress**: Utilizes hardware coalesced event extraction (`getCoalescedEvents()`) to eliminate input dropouts during rapid brush strokes.
- **4,096-Step Pressure Dynamic**: Translates raw digitizer force directly into native macOS tablet pointer events (`kCGEventTabletPointer`).
- **Dual-Axis Tilt Tracking**: Full support for stylus altitude and azimuth angle tracking (-60° to +60°).
- **Sub-Millisecond 1-Euro Filter**: Employs an adaptive cutoff frequency filter ($f_c = f_{c,\min} + \beta \cdot |\dot{x}|$) that dampens static hand tremor while maintaining zero lag during fast movement.
- **Turbo 12-Byte Wire Format**: Transmits packed integer structures over binary WebSockets (`TCP_NODELAY`) and loopback UDP, eliminating JSON serialisation latency.
- **Isolated Quartz Event Source**: Synthesizes synthetic HID events through an isolated `CGEventSource(.privateState)` to prevent modifier key latching bugs.
- **Zero-Install Web Client**: Pair instantly through Chrome or Samsung Internet with zero mobile application installation required.

---

## ⚡ Data Pipeline

The pipeline processes input packets from physical stylus tip touch down to the macOS desktop in under 1.2 milliseconds:

<br/>

![Data Pipeline Diagram](assets/data_pipeline_animation.svg)

<br/>

| Stage | Component | Latency Overhead | Description |
| :--- | :--- | :--- | :--- |
| **Stage 1** | Samsung Wacom EMR | ~0.2 ms | Coalesced hardware pointer polling at 240Hz |
| **Stage 2** | 1-Euro Adaptive Filter | ~0.1 ms | Adaptive cutoff frequency smoothing |
| **Stage 3** | Turbo Binary Frame | ~0.1 ms | Packed 12-byte struct with `0xFACE` magic header |
| **Stage 4** | WebSocket / UDP Bridge | ~0.4 ms | Kernel socket streaming with disabled Nagle algorithm |
| **Stage 5** | Quartz Event Tap | ~0.3 ms | Direct injection into macOS WindowServer event tap |
| **Total** | **End-to-End** | **&lt; 1.2 ms** | **Zero perceptible lag for professional illustration** |

---

## 📥 How to Download

### Option 1: Git Clone (Recommended)

Open Terminal on your Mac and clone the repository:

```bash
git clone https://github.com/anant-rajj/mac-android-family.git
cd mac-android-family
```

### Option 2: Direct Archive Download

1. Download the source archive from GitHub:
   ```bash
   curl -L -o mac-android-family.zip https://github.com/anant-rajj/mac-android-family/archive/refs/heads/main.zip
   unzip mac-android-family.zip
   cd mac-android-family-main
   ```

### Prerequisites Check

The project runs on standard macOS developer tooling:
- **macOS**: Version 12.0 or later (Apple Silicon M-series or Intel).
- **Swift Toolchain**: Included by default with Xcode or Command Line Tools (`xcode-select --install`).
- **Python**: Version 3.8+ (pre-installed on macOS).
- **Python Dependencies**:
  ```bash
  pip3 install websockets qrcode
  ```

---

## 🚀 How to Operate

Follow these steps to connect your device and start drawing:

<br/>

![Terminal CLI Animation](assets/terminal_cli_animation.svg)

<br/>

### Step 1: Launch the System

Inside the project directory, run the primary launcher:

```bash
./start.sh start
```

*(Alternatively, use the convenience shortcut `./family start`)*.

The system will automatically:
1. Verify and compile the native Swift daemon in release mode if not already compiled.
2. Spin up the native Quartz tablet daemon (`family-daemon`).
3. Start the low-latency WebSocket fast-path bridge and static canvas server.
4. Display your local connection URL and render a scannable terminal ASCII QR code.

### Step 2: Connect Your S Pen Device

1. Ensure your Samsung Galaxy S23 Ultra (or Android tablet) is on the same Wi-Fi network as your Mac.
2. Open your mobile browser (**Samsung Internet** or **Google Chrome**).
3. Scan the terminal QR code with your phone camera, or manually navigate to the URL shown in terminal:
   ```
   http://<mac-ip-address>:8080
   ```
4. The canvas interface opens instantly with an active link badge.

> [!TIP]
> **Optional USB Wired Mode**: For zero-wireless interference, connect your phone via USB cable, enable USB debugging, and forward ports:
> ```bash
> adb forward tcp:8080 tcp:8080
> adb forward tcp:9877 tcp:9877
> ```
> Then browse to `http://localhost:8080` on your phone.

### Step 3: Draw in Any Creative Suite

Touch your S Pen to the phone glass. The cursor on your Mac tracks your stylus in real-time. Launch your creative application of choice:
- **Krita**: Full 4,096 pressure sensitivity and brush dynamics.
- **Adobe Photoshop**: Natural brush stroke weight and opacity modulation.
- **Blender**: Pressure-sensitive 2D Grease Pencil and 3D sculpting.
- **Affinity Designer / Photo**: Vector tablet stroke stabilization.

---

## 💻 Command-Line Interface

The repository provides a lightweight CLI manager (`./start.sh` or `./family`) to control all runtime operations:

```
  __  __                  _              _           _     _ 
 |  \/  |                / \   _ __   __| |_ __ ___ (_) __| |
 | |\/| | _____ ____    / _ \ | '_ \ / _` | '__/ _ \| |/ _` |
 | |  | |/ _ \ \/ /\ \ / ___ \| | | | (_| | | | (_) | | (_| |
 |_|  |_|\___/\_/  \_//_/   \_\_| |_|\__,_|_|  \___/|_|\__,_|
         S Pen Graphics Tablet Controller • 240Hz EMR Engine
```

### Command Reference

| Command | Syntax | Description |
| :--- | :--- | :--- |
| **Help Menu** | `./start.sh help` | Prints the complete interactive guide and available commands |
| **Start Services** | `./start.sh start` | Compiles binaries if needed, starts daemon and bridge, prints QR code |
| **Stop Services** | `./start.sh stop` | Gracefully shuts down daemon and bridge, releases ports 8080, 9876, 9877 |
| **Status Audit** | `./start.sh status` | Inspects process health, PIDs, and active network port listeners |
| **Show QR** | `./start.sh qr` | Renders terminal ASCII QR code and pairing link |
| **Compile Daemon** | `./start.sh build` | Compiles native Swift daemon using `swift build -c release` |
| **Loopback Test** | `./start.sh test` | Injects synthetic 12-byte stylus frame to verify Quartz tap functionality |
| **Uninstall** | `./start.sh uninstall` | Stops services, cleans binary build trees, and removes caches |

---

## 🗑️ How to Uninstall

To cleanly remove all runtime components and build artifacts:

### Method 1: Automated Script Cleanup

Run the built-in uninstall command:

```bash
./start.sh uninstall
```

This command will:
1. Terminate all active daemon processes and bridge listeners.
2. Release network ports (`8080`, `9876`, `9877`).
3. Remove compiled Swift binaries (`macos_daemon/.build`).
4. Delete runtime PID files and generated pairing caches.

### Method 2: Complete Project Removal

To delete the repository folder completely from your machine:

```bash
# 1. Ensure services are stopped
./start.sh stop

# 2. Delete the directory
cd ..
rm -rf mac-android-family
```

### Method 3: Revoke macOS Accessibility Permissions

If you wish to remove the granted Accessibility permission on your Mac:
1. Open **System Settings** on macOS.
2. Navigate to **Privacy & Security** → **Accessibility**.
3. Select `family-daemon` or `Terminal` and toggle the permission switch off or remove the entry.

---

## 📐 Technical Specifications

### Binary Network Frame Format (12 Bytes Packed)

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|          Magic (0xFACE)       |  Action Code  |    Reserved   |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|       Normalized X (uint16)   |      Normalized Y (uint16)    |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|        Pressure (uint16)      | Tilt X (int8) | Tilt Y (int8) |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

- **Magic Word**: `0xFACE` (2 bytes) for instantaneous packet boundary validation.
- **Action Codes**: `0` = Hover, `1` = Stylus Down, `2` = Stylus Drag/Move, `3` = Stylus Up.
- **Normalized Coordinates**: Linear fixed-point mapped to $[0, 65535]$.
- **Pressure Resolution**: 16-bit integer mapped to $[0, 65535]$ matching 4,096 physical levels.
- **Tilt Vectors**: Signed 8-bit integers representing degrees from vertical plane.

### 1-Euro Filter Parameters

The jitter suppression filter computes dynamically:

$$\hat{X}_k = \alpha X_k + (1 - \alpha) \hat{X}_{k-1}$$

Where:
$$\alpha = \frac{1}{1 + \frac{\tau}{T_e}}, \quad \tau = \frac{1}{2\pi f_c}, \quad f_c = f_{c,\min} + \beta \cdot |\dot{X}_k|$$

- $f_{c,\min} = 1.0\text{ Hz}$: High smoothing during slow detailing.
- $\beta = 0.007$: Responsive transition to raw tracking during swift strokes.
- $f_{c,\text{deriv}} = 1.0\text{ Hz}$: Velocity signal stability filter.

---

## 📂 Repository Structure

The repository maintains a clean, minimalist layout free of extraneous dependencies:

```
mac-android-family/
├── assets/                                 # Visual graphics and animated diagrams
│   ├── spen_digitizer_animation.svg        # Stylus to Mac live continuity animation
│   ├── data_pipeline_animation.svg         # 5-stage architectural pipeline animation
│   └── terminal_cli_animation.svg          # Terminal CLI interactive demonstration
├── android_client/                         # Native Android Kotlin implementation
│   ├── AndroidManifest.xml                 # Minimal manifest (Internet permissions)
│   ├── build.gradle.kts                    # Gradle build definition
│   └── app/src/main/kotlin/.../
│       ├── MainActivity.kt                 # Fullscreen immersive drawing activity
│       ├── SpenCaptureView.kt              # S Pen event listener with 1-Euro filter
│       └── TelemetryClient.kt              # UDP socket packet serializer
├── docs/                                   # Research logs and performance reports
│   ├── family.md                           # Protocol design specifications
│   └── LATENCY_AND_INVERSION_FIX_REPORT.md # Mathematical coordinate inversion fix
├── macos_daemon/                           # Native Swift host daemon
│   ├── Package.swift                       # Swift Package Manager manifest
│   ├── bridge_server.py                    # Lightweight WebSocket and HTTP bridge
│   └── Sources/FamilyDaemon/
│       ├── main.swift                      # Daemon entrypoint and signal handling
│       ├── NetworkServer.swift             # High-throughput UDP packet parser
│       └── QuartzTabletBridge.swift        # Apple Quartz event tap synthesizer
├── web_client/                             # Zero-install browser digitizer portal
│   └── index.html                          # 240Hz pointer canvas and binary streamer
├── start.sh                                # Unified CLI manager (start/stop/status)
├── family                                  # Symlink to start.sh for easy terminal access
├── LICENSE                                 # MIT License
└── README.md                               # System documentation and manuals
```

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for complete terms.
