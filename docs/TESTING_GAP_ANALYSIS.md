# Testing Gap Analysis, Prevention Checklist & Source Bibliography

**Project:** Mac-Android Family  
**Author:** Antigravity (Senior macOS/Android Systems & Performance Engineer)  
**Date:** November 2026  
**Target Device:** Samsung Galaxy S23 Ultra (Wacom EMR, S Pen, One UI)  
**Target Host:** Apple Silicon MacBook Air (macOS 27.x, Multi-Monitor)

---

## 1. Testing Gap Analysis

An inspection of the test infrastructure in `mac-android-family` reveals that while manual end-to-end testing has been performed, automated regression testing for input state machines, geometric transformations, and protocol edge cases is entirely absent. In contrast, **PenBridge** maintains over 890 automated tests, including zero-allocation assertions, deterministic manual-clock gesture pipelines, and simulated client runners (`SimClient`).

### 1.1 Identified Testing Deficits in `mac-android-family`

| Test Category | Status in `mac-android-family` | Risk | Prior-Art Benchmark (PenBridge) |
| :--- | :--- | :--- | :--- |
| **Input State Machine Unit Tests** | ❌ None | **P0** | Full deterministic state machine tests covering staggered landings (0/20/60/120 ms), palm cancellations, and tool flips. |
| **Zero-Allocation Hot-Path Assertions** | ❌ None | **P1** | `Alloc.AssertZero(2000, ...)` verifies that processing incoming UDP datagrams creates 0 GC allocations on the audio/input thread. |
| **Geometric Aspect-Ratio Transform Tests** | ❌ None | **P0** | Unit tests asserting that input circles (ratio 1.0) output pixel coordinates on the target monitor with aspect ratio $1.000 \pm 0.001$. |
| **Simulated Client Injection (`SimClient`)** | ❌ None | **P1** | Headless CLI simulator (`SimClient draw`) that feeds byte-exact S Pen sequences over real UDP/TLS without physical hardware. |
| **Protocol Parser Fuzzing** | ❌ None | **P2** | Fuzzing harness (`test(core): add fuzzing harness for protocol parsers #273`) injecting corrupted datagrams to verify crash-free error recovery. |
| **Clock Synchronization & Latency Dumps** | ❌ None | **P1** | `LatencyAnalyzer` estimating clock offset via $\min(\text{one-way}) - \min(\text{RTT})/2$ with drift compensation (`scripts/latency-report.sh`). |
| **Multi-Monitor Hotplug Verification** | ❌ None | **P2** | Tests verifying that disconnecting a secondary display cleanly falls back to the primary display without coordinate clamping deadlocks. |

---

## 2. Hardware Verification Matrix (Galaxy S23 Ultra & Mac)

The following test suite must be physically executed on the Samsung Galaxy S23 Ultra connected over Wi-Fi to the MacBook Air:

| ID | Test Scenario | Input Stimulus | Expected Behavior | Pass Criteria |
| :--- | :--- | :--- | :--- | :--- |
| **HW-01** | **S Pen Hover Proximity Entry** | Bring S Pen tip from 5 cm distance to 1 cm above S23 Ultra screen. | Android emits `ACTION_HOVER_ENTER`; Mac cursor moves to mapped coordinates without clicking. | macOS cursor updates smoothly; zero `leftMouseDown` events; creative app shows brush reticle. |
| **HW-02** | **240 Hz Rapid Stroke Curve Fidelity** | Draw rapid continuous spiral with S Pen at maximum hand speed. | All intermediate samples from `event.historySize` are transmitted and injected. | Rendered path in Photoshop/Krita is completely smooth; no straight-line polygon chords. |
| **HW-03** | **Active Area Circularity Check** | Trace a circular object (e.g., coin or stencil) on the phone screen. | Coordinates mapped through the Active Area transformation to the Mac screen. | Diameter measured on the Mac screen is identical in both X and Y axes ($\le 1.0\%$ error). |
| **HW-04** | **Palm Rejection During S Pen Hover** | Hover S Pen with tip 1 cm above screen; rest fleshy palm heel firmly on screen. | Palm contact is completely suppressed; hover coordinates continue tracking pen tip. | Zero accidental canvas panning, zero cursor jumping to palm location, zero stray clicks. |
| **HW-05** | **Palm Cancel During Two-Finger Contact** | Place two fingers on screen, immediately followed (within 100 ms) by resting palm. | Suppressed touches sent as `Contact = false`; active gesture cancelled without momentum. | Zero right-click context menu popup; zero momentum scroll fling. |
| **HW-06** | **S Pen Pressure Curve Dynamic Range** | Apply progressive pressure from light touch ($p \approx 0.02$) to firm press ($p \approx 0.95$). | Pressure scales smoothly across 16-bit range `[0..65535]` with release hysteresis. | Line width transitions smoothly without flickering or abrupt stroke cuts at low pressure. |
| **HW-07** | **Multi-Monitor Display Clamping** | Move S Pen to the far right edge of the phone's active drawing area. | Cursor clamps to `CGDisplayBounds.maxX - 1` on the selected monitor. | Cursor remains on target monitor; does NOT jump or bleed onto the adjacent external monitor. |
| **HW-08** | **One-Finger Trackpad vs. Draw Mode** | In trackpad mode, move one finger across pad; tap quickly; double-tap-and-drag. | Finger moves cursor relatively; tap produces single click; second tap latches drag. | Cursor tracks relative displacement; tap clicks under cursor; lifting finger releases drag. |
| **HW-09** | **Wi-Fi Packet Loss Resilience** | Introduce 5% synthetic packet loss on local Wi-Fi router. | Subsequent UDP packets processed without blocking; no cursor freeze or catch-up burst. | Drawing continues responsively; lost packets cause subtle point omission rather than 200 ms lag spikes. |
| **HW-10** | **HUD Dead-Zone Verification (Web Client)** | Draw a continuous diagonal line across the screen crossing directly over the HUD card. | Pointer event capture remains locked to canvas; stroke renders continuously. | No stroke rupture or gap as the pen tip traverses the HUD coordinates. |
| **HW-11** | **Two-Finger Scroll & Momentum Coasting** | Drag two fingers vertically across pad and release with velocity flick. | Posts `kCGScrollPhaseBegan`, `kCGScrollPhaseChanged`, `kCGScrollPhaseEnded`, followed by coasting momentum. | Safari page scrolls smoothly with native deceleration curve; touching screen halts momentum instantly. |
| **HW-12** | **Staggered Two-Finger Tap Right-Click** | Tap two fingers on screen with 30 ms landing discrepancy. | First finger held back by settle window; two-finger landing recognized; posts right-click on lift. | Context menu appears at cursor location; cursor does not drift before click. |

---

## 3. Concrete Unit & Integration Test Designs

To eliminate identified testing deficits, the following automated tests must be integrated into the test harness:

### 3.1 Geometric Aspect-Ratio Active Area Test
```swift
func testActiveAreaCircularityPreservation() {
    // S23 Ultra portrait: 1440 x 3088 (Aspect: 0.4663)
    // MacBook Display: 2560 x 1600 (Aspect: 1.6000)
    let displayBounds = CGRect(x: 0, y: 0, width: 2560, height: 1600)
    let mapper = ActiveAreaMapper(displayBounds: displayBounds, deviceSize: CGSize(width: 1440, height: 3088))
    
    // Inject a normalized circle centered in the active area with radius 0.2
    let center = CGPoint(x: 0.5, y: 0.5)
    let radius: Double = 0.2
    let steps = 360
    
    var minX = Double.infinity, maxX = -Double.infinity
    var minY = Double.infinity, maxY = -Double.infinity
    
    for i in 0..<steps {
        let angle = Double(i) * Double.pi / 180.0
        let normX = center.x + CGFloat(radius * cos(angle))
        let normY = center.y + CGFloat(radius * sin(angle))
        let pt = mapper.mapToDisplay(normX: normX, normY: normY)
        
        minX = min(minX, pt.x); maxX = max(maxX, pt.x)
        minY = min(minY, pt.y); maxY = max(maxY, pt.y)
    }
    
    let renderedWidth = maxX - minX
    let renderedHeight = maxY - minY
    let circularityRatio = renderedWidth / renderedHeight
    
    XCTAssertEqual(circularityRatio, 1.0, accuracy: 0.002, "Circle was distorted into an ellipse!")
}
```

### 3.2 240 Hz Historical Sample Unpacking Test
```kotlin
@Test
fun testHistoricalSampleUnpacking() {
    val receivedSamples = mutableListOf<TelemetrySample>()
    val networkSender = object : TelemetrySender {
        override fun sendInputEvent(x: Float, y: Float, pressure: Float, action: Int) {
            receivedSamples.add(TelemetrySample(x, y, pressure, action))
        }
    }
    
    // Create synthetic MotionEvent with 3 historical samples
    val motionEvent = createMockMotionEvent(
        historicalPoints = listOf(
            PointF(100f, 100f),
            PointF(105f, 105f),
            PointF(110f, 110f)
        ),
        currentPoint = PointF(115f, 115f),
        action = MotionEvent.ACTION_MOVE
    )
    
    spenCaptureView.processMotionEvent(motionEvent, networkSender)
    
    // Assert all 4 points were dispatched to network
    assertEquals(4, receivedSamples.size)
    assertEquals(100f, receivedSamples[0].x)
    assertEquals(115f, receivedSamples[3].x)
}
```

### 3.3 Palm Cancel Suppression Test
```swift
func testPalmCancelAbortsGesturesWithoutRightClick() {
    let bridge = QuartzTabletBridge()
    var postedEvents: [CGEvent] = []
    bridge.eventInterceptor = { postedEvents.append($0) }
    
    // Touch 1 and 2 land (potential two-finger tap)
    bridge.handleTouchUpdate(pointerId: 0, contact: true, x: 0.4, y: 0.5)
    bridge.handleTouchUpdate(pointerId: 1, contact: true, x: 0.45, y: 0.5)
    
    // Palm lands at 80ms: contact reported as false (suppressed on wire)
    bridge.handleTouchUpdate(pointerId: 0, contact: false, x: 0.4, y: 0.5)
    bridge.handleTouchUpdate(pointerId: 1, contact: false, x: 0.45, y: 0.5)
    
    // All fingers lift
    bridge.handleTouchesLifted()
    
    // Assert zero right-clicks and zero scroll events posted
    let rightClicks = postedEvents.filter { $0.type == .rightMouseDown }
    let scrolls = postedEvents.filter { $0.type == .scrollWheel }
    XCTAssertEqual(rightClicks.count, 0, "Palm generated stray right-click!")
    XCTAssertEqual(scrolls.count, 0, "Palm generated stray scroll fling!")
}
```

---

## 4. Ranked Architecture Prevention Checklist

To prevent the recurrence of documented prior-art failures, any future code modifications to `mac-android-family` must comply with this ranked checklist:

### Priority 0 — Correctness Mandates
- [ ] **RULE P0-1 (Aspect-Ratio Preservation):** All absolute coordinate mappings must compute the target display's aspect ratio and center an **Active Area** on the device. Inactive margins must be letterboxed/pillarboxed. Never stretch raw normalized `[0..1]` coordinates across mismatched width/height.
- [ ] **RULE P0-2 (Suppressed Contact Tracking):** Canceled or palm-suppressed touch contacts must remain on the wire with an explicit `Contact = false` flag until physical release. Never drop suppressed touches abruptly from the packet stream.
- [ ] **RULE P0-3 (Display Boundary Safety):** Cursor coordinates constrained to a specific monitor must clamp to `[minX, maxX - 1]` and `[minY, maxY - 1]`. Never clamp to `maxX` exactly, as macOS WindowServer treats `maxX` as the origin of a right-adjacent monitor.

### Priority 1 — Quality Mandates
- [ ] **RULE P1-1 (240 Hz Sample Harvesting):** In the Android touch handler, `ACTION_MOVE` must iterate through `0 until event.historySize` and dispatch all intermediate historical samples.
- [ ] **RULE P1-2 (Zero Cursor Warping in Hover):** Never call `CGWarpMouseCursorPosition()` during continuous hover event injection. Rely exclusively on `CGEvent(mouseType: .mouseMoved)` with `mouseEventSubtype = 1`.
- [ ] **RULE P1-3 (Unbuffered Dispatch):** Always call `view.requestUnbufferedDispatch(event)` on `ACTION_DOWN` in Android digitizer views to bypass WindowManager coalescing.
- [ ] **RULE P1-4 (Pressure Release Hysteresis):** Implement a minimum 0.02 pressure release hysteresis band on the contact threshold to prevent contact chatter at light pressures.

### Priority 2 — Reliability Mandates
- [ ] **RULE P2-1 (Stateless UDP for Input):** Real-time pointer and digitizer telemetry must travel over stateless UDP datagrams with sequence numbers and timestamps. Never route real-time pen strokes over TCP or standard WebSocket in production.
- [ ] **RULE P2-2 (Event Source Isolation):** All synthetic `CGEvent` instances must be generated using `CGEventSource(stateID: .privateState)` to avoid modifier key corruption.
- [ ] **RULE P2-3 (Display Topology Refresh on Focus/Hotplug):** Display bounds must be refreshed dynamically on `NSApplication.didChangeScreenParametersNotification` rather than relying on stale polling timers.

### Priority 3 — Ergonomics Mandates
- [ ] **RULE P3-1 (Zero DOM Dead Zones):** All decorative HTML HUD cards, titles, and telemetry badges on web clients must specify `pointer-events: none !important;`.
- [ ] **RULE P3-2 (Visual Active Area Ticks):** The mobile screen must display subtle corner tick marks indicating the active drawing boundary when the screen aspect ratio does not match the target display.

---

## 5. Final Recommendations: What to Adopt, Reject & Test

### 5.1 Implementation Patterns to Adopt
1. **PenBridge Active Area Mapping (ADR-0031):**
   - Adopt the centered aspect-locked active area calculation in both `QuartzTabletBridge.swift` and `SpenCaptureView.kt`.
2. **PenBridge Historical Sample Ingestion:**
   - Update `SpenCaptureView.kt` to unpack `event.historySize` so that full 240 Hz digitizer bandwidth is utilized.
3. **PenBridge Contact-State Wire Protocol (ADR-0024):**
   - Include a 1-byte touch state bitmask in UDP telemetry packets representing physical contact vs. suppressed palm contact.
4. **PenBridge DSCP QoS Priorities (ADR-0038):**
   - Set socket traffic class to `IPTOS_PREC_CRITIC_ECP` / `SO_NET_SERVICE_TYPE_VO` (WMM Voice) on the input UDP socket to ensure real-time transmission over Wi-Fi.

### 5.2 Implementation Patterns to Reject
1. **REJECT DriverKit Virtual HID Digitizer (PenBridge Issue #17):**
   - Do NOT attempt to build a macOS DriverKit extension. Apple entitlement barriers and SIP restrictions make this unviable. `CGEvent` with `TabletPoint` subtype is proven to work across all target creative apps.
2. **REJECT Generic Mouse Emulation (Weylus `autopilot` approach):**
   - Do NOT degrade stylus events into plain mouse clicks. Always preserve pressure, tilt X/Y, and tablet proximity.
3. **REJECT TCP/WebSocket for Low-Latency Input (VirtualTablet Wi-Fi / Weylus):**
   - Do NOT use WebSocket or TCP streams for stylus coordinates. TCP head-of-line blocking ruins stroke smoothness over Wi-Fi.
4. **REJECT `CGWarpMouseCursorPosition` During Continuous Hover:**
   - Remove line 152 from `QuartzTabletBridge.swift`.

### 5.3 Immediate Physical Testing Requirements (S23 Ultra & Mac)
Before making code modifications to `mac-android-family`, execute the following physical verification checks:
1. Verify that the Galaxy S23 Ultra S Pen produces non-zero `event.getAxisValue(MotionEvent.AXIS_TILT)` and `AXIS_ORIENTATION` in `SpenCaptureView.kt`.
2. Measure baseline latency over 5 GHz Wi-Fi using ping timestamps to establish the network jitter floor.
3. Confirm that Photoshop and Krita on macOS respond to `CGEvent` tablet point events generated by `FamilyDaemon` when launched from terminal.

---

## 6. Source Bibliography & Prior-Art References

1. **PenBridge Repository & Documentation:**
   - Author: Paul Ciurea (`Blake11`)
   - Repository: [https://github.com/Blake11/PenBridge](https://github.com/Blake11/PenBridge)
   - Key Documents:
     - `docs/architecture.md`: Overall system architecture, CGEvent injection, ScreenCaptureKit mirroring.
     - `docs/decisions.md`: Architecture Decision Records (ADR-0001 through ADR-0038).
     - `docs/specs/phase-1-core.md`, `phase-2-mac.md`, `phase-3-android.md`, `screen-mirroring.md`.
   - Verified Commits & Issues:
     - Commit `c3e4bc0`: Dropping DriverKit digitizer from roadmap (Closes #17, #244).
     - Commit `221d64c`: Latency diagnostics & clock drift compensation (Closes #66).
     - Commit `1929578`: Finger cursor mode & side-button latch (Closes #90, #91, ADR-0022).
     - Commit `935940c`: Trackpad parity gesture recognition on Mac (Closes #110, #111, ADR-0023).
     - Commit `daf0c9b`: Palm rejection & platform cancel touch retention (Closes #114, #116, ADR-0024).
     - Commit `b67a317`: Relative one-finger cursor like trackpad (Closes #124, #131, #132, ADR-0026, ADR-0027).
     - Commit `5769193`: Aspect-ratio preservation and Active Area mapping (Closes #127, #271, ADR-0031).
     - Commit `14e3708`: Fix: don't let repeated lift frames delay two-finger right-click (Closes #143, #144).

2. **VirtualTablet Development History:**
   - Author: SunnySideSoft
   - Sources:
     - Reddit Developer Release Announcement: [https://www.reddit.com/r/androidapps/comments/1p3xds5/i_released_an_app_virtualtablet_bluetooth_that/](https://www.reddit.com/r/androidapps/comments/1p3xds5/i_released_an_app_virtualtablet_bluetooth_that/)
     - Technical Discussion on iPad / Android Tablet Digitizers: [https://www.reddit.com/r/iosapps/comments/1w22daz/turn_your_ipad_into_a_real_pen_tablet_for_your_pc/](https://www.reddit.com/r/iosapps/comments/1w22daz/turn_your_ipad_into_a_real_pen_tablet_for_your_pc/)
     - Official Documentation: [https://sunnysidesoft.com/virtualtablet/](https://sunnysidesoft.com/virtualtablet/)

3. **Weylus Open-Source Project:**
   - Author: Franz Flasch (`H-M-H`)
   - Repository: [https://github.com/H-M-H/Weylus](https://github.com/H-M-H/Weylus)
   - Code References:
     - `src/input/autopilot_device.rs`: macOS generic mouse injection.
     - `src/input/uinput_device.rs`: Linux pressure/tilt uinput implementation.
     - `ts/lib.ts`: Browser touch/stylus capture canvas.
   - Discussions & Issues:
     - Discussion #325: ADB USB forwarding vs. Wi-Fi latency, Firefox vs. Samsung Internet stylus handling ([https://github.com/H-M-H/Weylus/discussions/325](https://github.com/H-M-H/Weylus/discussions/325)).
     - Issue #74 & Issue #178: S Pen pressure and hover support in browser engines.

4. **Slide Android Project:**
   - Author: Luke Kuich (`lkuich`)
   - Repository: [https://github.com/lkuich/slide-android](https://github.com/lkuich/slide-android)
   - Code References:
     - `CanvasView.java`: MotionEvent touch handling.
     - `Controller.java`: Gesture handling, relative mode, delta packing.
     - `PositioningMode.java`: Absolute vs. Relative mode toggle.

5. **Official Platform Specifications:**
   - Android Developers: `MotionEvent` API Reference ([https://developer.android.com/reference/android/view/MotionEvent](https://developer.android.com/reference/android/view/MotionEvent)).
   - Android Developers: Advanced Stylus Features & Prediction ([https://developer.android.com/develop/ui/views/touch-and-input/stylus-input/advanced-stylus-features](https://developer.android.com/develop/ui/views/touch-and-input/stylus-input/advanced-stylus-features)).
   - Android Developers: Stylus Palm Rejection Cookbook ([https://developer.android.com/develop/adaptive-apps/cookbook/stylus-palm-rejection](https://developer.android.com/develop/adaptive-apps/cookbook/stylus-palm-rejection)).
   - Mozilla Bugzilla: Bug #2082728 & Bug #1702482 — Android Hover Pointer Classification & Touch Resolution ([https://bugzilla.mozilla.org/show_bug.cgi?id=2082728](https://bugzilla.mozilla.org/show_bug.cgi?id=2082728)).
   - Apple Developer: Quartz Event Services (`CGEvent`, `CGEventSource`, `CGDisplayBounds`) ([https://developer.apple.com/documentation/coregraphics/quartz_event_services](https://developer.apple.com/documentation/coregraphics/quartz_event_services)).
