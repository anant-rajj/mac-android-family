# Architecture Gap Analysis: Mac-Android Family vs. Prior Art

**Project:** Mac-Android Family  
**Author:** Antigravity (Senior macOS/Android Systems & Performance Engineer)  
**Date:** November 2026  
**Target Device:** Samsung Galaxy S23 Ultra (Snapdragon 8 Gen 2, 240 Hz Wacom EMR Digitizer, One UI 6/7/8)  
**Target Host:** Apple Silicon MacBook Air (macOS 27.x, Liquid Retina Display, Multi-Monitor Support)

---

## 1. Overview & Comprehensive Comparison Matrix

This document provides a rigorous, subsystem-by-subsystem gap analysis between empirical findings from reference projects (**PenBridge**, **VirtualTablet**, **Weylus**, and **Slide Android**) and the current implementation of **Mac-Android Family** (`macos_daemon`, `android_client`, and `web_client`).

| Subsystem / Feature | Research Finding & Prior-Art Solution | Existing Implementation in `mac-android-family` | Risk Level | Recommended Architectural Correction |
| :--- | :--- | :--- | :--- | :--- |
| **Aspect-Ratio Preservation** | **ADR-0031:** Centered Active Area matching target monitor aspect ratio prevents geometric distortion. Outer margins are clamped. | **Linear Stretch:** `normX * width`, `normY * height` in `QuartzTabletBridge.swift`. | **P0** (Correctness) | Implement Active Area computation. Calculate display ratio; letterbox/pillarbox inactive margins on phone. |
| **240 Hz Historical Samples** | S23 Ultra digitizer samples at 240 Hz; Android coalesces them into `event.historySize` during 120 Hz UI ticks. | **Latest-Sample Only:** `SpenCaptureView.kt` only reads `event.x`/`event.y`; ignores historical points. | **P1** (Input Quality) | Loop through `0 until event.historySize` on `ACTION_MOVE` and stream every intermediate sample. |
| **Palm Rejection Wire Protocol** | **ADR-0024:** Suppressed touches remain on wire with `Contact = false` to prevent false Tap on release. | **Local Drop Only:** `SpenCaptureView.kt` consumes touches locally; daemon has no contact-state tracking. | **P0** (Correctness) | Transmit contact state in UDP packet. When contact becomes false without lift, abort active gestures and right-clicks. |
| **Hover Cursor Positioning** | Rely exclusively on `.mouseMoved` with `TabletPoint` subtype. Never call `CGWarpMouseCursorPosition` during hover. | **Constant Warping:** `QuartzTabletBridge.swift` calls `CGWarpMouseCursorPosition` on every single hover event. | **P1** (Input Quality) | Remove `CGWarpMouseCursorPosition` from hover path. Rely exclusively on `.mouseMoved` with `TabletPoint` subtype. |
| **Unbuffered Event Dispatch** | Call `view.requestUnbufferedDispatch(event)` on `ACTION_DOWN` to bypass WindowManager coalescing. | **Buffered Dispatch:** `SpenCaptureView.kt` does not call `requestUnbufferedDispatch()`. | **P1** (Input Quality) | Call `requestUnbufferedDispatch(event)` on `ACTION_DOWN` in `SpenCaptureView.kt`. |
| **DOM Canvas Dead Zones** | Set `pointer-events: none` on all informational overlays; isolate buttons outside active drawing boundary. | **Overlapping HUD:** `#hud`, `#controls-bar`, and `#bottom-bar` have `pointer-events: auto` over canvas. | **P3** (Ergonomics) | Set `pointer-events: none` on all informational overlays; isolate buttons outside the active drawing boundary. |
| **Browser Stylus Misclassification** | Mozilla Bug 2082728: Firefox Android reports S Pen as `touch`, losing pressure/hover. | **Generic Pointer Events:** `web_client/index.html` relies on standard W3C Pointer Events without browser guards. | **P1** (Input Quality) | Add browser engine detection. Warn user when running under Gecko/Firefox; enforce Chromium/Samsung Internet. |
| **Multi-Monitor Edge Bleed** | Clamp to `[minX, maxX - 1]` and `[minY, maxY - 1]` to prevent cursor bleeding into adjacent screens. | **Clamping to `maxX`:** Clamps to `screenBounds.maxX`, which equals `minX` of right adjacent display. | **P0** (Correctness) | Refine clamp to `maxX - 1` and `maxY - 1` in `QuartzTabletBridge.swift`. |
| **Trackpad Gesture Parity** | **ADR-0023:** Two-finger scroll with scroll phases & momentum; pinch zoom; 3-finger drag; 4-finger spaces. | **Basic Scroll Only:** Only basic mouse wheel scroll event without continuous phases or momentum. | **P2** (Feature Parity) | Implement continuous scroll phases (`kCGScrollPhaseBegan/Changed/Ended`) and momentum timer. |
| **Input vs. Control Transport** | Stateless UDP with DSCP `EF` QoS for real-time input; TCP/TLS for control & handshake. | **Dual Stack:** Swift daemon uses UDP on 47820 (`NetworkServer.swift`); Python bridge uses WebSocket (`bridge_server.py`). | **P2** (Reliability) | Unify input pipeline around the native UDP server (`NetworkServer.swift`); reserve WebSocket for web fallback only. |
| **Event Tap Modifier Isolation** | Use `CGEventSource(stateID: .privateState)` to prevent synthetic events from corrupting modifier keys. | **Private Source Used:** `CGEventSource(stateID: .privateState)` instantiated in `QuartzTabletBridge.swift`. | **PASS** (Correct) | Retain private event source; keep modifier flag sanitization logic. |
| **Asymmetric Pressure Filter** | Clamp sudden downward pressure drops during rapid strokes to prevent premature line breakage. | **Implemented in Kotlin:** `SpenCaptureView.kt` implements distance-based pressure drop clamping. | **PASS** (Correct) | Retain filter; ensure epsilon and brush scale parameters match desktop brush dynamics. |
| **1-Euro Jitter Filter** | Adaptive low-pass filter suppresses sensor noise during slow moves while preserving instant response. | **Implemented in Kotlin:** Casiez 1-Euro filter ($f_c = 1.0\text{ Hz}$, $\beta = 0.007$) active in `SpenCaptureView.kt`. | **PASS** (Correct) | Retain 1-Euro filter on coordinate path. |

---

## 2. System-by-System Deep Dive & Gap Analysis

### 2.1 Android S Pen Capture Subsystem (`android_client/`)

#### Current Architectural Implementation:
- `SpenCaptureView.kt` overrides `onHoverEvent()` and `onGenericMotionEvent()` to capture `ACTION_HOVER_ENTER`, `ACTION_HOVER_MOVE`, and `ACTION_HOVER_EXIT`.
- Overrides `onTouchEvent()` to capture `ACTION_DOWN`, `ACTION_MOVE`, and `ACTION_UP`.
- Evaluates `event.getToolType(0) == MotionEvent.TOOL_TYPE_STYLUS` to separate pen from touch.
- Passes coordinates through a 1-Euro adaptive low-pass filter.
- Normalizes coordinates to `[0.0..1.0]` based on `view.width` and `view.height`.

#### Identified Deficits & Architectural Gaps:
1. **Missing 240 Hz Historical Sample Extraction:**
   - *Technical Cause:* The S23 Ultra Wacom EMR digitizer samples at 240 Hz. The Android display VSYNC triggers UI thread dispatch at 120 Hz. Android packs intermediate samples into `event.getHistoricalX(pos, h)`.
   - *Existing Code:*
     ```kotlin
     // CURRENT: Discards all intermediate 240Hz samples!
     val normX = filteredPoint.x / width
     val normY = filteredPoint.y / height
     networkSender.sendInputEvent(normX, normY, pressure, action)
     ```
   - *Gap:* The current code drops up to 50% of coordinate samples during rapid handwriting and drawing, resulting in visible polygonal chords on curved strokes.
   - *Required Architecture:*
     ```kotlin
     if (event.actionMasked == MotionEvent.ACTION_MOVE) {
         for (h in 0 until event.historySize) {
             val histX = event.getHistoricalX(0, h)
             val histY = event.getHistoricalY(0, h)
             val histP = event.getHistoricalPressure(0, h)
             val histTime = event.getHistoricalEventTime(h)
             val filtered = filter.filter(PointF(histX, histY), histTime)
             networkSender.sendInputEvent(filtered.x / width, filtered.y / height, histP, ACTION_MOVE)
         }
     }
     ```

2. **Absence of `requestUnbufferedDispatch()`:**
   - *Technical Cause:* Android's `View` hierarchy buffers input events by default to align with the next frame draw.
   - *Gap:* Adds 8–16 ms of unnecessary input latency.
   - *Required Architecture:* Call `requestUnbufferedDispatch(event)` on `ACTION_DOWN` and `ACTION_HOVER_ENTER`.

3. **Multi-Touch Gesture & Palm Tracking Deficit:**
   - *Technical Cause:* `SpenCaptureView.kt` only inspects pointer index 0.
   - *Gap:* When a user rests a palm or touches with multiple fingers, subsequent pointers are ignored or misattributed to the primary pointer.
   - *Required Architecture:* Track all active pointers by `pointerId`, detect `TOOL_TYPE_PALM` and `FLAG_CANCELED`, and emit explicit contact state bitmasks over the network.

---

### 2.2 Browser Input Capture Subsystem (`web_client/`)

#### Current Architectural Implementation:
- `web_client/index.html` binds W3C Pointer Events (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) on an HTML5 `<canvas id="canvas-area">`.
- Implements a visual hover reticle (`#hover-reticle`) and dynamic pressure bar (`#pressure-bar`).
- Streams JSON packets over WebSocket (`ws://host:9877`) to `bridge_server.py`.

#### Identified Deficits & Architectural Gaps:
1. **Interactive HUD Overlays Intercepting Drawing Strokes:**
   - *Technical Cause:* Elements `#hud`, `#controls-bar`, and `#bottom-bar` are positioned with `z-index: 20` and `pointer-events: auto`.
   - *Gap:* When the S Pen crosses over the HUD or status bar, the browser terminates pointer capture on `#canvas-area` and routes events to the HUD `<div>`. The active drawing stroke breaks abruptly.
   - *Required Architecture:* Apply `pointer-events: none` to all HUD containers and text elements. Place interactive buttons outside the drawing viewport or use transparent pass-through hit testing.

2. **Mobile Browser Stylus Misclassification (GeckoView Bug #2082728):**
   - *Technical Cause:* On Firefox for Android, S Pen input is incorrectly delivered with `event.pointerType === "touch"`, pressure is zeroed, and hover events (`buttons === 0`) are suppressed until contact.
   - *Gap:* Users launching the web client in Firefox experience complete failure of hover and pressure sensitivity.
   - *Required Architecture:* Add browser capability detection in JavaScript. If running on Firefox/Gecko, display a prominent warning banner directing the user to Samsung Internet or Google Chrome.

3. **WebSocket Head-of-Line Blocking over Wi-Fi:**
   - *Technical Cause:* WebSocket runs over TCP, which guarantees in-order delivery via packet retransmission.
   - *Gap:* Any dropped Wi-Fi packet stalls subsequent coordinate frames, creating 100–300 ms lag spikes.
   - *Required Architecture:* Maintain WebSocket solely as a zero-install preview fallback; use native UDP (`NetworkServer.swift`) for all production workflows.

---

### 2.3 macOS Input Injection Subsystem (`macos_daemon/`)

#### Current Architectural Implementation:
- `QuartzTabletBridge.swift` translates network coordinates to screen space and posts `CGEvent` instances via `tap: .cghidEventTap`.
- Generates `kCGEventTabletProximity` on proximity entry and sets `mouseEventSubtype = 1` (`kCGEventMouseSubtypeTabletPoint`) on all mouse events.
- Sets `tabletEventPointPressure`, `tabletEventTiltX`, and `tabletEventTiltY`.
- Uses `CGEventSource(stateID: .privateState)` to isolate modifier keys.

#### Identified Deficits & Architectural Gaps:
1. **Aspect-Ratio Geometric Distortion (Active Area Missing):**
   - *Technical Cause:* `QuartzTabletBridge.swift` performs direct linear scaling:
     ```swift
     // CURRENT: Warps geometry by up to 39%!
     targetX = Double(screenBounds.origin.x) + (normXOrDeltaX * Double(screenBounds.width))
     targetY = Double(screenBounds.origin.y) + (normYOrDeltaY * Double(screenBounds.height))
     ```
   - *Gap:* The Galaxy S23 Ultra has an aspect ratio of 19.3:9 (~2.14:1). A standard Mac display has 16:10 (~1.6:1). Direct scaling stretches drawings horizontally by ~39%. Circles become ovals, and diagonal lines change angle.
   - *Required Architecture:* Calculate the Active Area matching the target monitor's aspect ratio:
     $$\text{aspectRatio}_{\text{target}} = \frac{W_{\text{display}}}{H_{\text{display}}}$$
     $$\text{aspectRatio}_{\text{device}} = \frac{W_{\text{phone}}}{H_{\text{phone}}}$$
     Fit the active drawing rectangle inside the device bounds, center it, and letterbox/pillarbox the inactive margins. Clamp out-of-bounds coordinates to the active area edge.

2. **`CGWarpMouseCursorPosition` Interfering with Continuous Hover:**
   - *Technical Cause:* `QuartzTabletBridge.swift` executes `CGWarpMouseCursorPosition(point)` on line 152 during every hover event.
   - *Gap:* `CGWarpMouseCursorPosition` instantly repositions the hardware cursor without posting a CoreGraphics event, disabling macOS acceleration curves, resetting WindowServer velocity trackers, and causing micro-stuttering.
   - *Required Architecture:* Remove `CGWarpMouseCursorPosition` from the hover path. Rely exclusively on posting `CGEvent(mouseType: .mouseMoved)` with `mouseEventSubtype = 1`. Reserve `CGWarpMouseCursorPosition` strictly for re-anchoring the initial cursor position upon entering relative touchpad mode.

3. **Multi-Monitor Edge Bleed:**
   - *Technical Cause:* Coordinates are clamped to `Double(screenBounds.maxX)`.
   - *Gap:* In a multi-monitor layout, `screenBounds.maxX` of Display 1 is the origin ($X=0$) of Display 2. Clamping to `maxX` causes the cursor to leak onto the adjacent monitor.
   - *Required Architecture:* Clamp to `screenBounds.maxX - 1` and `screenBounds.maxY - 1`.

---

## 3. Prioritized Risk Classification

Every identified gap is categorized into four strict priority tiers:

### **P0 — Fundamental Correctness (Breaking Behavior)**
*Issues that produce incorrect input states, accidental drawing, geometric distortion, or cursor jumping.*

1. **Aspect-Ratio Geometric Distortion (Active Area Missing):**
   - *Rationale:* A graphics tablet that cannot draw true circles or maintain 1:1 angles is unusable for art and design.
2. **Palm Rejection False Right-Clicks & Scroll Flings:**
   - *Rationale:* Palm contact misidentified as a finger release generates disruptive context menus (right-clicks) or flings active canvases off-screen.
3. **Display Clamping Edge Bleed:**
   - *Rationale:* Clamping exactly to `screenBounds.maxX` pushes the cursor into the adjacent monitor when displays are arranged side-by-side.

---

### **P1 — Input Quality (Degraded User Experience)**
*Issues that cause missing strokes, latency spikes, cursor jitter, or pressure inaccuracies.*

1. **Missing 240 Hz Historical Sample Extraction in Android:**
   - *Rationale:* Discards 50% of S23 Ultra hardware digitizer resolution during rapid pen movement, causing jagged, angular curves.
2. **`CGWarpMouseCursorPosition` on Hover Path:**
   - *Rationale:* Causes cursor stuttering and disables native macOS acceleration curves during hover.
3. **Missing `requestUnbufferedDispatch()` in Android View:**
   - *Rationale:* Introduces 8–16 ms of unnecessary input buffering latency inside the Android WindowManager.
4. **Firefox Android S Pen Misclassification in Web Client:**
   - *Rationale:* Strips pressure and hover if the web client is opened in Firefox rather than Samsung Internet or Chrome.
5. **Missing S Pen Pressure Release Hysteresis:**
   - *Rationale:* Pressure oscillating near zero causes rapid bouncing between `leftMouseDown` and `leftMouseUp` at the start of light strokes.

---

### **P2 — Reliability & Lifecycle**
*Issues affecting reconnection, protocol stability, and display hot-plugging.*

1. **Stale Display ID Polling Cache:**
   - *Rationale:* Multi-monitor display disconnects leave coordinates targeted to dead display IDs for up to 3 seconds.
2. **Dual Server Stack Divergence (UDP vs. WebSocket):**
   - *Rationale:* Maintaining separate code paths in `NetworkServer.swift` (UDP) and `bridge_server.py` (WebSocket) creates fragmented protocol features and debugging overhead.
3. **UDP Packet Reordering & Duplicate Detection:**
   - *Rationale:* Out-of-order UDP delivery on congested Wi-Fi can cause an older `Move` event to be processed after an `Up` event, re-triggering drawing.

---

### **P3 — Interface Quality & Ergonomics**
*Issues affecting HUD interaction, visual feedback, and control interference.*

1. **DOM HUD Elements Intercepting Canvas Stylus Events:**
   - *Rationale:* UI cards and status overlays with `pointer-events: auto` swallow touch events, creating dead zones.
2. **Lack of Active Area Visual Boundary Markers on Android:**
   - *Rationale:* Without subtle corner ticks, the user cannot visually discern where the active letterboxed drawing area ends on the phone screen.
3. **Dynamic Viewport Resizing in Mobile Browsers:**
   - *Rationale:* Mobile browser URL bar sliding in/out shifts the canvas coordinate origin during drawing.

---

## 4. Architectural Decisions to Preserve (Do NOT Change)

The following architectural choices in `mac-android-family` are well-engineered, verified, and must be preserved:

1. **`CGEventSource(stateID: .privateState)` in macOS Daemon:**
   - Ensures simulated input does not corrupt user keyboard modifier states.
2. **Single Display Confinement Model:**
   - Restricting digitizer coordinates strictly to one user-selected display rather than stretching across all monitors aligns with professional graphics tablet ergonomics.
3. **1-Euro Filter Implementation in `SpenCaptureView.kt`:**
   - The Casiez 1-Euro filter parameters ($f_c = 1.0\text{ Hz}$, $\beta = 0.007$) provide an optimal balance between zero-latency response during fast movement and smooth jitter suppression during slow detail work.
4. **UDP Telemetry Protocol for Real-Time Input:**
   - Bypassing TCP for input datagrams eliminates Head-of-Line blocking over Wi-Fi.
