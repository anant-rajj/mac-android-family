# Samsung S Pen Real-Time Hover & Tablet Architecture

---

## 1. Executive Summary & Expected Behaviour

This architecture establishes a true **professional graphics tablet pipeline** between the **Samsung Galaxy S23 Ultra** (with its native Wacom EMR S Pen) and **macOS**:

- **Real-Time Hover Tracking (State A):** The S Pen tip controls the Mac cursor even **before making contact** with the phone screen. Pressure is strictly `0`, clicks are not registered, and drawing strokes do not initiate.
- **Seamless Contact Transition (State B):** When the pen physically touches the glass, it transitions immediately from hover to `pen-down`. Drawing begins at the exact cursor position with **zero cursor jump**.
- **Continuous Pressure Drawing (State C):** While touching, full 4,096-level hardware pressure, tilt, and orientation are streamed at 240Hz.
- **Clean Stroke Release (State D):** Lifting the pen terminates the active stroke (`pen-up`). If the pen remains in proximity (~1.5–2.0 cm), hover tracking resumes immediately.
- **Safe Hover Exit (State E):** Moving outside proximity terminates hover safely and leaves the cursor at its last valid position.
- **Strict Palm Rejection:** While the S Pen is in hover range or active, all non-stylus touches (palm/fingers) are discarded.
- **Absolute vs. Relative Separation:** S Pen always operates in **Absolute Tablet Mode**; Finger touches operate in **Relative Trackpad Mode**.
- **Multi-Display Clamping:** S Pen hover and drawing are locked strictly inside the selected Mac display bounds and cannot exit into adjacent monitors.

---

## 2. Android Input Subsystem — Generic Motion & Hover Events

On Android devices with Wacom EMR digitizers (such as the Galaxy S23 Ultra), stylus hover events are **not** standard touchscreen touches.

### Why `onTouchEvent` Fails for Hovering
Standard Android views route physical touches through `onTouchEvent(MotionEvent)`. However, `onTouchEvent` **only receives touch contacts** (`ACTION_DOWN`, `ACTION_MOVE`, `ACTION_UP`). When the S Pen is in the air above the glass, `onTouchEvent` is never called.

### The Correct Android Hover Capture Pipeline
S Pen hover coordinates are delivered by the Android WindowManager through **`onHoverEvent(MotionEvent)`** and **`onGenericMotionEvent(MotionEvent)`**:

```
[ Wacom EMR Digitizer Coil (~2 cm Proximity) ]
                      │
                      ▼
[ Linux Kernel / Android InputReader ]
                      │ (TOOL_TYPE_STYLUS)
                      ▼
[ View.onHoverEvent(MotionEvent) / View.onGenericMotionEvent(MotionEvent) ]
      ├── ACTION_HOVER_ENTER: S Pen enters hover range
      ├── ACTION_HOVER_MOVE:  Real-time hovering coordinates (pressure = 0)
      └── ACTION_HOVER_EXIT:   S Pen exits proximity range
```

### MotionEvent Attributes Extracted
- `event.getToolType(0) == MotionEvent.TOOL_TYPE_STYLUS`
- `event.x` and `event.y` (normalized $[0.0, 1.0]$)
- `event.pressure` ($0.0$ during hover, hardware pressure on contact)
- `event.getAxisValue(MotionEvent.AXIS_TILT)`
- `event.getAxisValue(MotionEvent.AXIS_ORIENTATION)`

---

## 3. macOS Quartz Tablet Event Synthesizer

In macOS, graphics tablet events are handled at the Quartz WindowServer level via `CGEvent`:

### A. Hover Movement (`mouseMoved` with `tabletPoint` Subtype)
When the S Pen moves in the air:
1. `CGWarpMouseCursorPosition(point)` is called to instantly update the hardware cursor position on the display without requiring a mouse click.
2. A `CGEvent` of type `.mouseMoved` is posted with:
   - `mouseEventSubtype = 1` (`NSEvent.EventSubtype.tabletPoint`)
   - `tabletEventPointPressure = 0`
   - `tabletEventTiltX = tiltX`
   - `tabletEventTiltY = tiltY`
   - `tabletEventDeviceID = 1`
3. Creative applications (Photoshop, Krita, Blender) receive the hover position and render their brush preview circle directly beneath the pointer.

### B. Tablet Proximity Events (`tabletProximity`)
When the S Pen enters or exits the EMR field:
- **Hover Enter (Action 6):** Posts a `.tabletProximity` event with `tabletProximityEventEnterProximity = 1` and `pointerType = 1` (Pen).
- **Hover Exit (Action 7):** Posts a `.tabletProximity` event with `tabletProximityEventEnterProximity = 0`.

### C. Physical Contact (`leftMouseDown` and `leftMouseDragged`)
- **Down (Action 1):** Posts `.leftMouseDown` with `tabletPoint` subtype and `scaledPressure = Int64(pressure * 65535.0)`.
- **Drag (Action 2):** Posts `.leftMouseDragged` with real-time pressure updates.
- **Up (Action 3):** Posts `.leftMouseUp` with `pressure = 0`.

---

## 4. Palm & Finger Rejection

To ensure seamless drawing when the user rests their hand on the Samsung Galaxy S23 Ultra:

```
[ Incoming Input Event ]
         │
         ├── Is Tool Type == TOOL_TYPE_STYLUS?
         │         │
         │         ├── YES ──> [ Mark S Pen Active ] ──> [ Process Tablet Stream ]
         │
         └── Is Tool Type == FINGER / TOUCH?
                   │
                   ├── S Pen currently in proximity or active?
                   │         │
                   │         ├── YES ──> [ REJECT / DROP EVENT ] (Palm Rejection)
                   │         │
                   │         └── NO  ──> [ Process Finger Trackpad Mode ]
```

---

## 5. Browser Client Compatibility & Limitations

### Browser Capabilities (Samsung Internet / Chrome on Android)
In modern Chromium-based Android browsers:
- S Pen hover is exposed via **W3C Pointer Events Level 3**.
- Hovering fires `pointermove` with:
  - `e.pointerType === "pen"`
  - `e.buttons === 0`
  - `e.pressure === 0`
- Contact fires `pointerdown` with `e.buttons === 1` and `e.pressure > 0`.
- Release fires `pointerup` with `e.buttons === 0`.

### Browser Limitations vs. Native Android Client
- **Sampling Rate:** Browsers may throttle `pointermove` to the display refresh rate (60Hz or 120Hz), whereas the native Kotlin Android client communicates with the Linux input subsystem at the full **240Hz hardware EMR polling rate**.
- **Air Actions:** In some browser configurations, pressing the physical S Pen side button triggers Samsung Air Command rather than drawing shortcuts.
- **Recommendation:** The **native Android client (`android_client/`)** serves as the gold-standard 240Hz low-latency reference implementation.
