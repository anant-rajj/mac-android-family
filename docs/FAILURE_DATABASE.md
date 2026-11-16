# Development Failure Database: Prior-Art Case Studies

**Project:** Mac-Android Family  
**Author:** Antigravity (Senior macOS/Android Systems & Performance Engineer)  
**Date:** November 2026  
**Purpose:** Technical catalog of verified engineering failures, bugs, discarded designs, and performance hazards in Android-to-desktop digitizer systems.

---

### Failure Record 01: Palm Rejection Generating Stray Right-Clicks & Scroll Momentum Fling

1. **Project Name:** PenBridge
2. **Original Feature or Implementation:** Multi-touch gesture recognition and two-finger secondary click (ADR-0023).
3. **Exact Problem Experienced:** Resting a palm on the screen immediately after two fingers made contact triggered a false right-click. If palm contact occurred mid-scroll, the scroll ended with an aggressive momentum fling instead of aborting cleanly.
4. **How the Problem Was Reproduced:** Land two fingers on the Galaxy S23 Ultra pad, followed within 50–150 ms by palm resting on the lower screen border.
5. **Documented Technical Cause (Issue #114 / PR #116):** Android's local touch filter suppressed palm and canceled contacts, ceasing touch transmission over the UDP wire. The macOS server received zero touches and interpreted the absence of packets as a deliberate finger lift (`Up`), immediately dispatching a two-finger Tap (right-click) or computing a release velocity flick.
6. **What the Developer Initially Tried:** Attempted to guess touch cancellations on the phone from per-pointer `FLAG_CANCELED` flags in the filter.
7. **What Eventually Fixed It (ADR-0024, Commit `daf0c9b`):**
   - The phone continues sending suppressed/canceled touches over the wire, marked with `Contact = false` until physical lift.
   - The Mac receives `Contact = false`, immediately cancels active gesture candidates (suppressing Tap and momentum), and blocks new gestures until all touches have lifted.
   - The Android client passes `ACTION_CANCEL` explicitly via `cancelAll` instead of inferring cancellation from individual touch points.
8. **Relevant Files & Decisions:** `PenBridge.Core/Input/GestureRecognizer.cs`, `PenBridge.Core/Input/InputFilter.cs`, ADR-0024.
9. **Could It Occur in Mac-Android Family:** **YES (Critical Risk).** `macos_daemon/Sources/FamilyDaemon/QuartzTabletBridge.swift` relies on action code `5` (Right Click) and action code `4` (Scroll). If the client does not explicitly differentiate between a clean two-finger lift and a palm-induced cancel, accidental right-clicks and erratic scrolling occur.
10. **Test to Prevent Failure:** Unit test simulating a 2-finger contact sequence followed within 80 ms by a third contact with `TOOL_TYPE_PALM` or `ACTION_CANCEL`, asserting zero `rightMouseDown` and zero momentum scroll events emitted by the daemon.

---

### Failure Record 02: Aspect-Ratio Stretching Distorting Tablet Coordinates

1. **Project Name:** PenBridge
2. **Original Feature or Implementation:** Full-screen digitizer mapping from phone display to macOS target monitor (ADR-0005).
3. **Exact Problem Experienced:** On widescreen phones like the Galaxy S23 Ultra (19.3:9 aspect ratio), drawing a circle on the phone produced an ellipse stretched horizontally on a 16:10 or 16:9 Mac display. Furthermore, in landscape mode, the pen could not physically reach the top and bottom edge strips of the Mac desktop.
4. **How the Problem Was Reproduced:** Map an S23 Ultra (3088×1440, ~2.14:1) in landscape orientation to a MacBook display (2560×1664, 1.54:1). Draw a circle using a physical template; observe oval distortion on macOS.
5. **Documented Technical Cause (Issue #127 / ADR-0031):** The initial `CoordinateMapper` performed naive linear scaling:
   $$X_{\text{mac}} = \text{normX} \times W_{\text{display}}, \quad Y_{\text{mac}} = \text{normY} \times H_{\text{display}}$$
   Because the aspect ratios of the input surface and output display did not match, the transformation was non-uniform.
6. **What the Developer Initially Tried:** Clamped coordinates to screen borders, which clipped outer strokes and caused coordinate bunching along the screen edges.
7. **What Eventually Fixed It (ADR-0031, PR #161, PR #271, Commit `5769193`):**
   - Inverted the fitting logic: calculated the **Active Area** on the phone as the largest centered rectangle possessing the target display's exact aspect ratio.
   - Rendered subtle corner ticks on the phone surface demarcating the active boundary, dimming the inactive margins.
   - Any stroke landing in the inactive margin is clamped cleanly to the nearest target display edge, preserving 1:1 circularity and providing an overtravel boundary.
8. **Relevant Files & Decisions:** `PenBridge.Core/Mapping/CoordinateMapper.cs`, ADR-0031, Issue #127.
9. **Could It Occur in Mac-Android Family:** **CURRENTLY PRESENT IN CODE.** `QuartzTabletBridge.swift` lines 122–123 execute:
   ```swift
   targetX = Double(screenBounds.origin.x) + (normXOrDeltaX * Double(screenBounds.width))
   targetY = Double(screenBounds.origin.y) + (normYOrDeltaY * Double(screenBounds.height))
   ```
   Drawing on the S23 Ultra is currently warped horizontally by ~39% on a 16:10 MacBook screen.
10. **Test to Prevent Failure:** Geometric transform verification test: inject normalized points representing a perfect square (aspect ratio 1.0) and assert that the resulting injected pixel dimensions $(W_{\text{px}}, H_{\text{px}})$ have a ratio of exactly $1.0 \pm 0.001$.

---

### Failure Record 03: Weylus macOS Stylus Degradation & Pressure Loss

1. **Project Name:** Weylus
2. **Original Feature or Implementation:** Cross-platform stylus input injection for drawing tablets.
3. **Exact Problem Experienced:** When streaming an S Pen or Apple Pencil from a tablet to a Mac running macOS, creative apps received no pressure data, no tilt data, and no stylus hover reticle. All strokes drew at 100% constant brush thickness.
4. **How the Problem Was Reproduced:** Connect an Android tablet with S Pen to Weylus running on macOS. Open Krita or Photoshop; attempt to draw with varying pressure.
5. **Documented Technical Cause (`Weylus/src/input/autopilot_device.rs`):**
   - The developer implemented Linux input via `/dev/uinput` (which supports pressure and tilt), but on macOS relied on the generic Rust `autopilot` crate.
   - `autopilot_device.rs` maps incoming pointer events directly to `autopilot::mouse::move_to()` and `autopilot::mouse::toggle(Button::Left, state)`.
   - The implementation completely omitted `kCGEventTabletProximity` and `kCGEventMouseSubtypeTabletPoint` APIs.
6. **What the Developer Initially Tried:** Documented that Linux was the tier-1 supported platform and that macOS had "basic mouse emulation."
7. **What Eventually Fixed It:** Never fixed in Weylus codebase. The issue remains an open limitation on macOS.
8. **Relevant Files & Decisions:** `Weylus/src/input/autopilot_device.rs`.
9. **Could It Occur in Mac-Android Family:** **AVOIDED IN DAEMON, BUT AT RISK IN WEB CLIENT.** `QuartzTabletBridge.swift` properly sets `event.setIntegerValueField(.mouseEventSubtype, value: 1)` and `.tabletEventPointPressure`. However, if the user connects via `web_client/index.html` on Firefox Android, pressure is zeroed before reaching the daemon.
10. **Test to Prevent Failure:** End-to-end integration test verifying that simulated S Pen events with pressure $0.45$ produce `CGEvent` instances where `event.getIntegerValueField(.tabletEventPointPressure) == 29490`.

---

### Failure Record 04: Firefox Mobile S Pen Classification Bug

1. **Project Name:** Mozilla GeckoView / Firefox Mobile (Impacting Weylus & Web-Based Digitizers)
2. **Original Feature or Implementation:** W3C Pointer Events API implementation in mobile browsers.
3. **Exact Problem Experienced:** When an S Pen hovers or touches a canvas in Firefox for Android, `event.pointerType` reports `"touch"` rather than `"pen"`. Hover events (`pointerenter`, `pointermove` with zero buttons pressed) are dropped entirely.
4. **How the Problem Was Reproduced:** Open a web-based drawing canvas in Firefox on a Samsung Galaxy S23 Ultra; hover the S Pen tip 1 cm above the screen.
5. **Documented Technical Cause (Mozilla Bugzilla #2082728, Bug #1702482):** Android delivers S Pen hover through `onHoverEvent()`. GeckoView's event translation layer mapped `ACTION_HOVER_MOVE` improperly when no physical contact was present, deferring event creation until `ACTION_DOWN`. Additionally, the internal device classification heuristic defaulted uncontacted pointers to touch.
6. **What the Developer Initially Tried:** Users attempted CSS `-moz-` workarounds on the web client.
7. **What Eventually Fixed It:** Requires native engine fix in GeckoView. The practical solution adopted by open-source projects is advising users to use Chromium-based browsers (Samsung Internet or Chrome) or using a native Android APK client.
8. **Relevant Files & Decisions:** Weylus Discussion #325, Mozilla Bugzilla #2082728.
9. **Could It Occur in Mac-Android Family:** **YES.** The repository provides a `web_client/index.html`. If launched in Firefox on Android, hover and pressure are severely compromised.
10. **Test to Prevent Failure:** Client-side runtime assertion checking `event.pointerType === "pen"`; if `"touch"` is detected while pressure is non-zero, surface a warning recommending Samsung Internet or the native Android client.

---

### Failure Record 05: Wi-Fi Head-of-Line Blocking & Latency Spikes in Graphics Tablets

1. **Project Name:** VirtualTablet (SunnySideSoft)
2. **Original Feature or Implementation:** Wi-Fi TCP/IP streaming of graphics tablet coordinates.
3. **Exact Problem Experienced:** Users experienced periodic latency spikes of 100–300 ms, causing cursor stuttering, delayed strokes, and sudden high-speed catch-up lines.
4. **How the Problem Was Reproduced:** Run VirtualTablet over standard 2.4 GHz or congested 5 GHz Wi-Fi while drawing continuous circles or quick cursive script.
5. **Documented Technical Cause (Developer Release Notes & Forum Analysis):**
   - TCP enforces in-order byte stream delivery with automatic retransmission upon packet loss.
   - When a single Wi-Fi packet dropped due to radio interference or microwave/Bluetooth coexistence, the TCP stack held back all subsequent coordinate packets (Head-of-Line blocking) until the missing packet was retransmitted.
   - Coordinate data is ephemeral: an older point is useless once a newer point has been sampled.
6. **What the Developer Initially Tried:** Switched to UDP streaming, but faced firewall/NAT traversal issues on complex LANs.
7. **What Eventually Fixed It:**
   - For pure input: Transitioned to **Bluetooth HID Peripheral Mode** (*VirtualTablet: Bluetooth*), bypassing the TCP/IP stack completely.
   - For projects requiring Wi-Fi (like PenBridge): Maintained UDP with DSCP `EF` (WMM Voice) QoS prioritization, dropped lost packets, and relied on stateless datagrams with sequence numbers.
8. **Relevant Files & Decisions:** VirtualTablet Bluetooth Architecture, PenBridge ADR-0004 & ADR-0038.
9. **Could It Occur in Mac-Android Family:** **MITIGATED IN UDP DAEMON, VULNERABLE IN WEBSOCKET BRIDGE.** `NetworkServer.swift` uses raw UDP on port 47820 (immune to HOL blocking). However, `bridge_server.py` uses WebSocket (TCP) which suffers from HOL blocking over Wi-Fi.
10. **Test to Prevent Failure:** Network simulation test dropping 5% of UDP packets; assert that subsequent packets are delivered with latency $< 5\text{ ms}$ and that the server never blocks waiting for dropped packets.

---

### Failure Record 06: Missing Android Historical Samples at 240 Hz

1. **Project Name:** Slide Android & Generic Android Digitizer Implementations
2. **Original Feature or Implementation:** Wacom stylus event capture in `CanvasView.java` / `onTouchEvent()`.
3. **Exact Problem Experienced:** Fast pen strokes appeared angular and faceted with visible sharp corners rather than smooth curves, despite the phone hardware possessing a 240 Hz digitizer.
4. **How the Problem Was Reproduced:** Draw rapid figure-eight patterns with the S Pen on a Galaxy S23 Ultra; compare the path rendered on the Mac against a Wacom Intuos tablet.
5. **Documented Technical Cause:**
   - Android's UI event loop runs at 120 Hz (matching screen refresh), but the physical digitizer hardware samples at 240 Hz.
   - Android coalesces high-frequency hardware samples into the `MotionEvent` batch history (`event.historySize`).
   - If an application only reads `event.x` and `event.y`, it only captures the *latest* sample, discarding 50% of the raw data.
6. **What the Developer Initially Tried:** Increased UI thread priority and reduced layout complexity.
7. **What Eventually Fixed It:** Iterating through `event.historySize` on every `ACTION_MOVE`:
   ```kotlin
   for (h in 0 until event.historySize) {
       dispatch(event.getHistoricalX(0, h), event.getHistoricalY(0, h), event.getHistoricalPressure(0, h))
   }
   dispatch(event.x, event.y, event.pressure)
   ```
8. **Relevant Files & Decisions:** `Slide Android CanvasView.java`, `PenBridge DrawSurfaceView.kt`.
9. **Could It Occur in Mac-Android Family:** **CURRENTLY PRESENT IN CODE.** `android_client/app/src/main/kotlin/com/family/continuity/SpenCaptureView.kt` only accesses `event.x`, `event.y`, and `event.pressure` directly. It completely ignores `event.historySize`, throwing away half the S23 Ultra's digitizer resolution during rapid movement.
10. **Test to Prevent Failure:** Synthetic `MotionEvent` unit test with `historySize = 3`; assert that the capture view dispatches exactly 4 telemetry events to the network sender.

---

### Failure Record 07: Interactive HUD Elements Creating Stylus Dead Zones

1. **Project Name:** Mac-Android Family (Web Client)
2. **Original Feature or Implementation:** Floating HUD and control buttons overlaid on top of the drawing canvas (`web_client/index.html`).
3. **Exact Problem Experienced:** When drawing near the top or bottom of the screen, or passing the S Pen through the HUD or instruction panel, strokes broke, hovered coordinates froze, and drawing stopped abruptly.
4. **How the Problem Was Reproduced:** Hover or draw an S Pen stroke that crosses from the center canvas over the `#hud` element in `web_client/index.html`.
5. **Documented Technical Cause:**
   - `#hud`, `#controls-bar`, and `#bottom-bar` have CSS properties `pointer-events: auto; z-index: 20;`.
   - The browser's DOM hit-testing routes `pointerenter`, `pointermove`, and `pointerdown` events to the HUD `<div>` instead of the `#canvas-area`.
   - The canvas loses pointer capture, interpreting the transition as a `pointerleave` / lift.
6. **What the Developer Initially Tried:** Added event listeners to HUD child elements to propagate clicks.
7. **What Eventually Fixed It:**
   - Set `pointer-events: none;` on all decorative overlays, headers, and status cards.
   - For interactive buttons, use small floating icons outside the active drawing area or pass coordinates through via `document.elementFromPoint()`.
   - In PenBridge, the drawing pad is kept 100% blank; all controls live in a slide-out drawer or the macOS menu bar.
8. **Relevant Files & Decisions:** `web_client/index.html` lines 42–80.
9. **Could It Occur in Mac-Android Family:** **CURRENTLY PRESENT IN CODE.** `#hud`, `#controls-bar`, and `#bottom-bar` in `web_client/index.html` currently have `pointer-events: auto` and directly intercept stylus events.
10. **Test to Prevent Failure:** DOM automated test firing `pointermove` across a linear path passing through the HUD bounding box; assert that every point is recorded by the canvas event listener.

---

### Failure Record 08: `CGWarpMouseCursorPosition` Causing Jitter During Continuous Hover

1. **Project Name:** Mac-Android Family (Daemon)
2. **Original Feature or Implementation:** Real-time S Pen hover cursor positioning on macOS (`QuartzTabletBridge.swift`).
3. **Exact Problem Experienced:** During continuous S Pen hover movement, the macOS cursor exhibited micro-stuttering, missed macOS Dock activation thresholds, and fought with trackpad physics.
4. **How the Problem Was Reproduced:** Hover the S Pen above the Galaxy S23 Ultra; move smoothly in circles while observing the macOS cursor on a ProMotion 120 Hz display.
5. **Documented Technical Cause:**
   - `QuartzTabletBridge.swift` calls `CGWarpMouseCursorPosition(point)` on *every single hover event* (line 152) followed immediately by `event.post(tap: .cghidEventTap)` with `kCGEventMouseMoved`.
   - `CGWarpMouseCursorPosition` warps the cursor hardware position instantly without posting an OS event, which resets the WindowServer's internal velocity filters and suppresses cursor acceleration.
   - Calling both APIs simultaneously causes competing coordinate updates within the same frame cycle.
6. **What the Developer Initially Tried:** Added `CGWarpMouseCursorPosition` to ensure the cursor updated during pure hover without contact.
7. **What Eventually Fixed It (PenBridge ADR-0003, `CGEventPointerInjector.cs`):**
   - Rely solely on posting `CGEvent` of type `.mouseMoved` with `kCGEventMouseSubtypeTabletPoint`.
   - The macOS WindowServer natively moves the hardware cursor in response to tablet point `.mouseMoved` events without needing manual warping.
   - Reserve `CGWarpMouseCursorPosition` strictly for relative touchpad mode when anchoring the initial point upon proximity entry.
8. **Relevant Files & Decisions:** `macos_daemon/Sources/FamilyDaemon/QuartzTabletBridge.swift` line 152.
9. **Could It Occur in Mac-Android Family:** **CURRENTLY PRESENT IN CODE.**
10. **Test to Prevent Failure:** macOS daemon benchmark asserting that during 240 Hz hover injection, `CGWarpMouseCursorPosition` is called 0 times, and cursor movement is driven entirely via `CGEventPost`.

---

### Failure Record 09: DriverKit Virtual HID Digitizer Entitlement & Deployment Failure

1. **Project Name:** PenBridge
2. **Original Feature or Implementation:** Apple DriverKit extension (`IOUserHIDEventService`) simulating a physical USB Wacom tablet (Issue #17).
3. **Exact Problem Experienced:** The feature had to be completely abandoned and removed from the project roadmap in commit `c3e4bc0`.
4. **How the Problem Was Reproduced:** Attempt to build and install an open-source DriverKit extension on macOS Sequoia / Ventura without Apple Enterprise / notarized developer entitlements.
5. **Documented Technical Cause (PenBridge ADR-0017 / Issue #244):**
   - Apple strictly restricts `com.apple.developer.driverkit` entitlements; personal developer accounts cannot sign DriverKit binaries.
   - Testing on clean macOS installations showed that end users had to boot into Recovery Mode, disable System Integrity Protection (SIP), and execute multiple `kmutil` approval steps.
   - User-space CoreGraphics event injection (`CGEvent`) with `TabletPoint` subtype already achieved 100% compatibility with Photoshop, Krita, and Blender with zero kernel extensions or SIP modification.
6. **What the Developer Initially Tried:** Maintained DriverKit as an experimental branch for several months.
7. **What Eventually Fixed It:** Dropped DriverKit entirely from the roadmap (`c3e4bc0`). Invested engineering resources into refining user-space `CGEvent` tablet and gesture injection.
8. **Relevant Files & Decisions:** `PenBridge docs/architecture.md`, ADR-0003, Issue #17, Issue #244.
9. **Could It Occur in Mac-Android Family:** **AVOIDED IF KEPT USER-SPACE.** Do NOT attempt to build kernel or DriverKit extensions. `CGEvent` in user-space is the sanctioned, robust path.
10. **Test to Prevent Failure:** Architecture policy check confirming that no kernel extensions or DriverKit dependencies exist in `Package.swift`.

---

### Failure Record 10: Finger Touch Defaulting to Mouse-Down, Accidental Drawing During Navigation

1. **Project Name:** PenBridge
2. **Original Feature or Implementation:** Fallback finger touch support on the digitizer surface (ADR-0006).
3. **Exact Problem Experienced:** When users touched the screen with a finger to navigate, pan, or tap, the application immediately pressed the mouse button (`leftMouseDown`), causing accidental drawing strokes and text selection across macOS apps (Issue #91).
4. **How the Problem Was Reproduced:** Open Krita or TextEdit. Touch the phone screen with one finger to move the cursor; observe unwanted strokes drawn or text selected.
5. **Documented Technical Cause:** The touch handler mapped any non-stylus `ACTION_DOWN` directly to mouse down without establishing a distinction between finger navigation and active pen drawing.
6. **What the Developer Initially Tried:** Added a small spatial slop threshold before firing mouse down.
7. **What Eventually Fixed It (ADR-0022 & ADR-0026):**
   - Implemented `FingerFallbackMode.Cursor` as default.
   - A single finger moving across the pad emits hover movement (cursor moves without pressing).
   - Only a discrete tap ($\le 200\text{ ms}$, $\le 2\%$ movement) posts a left click at the release location.
   - A tap-and-hold ("tap and a half") latches a drag.
8. **Relevant Files & Decisions:** `PenBridge.Core/Input/InputFilter.cs`, ADR-0022, ADR-0026, Issue #91.
9. **Could It Occur in Mac-Android Family:** **CURRENTLY PRESENT IN SOME MODES.** In `QuartzTabletBridge.swift`, if finger mode is not strictly segregated from S Pen absolute drawing, finger contact triggers left mouse down.
10. **Test to Prevent Failure:** Unit test simulating a 500 ms continuous finger movement across the surface, asserting that 0 `leftMouseDown` events are dispatched and all generated events are `mouseMoved`.

---

### Failure Record 11: Trackpad Cursor Drift and Staggered Two-Finger Tap Interference

1. **Project Name:** PenBridge
2. **Original Feature or Implementation:** Relative trackpad cursor movement with two-finger tap for secondary click (ADR-0023, ADR-0026).
3. **Exact Problem Experienced:** When users attempted to perform a two-finger right click, their fingers landed on the glass with a slight time discrepancy (10–40 ms). The first finger was recognized as a single-finger cursor move, nudging the cursor 2–5 pixels before the second finger landed. Consequently, the right-click context menu opened at the wrong coordinates, or the gesture was misclassified as a scroll.
4. **How the Problem Was Reproduced:** Tap two fingers on the Galaxy S23 Ultra naturally; observe slight cursor displacement before the context menu appears.
5. **Documented Technical Cause (ADR-0027 / Issue #124):** In relative cursor mode, movement was forwarded immediately on the first finger touch without waiting for a potential second finger to land.
6. **What the Developer Initially Tried:** Increased general `TapSlop` to 3.5%, which made the trackpad cursor feel sticky and sluggish during normal single-finger movement.
7. **What Eventually Fixed It (ADR-0027):**
   - Introduced a two-stage filter:
     - **Pointer Slop:** 1.5% (~1 mm) for normal single-finger movement.
     - **Pointer Settle Window:** For the first 100 ms after landing, cursor movement is held back until movement exceeds `TapSlop` (3.5%).
     - If a second finger lands within that 100 ms window, the single-finger candidate is aborted and the interaction enters the two-finger gesture pipeline.
     - If no second finger lands and movement exceeds 1.5% after 100 ms, the cursor catches up smoothly.
8. **Relevant Files & Decisions:** `PenBridge.Core/Input/InputFilter.cs`, ADR-0027.
9. **Could It Occur in Mac-Android Family:** **YES.** High risk when transitioning between trackpad relative mode and two-finger gestures.
10. **Test to Prevent Failure:** Synthetic touch sequence with finger 1 landing at $t = 0\text{ ms}$ and moving 1.0%, finger 2 landing at $t = 30\text{ ms}$, followed by release at $t = 120\text{ ms}$; assert cursor delta is exactly $(0, 0)$ and a right-click event is emitted.

---

### Failure Record 12: Preview / macOS Smart Zoom Double-Tap Quirk and Staggered Lift Timing

1. **Project Name:** PenBridge
2. **Original Feature or Implementation:** Two-finger double-tap for macOS Smart Zoom (ADR-0029, Issue #144).
3. **Exact Problem Experienced:** In Apple Preview and Safari, double-tapping with two fingers occasionally failed to trigger Smart Zoom or registered as a quick right-click followed by a left click.
4. **How the Problem Was Reproduced:** Double-tap with two fingers in Preview.app on a PDF document.
5. **Documented Technical Cause (Commit `14e3708` / Issue #143 & #144):**
   - The two fingers did not lift off the glass at the exact same microsecond.
   - When finger 1 lifted 15 ms before finger 2, the system briefly saw 1 finger remaining on the surface.
   - The repeated UDP lift frame resends delayed the two-finger recognition, causing the Mac gesture recognizer to interpret the remaining finger as a tap-and-hold.
6. **What the Developer Initially Tried:** Required both fingers to lift within 5 ms, which proved impossible for human users.
7. **What Eventually Fixed It (Commit `14e3708`):**
   - Added a 60 ms lift tolerance window for multi-touch gestures.
   - Repeated lift frames from a partially lifted cluster do not reset gesture completion timers.
8. **Relevant Files & Decisions:** `PenBridge.Core/Input/GestureRecognizer.cs`, Commit `14e3708`.
9. **Could It Occur in Mac-Android Family:** **YES.** Relevant if implementing multi-touch gesture parity.
10. **Test to Prevent Failure:** Multi-touch lift test with 25 ms stagger between finger 1 and finger 2 release, asserting clean gesture termination.

---

### Failure Record 13: Multi-Monitor Virtual Desktop Bounding-Box Coordinate Trapping

1. **Project Name:** VirtualTablet (SunnySideSoft)
2. **Original Feature or Implementation:** Bluetooth HID Digitizer coordinate reporting across multiple monitors (Reddit `1w22daz`).
3. **Exact Problem Experienced:** When an external monitor was arranged above or to the side of the main laptop screen, the HID digitizer mapped the phone's touch surface to the entire virtual desktop bounding box. Large dead areas existed where no physical monitor was present, and drawing was compressed into a tiny fraction of the phone screen.
4. **How the Problem Was Reproduced:** Connect a MacBook to a 1080p monitor placed vertically above the MacBook. Pair VirtualTablet via Bluetooth HID.
5. **Documented Technical Cause:** Standard Bluetooth HID Digitizers report coordinates normalized to `[0..LogicalMaximum]`. Without an active host daemon to intercept HID reports and call `CGGetActiveDisplayList()`, the OS maps the logical range across the entire union bounding box of all displays.
6. **What the Developer Initially Tried:** Created a desktop companion utility to intercept HID reports.
7. **What Eventually Fixed It:** Native daemon architecture (like PenBridge and Mac-Android Family) that explicitly queries `CGDisplayBounds(displayID)` and clamps coordinates strictly to the user-selected display.
8. **Relevant Files & Decisions:** `QuartzTabletBridge.swift`, PenBridge ADR-0005 & ADR-0031.
9. **Could It Occur in Mac-Android Family:** **AVOIDED IN DAEMON.** `QuartzTabletBridge.swift` explicitly binds to a single selected `CGDirectDisplayID`.
10. **Test to Prevent Failure:** Display geometry test verifying that with 3 connected displays of varying resolutions, coordinates are mapped strictly within the bounds of the active target display.

---

### Failure Record 14: Coordinate Runaway & Delta Accumulation Without Floating-Point Math

1. **Project Name:** Slide Android
2. **Original Feature or Implementation:** Relative cursor movement in `Controller.java`.
3. **Exact Problem Experienced:** In relative mode, moving the finger slowly across the phone produced zero cursor movement (dead zone), while moving quickly caused the cursor to fly wildly across the screen and accelerate out of control.
4. **How the Problem Was Reproduced:** In Slide Android, toggle to Relative mode. Drag finger at a slow speed ($< 2\text{ mm/sec}$); observe cursor freeze.
5. **Documented Technical Cause:**
   - `Controller.java` cast coordinates directly to integer/short:
     ```java
     pack[0] = (short) (getSource(0).getX() - getSavedX());
     ```
   - Small sub-pixel fractional displacements were truncated to zero on every frame, creating a severe deadband.
   - At high speeds, raw integer pixel deltas were injected directly without acceleration curve normalization.
6. **What the Developer Initially Tried:** Added a static multiplier to the delta.
7. **What Eventually Fixed It:** Use normalized floating-point delta accumulation combined with macOS standard pointer acceleration curves ($v^{1.2}$ or sigmoid response).
8. **Relevant Files & Decisions:** `Slide Android Controller.java`, `PenBridge CGEventPointerInjector.cs`.
9. **Could It Occur in Mac-Android Family:** **YES.** In `QuartzTabletBridge.swift`, trackpad mode deltas must accumulate sub-pixel remainders to prevent truncation at slow speeds.
10. **Test to Prevent Failure:** Precision test injecting 50 successive micro-deltas of $0.2\text{ pixels}$; assert that the cursor moves exactly 10 pixels total without truncation loss.

---

### Failure Record 15: Display Edge Bleed When Clamping Exactly to `maxX`

1. **Project Name:** Mac-Android Family (Daemon)
2. **Original Feature or Implementation:** Multi-monitor boundary clamping in `QuartzTabletBridge.swift`.
3. **Exact Problem Experienced:** When two monitors are arranged side-by-side (Display 1 at $X \in [0, 1470]$, Display 2 at $X \in [1470, 2836]$), moving the S Pen to the far right edge of Display 1 causes the cursor to bleed onto Display 2, switching active application focus.
4. **How the Problem Was Reproduced:** Configure dual monitors. Select Display 1 as target. Draw a stroke to the extreme right edge of the phone surface.
5. **Documented Technical Cause:**
   - In `QuartzTabletBridge.swift`:
     ```swift
     targetX = min(Double(screenBounds.maxX), max(Double(screenBounds.minX), targetX))
     ```
   - In macOS CoreGraphics, `screenBounds.maxX` of Display 1 is mathematically equal to `screenBounds.minX` of Display 2 ($X = 1470$).
   - Positioning the cursor at $X = 1470$ places it inside the coordinate space of Display 2.
6. **What the Developer Initially Tried:** Clamped to `maxX`.
7. **What Eventually Fixed It (PenBridge ADR-0005 & Commit `5769193`):**
   - Clamp coordinates strictly to `screenBounds.maxX - 1` and `screenBounds.maxY - 1`.
8. **Relevant Files & Decisions:** `QuartzTabletBridge.swift` line 133, PenBridge ADR-0005.
9. **Could It Occur in Mac-Android Family:** **CURRENTLY PRESENT IN CODE.**
10. **Test to Prevent Failure:** Dual-display boundary test asserting that for target display with bounds $(0, 0, 1470, 956)$, max injected coordinate is strictly $\le 1469.0$.
