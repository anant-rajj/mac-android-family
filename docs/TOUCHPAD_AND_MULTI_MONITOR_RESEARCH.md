# Research & Technical Architecture: Touchpad Relative Tracking & Multi-Display Locking

---

## 1. Absolute Digitizer Mode vs. Relative Touchpad Mode

### A. The Core Problem with Absolute Mapping (Current Digitizer Behavior)
In a graphics tablet (digitizer) model:
- The input surface (phone/tablet screen) is treated as a 1:1 scaled miniature mirror of the monitor.
- Coordinates are normalized between `[0.0, 1.0]`.
- When you touch the top-right corner of your phone `(1.0, 0.0)`, the driver multiplies:
  $$X = 1.0 \times \text{ScreenWidth}, \quad Y = 0.0 \times \text{ScreenHeight}$$
- **Result:** The cursor instantly teleports to the corner of your monitor.

```
Phone/Tablet (Absolute Ratio)               Mac Display
┌─────────────────────────┐               ┌─────────────────────────┐
│ (0,0)                   │   1:1 Ratio   │ Cursor Snaps to Top Left│
│                         │ ────────────> │                         │
│               (1.0,1.0) │   Teleport    │           Cursor Snaps  │
└─────────────────────────┘               └─────────────────────────┘
```

---

### B. How a Trackpad / Touchpad Actually Works (Relative Vector Tracking)
A touchpad does **not** map surface points to screen points. Instead, it measures **displacement vectors ($\Delta x, \Delta y$) over time**.

#### Step 1: Touch-Down (Anchor Point Initialization)
When you touch any point on the trackpad—whether dead center or in the far corner:
1. The hardware registers contact at coordinate $(x_0, y_0)$.
2. The operating system does **NOT** move the cursor. It records $(x_0, y_0)$ as the **Anchor Position**.
3. The displacement is zero:
   $$\Delta x = 0, \quad \Delta y = 0$$
4. **On-Screen Result:** The cursor remains precisely where it was before your touch.

#### Step 2: Finger Motion (Differential Tracking)
As your finger glides to $(x_1, y_1)$:
1. The sensor computes the delta:
   $$\Delta x = x_1 - x_0, \quad \Delta y = y_1 - y_0$$
2. The new cursor position is updated incrementally:
   $$\text{Cursor}_{\text{new}} = \text{Cursor}_{\text{current}} + (\Delta x \cdot \text{gain}, \Delta y \cdot \text{gain})$$
3. The anchor updates to $(x_0 \leftarrow x_1, y_0 \leftarrow y_1)$.

#### Step 3: Touch-Up (Anchor Destruction)
When you lift your finger off the surface:
1. The anchor is discarded.
2. When you touch down again—even at the opposite edge of the touchpad—it registers as a brand new anchor $(x_0', y_0')$.
3. Because no position is ever mapped to the screen, **the cursor never jumps**.

```
Trackpad (Relative Mode)                    Mac Display
┌─────────────────────────┐               ┌─────────────────────────┐
│ Touch down at Corner!   │   Zero Delta  │ Cursor STAYS wherever   │
│ Anchor = (x0, y0)       │ ────────────> │ it already was!         │
│ Δx = 0, Δy = 0          │   (No Jump)   │                         │
└─────────────────────────┘               └─────────────────────────┘
```

---

## 2. Ballistics & Pointer Acceleration Curves

A physical touchpad is only 4–6 inches wide, yet it can comfortably navigate a 32-inch 4K screen. This is achieved via **Pointer Ballistics**:
- **Slow finger motion:** $\Delta x, \Delta y$ has a gain of $\approx 1.0$. This allows pixel-level precision for UI controls.
- **Fast finger motion:** Velocity is calculated:
  $$v = \frac{\sqrt{\Delta x^2 + \Delta y^2}}{\Delta t}$$
  An exponential or polynomial multiplier $f(v)$ scales the delta:
  $$\Delta x_{\text{accelerated}} = \Delta x \times (1 + k \cdot v^p)$$
- A quick flick of your finger across 2 inches can move the pointer 2,000 pixels across the screen.

---

## 3. Multi-Monitor Setup: Restricting / Locking to a Specific Screen

### The macOS Coordinate Space (Unified Virtual Framebuffer)
When you connect two external monitors to your MacBook Air (total of 3 screens), macOS combines all displays into one large contiguous desktop coordinate plane:

```
┌─────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│ Screen 1        │ │ Screen 2             │ │ Screen 3             │
│ (MacBook Air)   │ │ (External 1)         │ │ (External 2)         │
│ x: [0, 1440]    │ │ x: [1440, 3360]      │ │ x: [3360, 5280]      │
│ y: [0, 900]     │ │ y: [0, 1080]         │ │ y: [0, 1080]         │
└─────────────────┘ └──────────────────────┘ └──────────────────────┘
```

By default, macOS WindowServer allows the mouse to slide across screen boundaries into adjacent monitors.

---

### Locking Cursor Inside a Selected Display (The Boundary Clamp)
To guarantee that the pointer **CANNOT exit the selected screen**:

1. **User Target Selection:**
   The user specifies which screen to connect to (e.g. Display 2).

2. **Retrieve Display Frame Bounds:**
   Query the selected display's global rectangle:
   $$\text{Bounds} = [X_{\min}, X_{\max}] \times [Y_{\min}, Y_{\max}]$$
   *(For Screen 2 in the example: $X \in [1440, 3360]$, $Y \in [0, 1080]$)*.

3. **Strict Clamping Equation:**
   Whenever a relative delta $(\Delta x, \Delta y)$ is received, the tentative position is calculated:
   $$X_{\text{tentative}} = X_{\text{current}} + \Delta x$$
   $$Y_{\text{tentative}} = Y_{\text{current}} + \Delta y$$

   The coordinate is clamped to the boundary:
   $$X_{\text{clamped}} = \min(X_{\max} - 1, \max(X_{\min}, X_{\tentative}))$$
   $$Y_{\text{clamped}} = \min(Y_{\max} - 1, \max(Y_{\min}, Y_{\tentative}))$$

4. **Hard Wall Enforcement:**
   Because the calculated coordinate is strictly bounded within $[X_{\min}, X_{\max}]$, the OS cursor hits an impenetrable barrier at the display edge and **cannot escape into other monitors**.

---

## Summary of Architectural Changes Required for Touchpad Mode

| Feature | Current Digitizer Mode | Desired Touchpad Mode |
| :--- | :--- | :--- |
| **Input Mapping** | Absolute $[0, 1] \rightarrow$ Screen $W \times H$ | Relative Displacement $(\Delta x, \Delta y)$ |
| **Touch-Down Reaction** | Teleports cursor to touched point | Preserves cursor location; creates anchor |
| **Edge Touch** | Snaps pointer to screen border | Zero movement until finger glides |
| **Multi-Screen Handling** | Jumps across global desktop coordinates | Clamps strictly inside chosen display bounds $[X_{\min}, X_{\max}]$ |
