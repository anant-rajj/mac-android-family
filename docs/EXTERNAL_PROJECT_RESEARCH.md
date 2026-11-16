# External Project Research: Prior-Art Failure & Architecture Analysis

**Project:** Mac-Android Family  
**Author:** Antigravity (Senior macOS/Android Systems & Performance Engineer)  
**Date:** November 2026  
**Scope:** Android-to-Desktop Graphics Tablets, S Pen Input Systems, Trackpad Emulation, and Low-Latency Remote Input Injection.

---

## Executive Summary

Building a responsive, high-fidelity digitizer bridge between a Samsung Galaxy device (such as the Galaxy S23 Ultra) and macOS requires solving intricate synchronization, OS event dispatch, protocol serialization, geometric mapping, and gesture disambiguation challenges. Over the last decade, open-source and commercial developers have attempted various approaches:
1. **Dedicated native client/daemon architectures** with custom UDP/TLS protocols (e.g., **PenBridge**).
2. **Browser-based canvas clients** with WebSocket transports (e.g., **Weylus**).
3. **Hardware-level peripheral emulation** using Bluetooth HID or USB Gadget drivers (e.g., **VirtualTablet: Bluetooth**).
4. **General remote input/touchpad bridges** (e.g., **Slide Android**).

This research document analyzes the empirical engineering records, Architecture Decision Records (ADRs), bug reports, commit histories, platform specifications, and documented failures of these reference projects to extract concrete architectural lessons for `mac-android-family`.

---

## 1. Deep Dive: PenBridge (`Blake11/PenBridge`)

### 1.1 Project Overview & System Topology
- **Repository:** `https://github.com/Blake11/PenBridge`
- **Architecture:** .NET 10 LTS with a shared cross-platform Core (`PenBridge.Core`) implementing protocol serialization, cryptography, input state tracking, and gesture recognition. Native platform heads provide OS glue:
  - **Android:** Kotlin/C# immersive `DrawSurfaceView` handling native Wacom EMR `MotionEvent`s directly from the Linux evdev kernel driver.
  - **macOS:** Native daemon using CoreGraphics `CGEvent` APIs running as a NativeAOT-compiled binary with zero runtime garbage collection.
- **Transport Architecture (ADR-0004, ADR-0012, ADR-0038):**
  - **Control Channel:** TLS 1.2+ over TCP (default port `47820`) for mDNS/Bonjour discovery, pairing, display geometry negotiation, and settings synchronization.
  - **Input Channel:** Encrypted UDP datagrams (AES-256-GCM) with fixed header (`0x42` magic), session ID, 64-bit sequence number, timestamp in microseconds (`timeUs`), and bit-packed input payloads.
  - **Screen Mirroring (ADR-0038):** Dedicated secondary UDP socket with hardware HEVC/H.264 encoding via macOS `ScreenCaptureKit` / `VideoToolbox` and Android hardware decoding via `MediaCodec`.

```
[ Galaxy S23 Ultra ]                          [ Apple Silicon Mac ]
+-------------------------+                   +-------------------------+
| DrawSurfaceView         |                   | FamilyDaemon / Host     |
| (240Hz Wacom Digitizer) |                   | (CoreGraphics CGEvent)  |
+------------+------------+                   +------------+------------+
             |                                             ^
             | UDP Datagrams (AES-256-GCM, DSCP EF)        |
             +=============================================+
             | Control Channel (TLS 1.2+ TCP, Port 47820)  |
             +---------------------------------------------+
```

---

### 1.2 Wire Protocol & Telemetry Layout

The PenBridge input channel uses a compact binary framing designed for zero-allocation parsing:
- **Magic Byte:** `0x42` (ASCII 'B').
- **Header:** 1-byte Packet Type (`0x01` Sample, `0x02` Ping, `0x03` Pong, `0x04` Keepalive), 4-byte Session ID, 8-byte Monotonic Sequence Number, 8-byte Microsecond Timestamp (`timeUs`).
- **Input Sample Payload:**
  - `uint16_t normX` (0..65535, mapped across phone surface).
  - `uint16_t normY` (0..65535, mapped across phone surface).
  - `uint16_t pressure` (0..65535, 16-bit linear hardware pressure).
  - `int16_t tiltX` (-9000..+9000, degrees $\times 100$).
  - `int16_t tiltY` (-9000..+9000, degrees $\times 100$).
  - `uint8_t toolType` (0 = Unknown, 1 = Stylus Pen, 2 = Stylus Eraser, 3 = Finger Touch).
  - `uint8_t buttonMask` (Bit 0 = Contact/Tip down, Bit 1 = Barrel/Primary side-button, Bit 2 = Secondary button).
  - `uint8_t touchCount` & `TouchRecord[4]` (multi-touch contact records for fingers).
  - `uint8_t historyCount` followed by intermediate sample delta frames.
- **Security & Integrity:** Datagram payload is authenticated and encrypted using AES-256-GCM with a 12-byte IV derived from sequence numbers, preventing packet injection and replay attacks on open Wi-Fi networks.

---

### 1.3 Key Architectural Decision Records (ADRs) & Engineering Lessons

#### ADR-0003: macOS Input via CGEvent Tablet Events
- **Context:** macOS creative applications (Adobe Photoshop, Krita, Clip Studio Paint, Affinity Designer, Blender) expect Wacom-style digitizer events.
- **Implementation:** Posts a `kCGEventTabletProximity` event when the stylus enters proximity, followed by mouse down/drag/up/move events carrying `mouseEventSubtype = 1` (`kCGEventMouseSubtypeTabletPoint`).
- **Fields Posted:**
  - `tabletEventPointPressure`: 16-bit integer `[0..65535]`.
  - `tabletEventTiltX` and `tabletEventTiltY`: Double values in degrees `[-90..+90]`.
  - `tabletEventDeviceID`: 1.
- **Critical Lesson:** Standard mouse events (`leftMouseDown`, `leftMouseDragged`, `mouseMoved`) must carry the tablet point subtype and pressure fields on the *same* event; posting separate tablet events without the mouse event causes drawing tools to ignore strokes or misplace coordinates.

#### ADR-0017 / Issue #17 & #244: Dropping DriverKit Virtual HID Digitizer
- **Context:** Issue #17 originally investigated building an Apple DriverKit extension (`IOUserHIDEventService`) to simulate a genuine USB Wacom tablet at the kernel/driver level, aiming to support applications that bypass `CGEvent` taps.
- **Outcome & Failure Analysis:** Dropped from the roadmap in commit `c3e4bc0`.
  1. *Entitlements Barrier:* DriverKit requires explicit, signed driver entitlements from Apple (`com.apple.developer.driverkit`), which are restricted and unavailable to independent open-source developers without corporate verification.
  2. *Security & Deployment Burden:* DriverKit extensions require users to disable System Integrity Protection (SIP) or install kernel extensions through complex Security & Privacy approval flows.
  3. *Empirical Finding:* Testing across all major creative apps (Photoshop, Krita, Blender, Illustrator, GIMP) confirmed that `CGEvent` with `TabletPoint` subtype was universally recognized without driver-level virtualization.

#### ADR-0022 & ADR-0026: S Pen vs. Finger Mode Disambiguation (Issues #90, #91, #124, #131)
- **Problem:** When fingers touch the screen, should they draw, click, or move the cursor relatively like a trackpad?
- **Failure Experience (Issue #91):** In early versions, a finger contact immediately posted mouse down, which caused accidental drawing strokes when users rested their hand or tried to navigate.
- **Solution (ADR-0022, ADR-0026, ADR-0027):**
  - **Stylus Priority:** As long as S Pen is within proximity (`isSpenInProximity == true`), all finger and palm touches are discarded.
  - **One-Finger Relative Cursor (`FingerTouches`, Protocol 1.1):** When pen is out of range, one finger acts as a trackpad. Raw finger coordinates are converted to relative deltas (`PointerMove`) on macOS.
  - **Settle Window (ADR-0027):** A 100 ms settle window with `PointerSlop` (1.5%) prevents accidental cursor drift during finger tap or staggered two-finger landing.
  - **Tap-to-Click:** Tap duration $\le 200\text{ ms}$ with movement $\le 2\%$ posts a left click. Second tap within 300 ms posts double-click; tap-and-hold latches a drag.

#### ADR-0023: Trackpad-Parity Gestures on macOS (Commit `935940c`)
- **Principle:** Match macOS Magic Trackpad behavior with three-finger drag.
- **Cursor Invariance:** Gestures act at the *current cursor position*, which remains completely stationary during two-finger scrolling, pinch-to-zoom, and four-finger navigation. Only three-finger drag moves the cursor.
- **Two-Finger Scroll:** Continuous whole-pixel scroll-wheel events with scroll phases (`kCGScrollPhaseBegan`, `kCGScrollPhaseChanged`, `kCGScrollPhaseEnded`), plus swipe companion events to support Safari/Finder back/forward page swiping.
- **Momentum:** Coasting momentum on a one-shot timer that aborts immediately upon new contact or cancel.
- **Four-Finger System Gestures:** Up = Mission Control (`⌃↑`), Down = App Exposé (`⌃↓`), Left/Right = Spaces (`⌃←`/`⌃→`), Spread = Show Desktop (`F11`), Pinch = Launchpad (`NSWorkspace`).

#### ADR-0024 & Issue #114: Palm Rejection & Platform Cancel Bug (Commit `daf0c9b`)
- **Exact Problem:** When a user rested their palm on the S23 Ultra while two fingers were down, the phone suppressed the touches. The Mac server interpreted the sudden absence of touch datagrams as a finger lift, immediately triggering a false right-click tap! Additionally, mid-scroll palm interference caused the scroll to end with high-velocity momentum fling instead of aborting cleanly.
- **Technical Cause:** Android's `InputFilter` dropped suppressed touches locally, so the UDP wire saw the touch stream cease abruptly.
- **The Fix (Commit `daf0c9b`):**
  1. Suppressed touches stay on the wire with `Contact = false` until physical lift.
  2. The Mac receives `Contact = false` and cancels the gesture (cancels Tap candidate, aborts momentum).
  3. Android explicitly forwards `ACTION_CANCEL` (`cancelAll`) rather than guessing from per-pointer flags, because `TOOL_TYPE_PALM` pointers are marked canceled on every frame.

#### ADR-0031 & Issue #127: Screen Aspect-Ratio Mapping & Active Area (Commit `5769193`)
- **Exact Problem:** The Galaxy S23 Ultra has an ultrawide aspect ratio of **19.3:9** (~2.14:1). Typical Mac displays have **16:10** (MacBook Air 2560×1664) or **16:9** (1920×1080). Naively stretching normalized coordinates `normX * screenWidth` and `normY * screenHeight` causes severe geometric distortion: drawing a circle on the phone results in an ellipse on the Mac, and the pen cannot reach the top and bottom borders in landscape orientation.
- **The Fix: Active Area Calculation:**
  $$\text{Target Aspect} = \frac{W_{\text{display}}}{H_{\text{display}}}$$
  $$\text{Phone Aspect} = \frac{W_{\text{phone}}}{H_{\text{phone}}}$$
  $$\text{If } \text{Phone Aspect} > \text{Target Aspect}: \quad W_{\text{active}} = H_{\text{phone}} \times \text{Target Aspect}, \quad H_{\text{active}} = H_{\text{phone}}$$
  $$\text{If } \text{Phone Aspect} < \text{Target Aspect}: \quad W_{\text{active}} = W_{\text{phone}}, \quad H_{\text{active}} = \frac{W_{\text{phone}}}{\text{Target Aspect}}$$
  The active drawing area is centered on the phone screen with faint L-shaped corner tick marks. Coordinates outside the active area are clamped to the target display's edge.

#### ADR-0032: Pen Settings & Pressure Curves
- **Tip Feel Curve:** Nonlinear gamma transformation:
  $$\text{output} = \left(\frac{p - \text{threshold}}{\text{full} - \text{threshold}}\right)^{2^{\text{tipFeel}}}$$
- **Hysteresis:** A 0.02 release hysteresis on `clickThreshold` prevents pressure jitter near zero from rapidly toggling `leftMouseDown` / `leftMouseUp`.

#### ADR-0038: Screen Mirroring QoS & Wire Priorities
- **Transport Separation:** Video and input are transmitted over separate UDP sockets.
- **QoS Priority:** Input datagrams use DSCP `EF` (`IPTOS_PREC_CRITIC_ECP` / WMM Voice). Video fragments use DSCP `AF41` (WMM Video).
- **Rule:** Input thread priority is strictly pinned above video capture/encoding on macOS, and above decoding on Android. When network degradation is detected, video bitrate and framerate are dynamically throttled to ensure zero dropped pen packets.

---

## 2. Deep Dive: VirtualTablet (SunnySideSoft)

### 2.1 Project Evolution: Wi-Fi to Bluetooth HID
- **Original Architecture:** The original VirtualTablet relied on a Wi-Fi companion server running on the desktop (Windows/macOS) and an Android app streaming coordinates over TCP/UDP.
- **Failure Modes Documented by Developer (Reddit `1p3xds5`):**
  1. *Network Jitter & Bufferbloat:* On congested 2.4GHz Wi-Fi networks, packet arrival jitter led to visible stuttering during fast curves or handwriting.
  2. *Firewall & Network Isolation:* Users in universities, corporate networks, and public Wi-Fi frequently suffered connection failures due to AP client isolation blocking UDP broadcast and direct socket connections.
  3. *Driver Compatibility on macOS:* macOS security restrictions (accessibility permissions, notarization, and background daemon sleep) made maintaining a custom desktop daemon fragile across macOS updates.
- **The Bluetooth HID Transition:**
  The developer rebuilt the client as a standalone **Bluetooth HID peripheral** (*VirtualTablet: Bluetooth*).
  - *No Desktop Daemon:* The Android phone registers as a standard Bluetooth Human Interface Device (Digitizer / Stylus profile).
  - *Native OS Driver Recognition:* Windows, macOS, Linux, and Android natively decode standard HID Digitizer report descriptors. On macOS, `IOHIDFamily` automatically generates `NSEventTypeTabletPoint` and `NSEventTypeTabletProximity` events.
  - *Zero Setup:* No server installation, no IP configuration, and no firewall traversal required.

### 2.2 VirtualTablet Engineering Limitations
1. **Bandwidth Constraint:** Bluetooth Classic/BLE has strict packet rate and throughput limits. While sufficient for 60–120Hz coordinate streams, it is incapable of carrying video data for screen mirroring.
2. **OS Pairing Friction:** Re-pairing Bluetooth across multiple computers or switching between phone mode and tablet mode requires unpairing and re-negotiating the Bluetooth link.
3. **Multi-Monitor Mapping Deficiencies (Reddit `1w22daz`):** Without a desktop companion daemon to query `CGGetActiveDisplayList()`, a raw Bluetooth HID digitizer can only map its coordinates to the global virtual desktop bounding box, making multi-monitor targeting impossible without desktop-side software.

---

## 3. Deep Dive: Weylus (`H-M-H/Weylus`)

### 3.1 Project Architecture
- **Repository:** `https://github.com/H-M-H/Weylus`
- **Architecture:** Rust backend running a local web server (Actix-web) and WebSocket endpoint. The client is a zero-install HTML5/TypeScript web application running inside mobile browsers (Safari on iPad, Chrome/Firefox on Android).
- **Screen Capture:** Hardware-accelerated desktop capture using `x11cap` (Linux), `CoreGraphics` / `ScreenCaptureKit` (macOS), or `Desktop Duplication API` (Windows), encoded to H.264/H.265 and streamed via WebSocket to an HTML5 `<video>` element.

### 3.2 Critical Failure Points Identified

#### 1. Severe macOS Stylus Limitations (`autopilot_device.rs`)
Inspection of `Weylus/src/input/autopilot_device.rs` reveals a major limitation on macOS:
```rust
if let Err(err) = mouse::move_to(autopilot::geometry::Point::new(
    (event.x * width_rel + x_rel) * width,
    (event.y * height_rel + y_rel) * height,
)) {
    warn!("Could not move mouse: {}", err);
}
match event.button {
    Button::PRIMARY => {
        mouse::toggle(mouse::Button::Left, event.buttons.contains(event.button))
    }
    // ...
}
```
- Weylus relies on the third-party `autopilot` crate for macOS input injection.
- It only implements `mouse::move_to()` and `mouse::toggle(Button::Left, state)`.
- **Result:** On macOS, Weylus **drops all stylus pressure, drops all tilt angles, and drops tablet proximity events entirely!** Stylus input is degraded into an ordinary binary mouse click.

#### 2. Browser-Engine S Pen Incompatibility (Discussion #325 & Mozilla Bugzilla #2082728)
User reports in Weylus Discussion #325 and Mozilla Bugzilla demonstrate significant discrepancies between Android browsers:
- **Firefox for Android (GeckoView):**
  - Bug #2082728 / Bug #1702482: When an S Pen hovers above the screen, Firefox incorrectly classifies `pointerType` as `"touch"` instead of `"pen"`.
  - Hover events (`pointerenter`, `pointermove` with `buttons == 0`) are frequently dropped or deferred until physical screen contact occurs.
  - S Pen pressure sensitivity is zeroed or delivered as binary `0` or `1`.
- **Samsung Internet & Google Chrome (Blink/Chromium):**
  - Properly dispatches W3C `PointerEvent` with `pointerType: "pen"`, valid `pressure` `[0.0..1.0]`, and `tiltX`/`tiltY`.
  - Supports hover movement before contact.

#### 3. DOM HUD Dead Zones & Web Writing Surface Distortion
- In browser-based stylus pads, placing HUD controls, navigation bars, or buttons over the canvas creates invisible or visible dead zones where touch events are swallowed by the UI overlay (`pointer-events: auto`).
- Mobile browsers frequently apply dynamic viewport resizing (address bar hiding/showing), causing the canvas coordinate coordinate transformation matrix to drift during drawing.

---

## 4. Deep Dive: Slide Android (`lkuich/slide-android`)

### 4.1 Architecture & Input Separation
- **Repository:** `https://github.com/lkuich/slide-android`
- **Architecture:** Android Java client connecting over TCP/UDP to a desktop companion application.
- **Key Implementation Patterns:**
  - Implements explicit separation between **Absolute Positioning** (`PositioningMode.ABSOLUTE`) and **Relative Touchpad** (`PositioningMode.RELATIVE`).
  - `CanvasView.java` and `Controller.java` track touch gestures and send packed command bytes:
    - Packet format: `[CommandByte, Subcommand, PayloadX, PayloadY, Extra]`.
    - Coordinates are normalized to screen DPI to decouple client resolution from host desktop resolution.
- **Failure Points Identified:**
  1. *Missing Historical Samples:* `CanvasView.java` does not process Android `MotionEvent` historical samples (`event.getHistoricalX(pos)`). During fast brush movements, high-frequency samples generated by the digitizer hardware are discarded by the Android event loop, resulting in polygonal, jagged strokes on the desktop.
  2. *Relative Drift Accumulation:* In relative mode, deltas are computed as raw differences from the last recorded position without floating-point accumulation or acceleration curves, leading to sluggish cursor travel on high-resolution displays.
  3. *Deprecated SDK Dependency:* Relied on the proprietary Samsung S-Pen SDK (`libspen23.jar`), which broke on modern Android versions (Android 10+) where standard `MotionEvent` replaced vendor-specific libraries.

---

## 5. Independent Video Demonstrations & Field Case Studies

### 5.1 TekZoom Demonstration (`-6UXeqDc_zw`)
- **Observed Workflow:** User connects an Android tablet as a secondary graphics pad to a laptop over Wi-Fi.
- **Failures & Ergonomic Bottlenecks Identified:**
  1. *Severe Stroke Latency & Rubber-Banding:* Brush strokes on the host screen lagged behind the physical pen by an estimated 120–180 ms. Fast zigzag strokes resulted in acute rubber-banding, where the desktop stroke caught up only after the user lifted the pen.
  2. *Cursor Jump on Contact:* Because hover tracking was disabled or unsupported, the desktop cursor remained parked at its last position. When the pen touched the screen, the cursor snapped abruptly to the contact point, frequently generating a stray line segment connecting the old and new coordinates.
  3. *Palm Interference:* Resting the heel of the hand on the tablet screen caused the cursor to jitter erratically between the pen tip and the palm center, ruining stroke continuity.

### 5.2 Android-as-Monitor Demonstration (`F9lvNzRVMsA`)
- **Observed Workflow:** Streaming desktop video to an Android device while capturing touch input.
- **Failures & Ergonomic Bottlenecks Identified:**
  1. *Aspect-Ratio Warping:* The 16:9 desktop feed was stretched across a wider mobile screen, compressing UI elements and distorting user drawing geometry.
  2. *Bandwidth Contention:* Input packets and high-bitrate video shared an unprioritized Wi-Fi connection. High-motion scenes caused input packets to be delayed or dropped, producing frozen strokes and dropped clicks.

---

## 6. Official Platform Documentation & Hardware Specifications

### 6.1 Android Wacom EMR Digitizer Specifics (Galaxy S23 Ultra)
1. **Sampling Frequency:** The Samsung Galaxy S23 Ultra digitizer hardware samples S Pen input at **240 Hz**, while the UI refresh rate is 120 Hz.
2. **Historical Samples:** Because 240 Hz events outpace the 120 Hz UI thread dispatch, Android batches multiple physical samples into a single `MotionEvent`. Developers must iterate through `event.historySize`:
   ```kotlin
   for (h in 0 until event.historySize) {
       val histX = event.getHistoricalX(0, h)
       val histY = event.getHistoricalY(0, h)
       val histP = event.getHistoricalPressure(0, h)
       val histTime = event.getHistoricalEventTime(h)
       dispatchIntermediateSample(histX, histY, histP, histTime)
   }
   dispatchCurrentSample(event.x, event.y, event.pressure, event.eventTime)
   ```
   Failing to process historical samples discards up to 50% of coordinate data.
3. **Unbuffered Dispatch:** `View.requestUnbufferedDispatch(event)` must be called on `ACTION_DOWN` to bypass WindowManager event coalescing and minimize input latency.
4. **Hover Lifecycle:** S Pen proximity events are delivered strictly via `onHoverEvent()` and `onGenericMotionEvent()`:
   - `ACTION_HOVER_ENTER`: Pen enters ~1.5 cm detection field.
   - `ACTION_HOVER_MOVE`: Pen moves within proximity field. Pressure is strictly 0.0.
   - `ACTION_HOVER_EXIT`: Pen exits detection field.
   - `ACTION_DOWN`: Pen tip physically touches screen. Transition from hover to down must preserve exact coordinates to eliminate cursor jumping.

### 6.2 macOS CoreGraphics Injection Constraints
1. **Event Tap State:** Creating `CGEventSource(stateID: .privateState)` is mandatory to prevent virtual events from latching modifier keys (Shift, Command, Option) into the physical keyboard state.
2. **Cursor Warping vs. Moving:** Calling `CGWarpMouseCursorPosition()` while simultaneously posting `kCGEventMouseMoved` causes cursor tearing, acceleration discrepancies, and jitter. `CGWarpMouseCursorPosition` disables cursor acceleration curves and should only be used to re-anchor the cursor when entering proximity in relative mode.
3. **Display Clamping:** Coordinates posted via `CGEvent` to a specific display coordinate space must be clamped to `CGDisplayBounds(displayID)` minus 1 pixel to prevent the macOS WindowServer from wrapping or jumping the cursor to an adjacent monitor.

---

## 7. Comprehensive Architectural Comparison

| Characteristic | PenBridge | VirtualTablet (BT) | Weylus | Slide Android |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Transport** | Encrypted UDP + TLS | Bluetooth HID | WebSocket (TCP) | UDP / TCP |
| **macOS Digitizer API** | `CGEvent` TabletPoint | Native IOHIDFamily | `autopilot` (Mouse only) | Java Robot (Mouse) |
| **S Pen Pressure** | Full (16-bit) | Full (HID report) | None on macOS | Partial |
| **S Pen Tilt** | Full (Tilt X/Y) | Full (HID report) | None on macOS | None |
| **S Pen Hover** | Full Proximity/Move | Full Proximity/Move | Browser-dependent | None |
| **Aspect-Ratio Match** | Active Area (centered) | Global stretching | CSS canvas fit | Fixed scaling |
| **Multi-Monitor** | Target display / All | Entire virtual desktop | Window / Screen | Target screen |
| **Trackpad Gestures** | Trackpad parity | None (Digitizer only) | Scroll only | Basic scroll |
| **Screen Mirroring** | ScreenCaptureKit (UDP) | None (bandwidth) | WebRTC / Video (TCP) | None |
| **Physical S23 Ultra Tested** | Yes (Verified #66) | Yes | Community tested | Generic |
