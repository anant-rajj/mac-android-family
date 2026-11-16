package com.family.continuity

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.view.MotionEvent
import android.view.View
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.sqrt

/**
 * High-performance 240Hz Wacom EMR digitizer capture engine for Samsung S Pen (Galaxy S23 Ultra)
 * Implements:
 * 1. Native S Pen Hover tracking via onHoverEvent & onGenericMotionEvent
 * 2. Palm & Finger Rejection while S Pen is active/in proximity
 * 3. Asymmetric pressure-drop clamp for stroke integrity
 * 4. 1-Euro adaptive low-latency jitter filter
 */
class SpenCaptureView(
    context: Context,
    private val onTelemetryEvent: (Float, Float, Float, Float, Float, Int) -> Unit
) : View(context) {

    private val filterX = OneEuroFilter(1.0, 0.007)
    private val filterY = OneEuroFilter(1.0, 0.007)
    private val filterPressure = OneEuroFilter(1.0, 0.005)

    // Touch & Pressure drawing cursor paint
    private val cursorPaint = Paint().apply {
        color = Color.parseColor("#00E5FF")
        style = Paint.Style.STROKE
        strokeWidth = 3f
        isAntiAlias = true
    }

    // Glowing S Pen Hover Reticle paint (Samsung Air Command style)
    private val hoverRingPaint = Paint().apply {
        color = Color.parseColor("#00E5FF")
        style = Paint.Style.STROKE
        strokeWidth = 2f
        isAntiAlias = true
    }
    private val hoverDotPaint = Paint().apply {
        color = Color.parseColor("#CCFF00")
        style = Paint.Style.FILL
        isAntiAlias = true
    }

    private var currentX = 0f
    private var currentY = 0f
    private var currentPressure = 0f
    private var isSpenInProximity = false

    // Asymmetric pressure clamp state
    private var prevPressure = 0.0f
    private var prevSampleX = 0.0f
    private var prevSampleY = 0.0f
    private val brushScale = 1.0f
    private val zoomScale = 1.0f
    private val epsilon = 1e-4f

    init {
        isFocusable = true
        isFocusableInTouchMode = true
    }

    /**
     * Samsung S Pen Hardware Hover Event Capture
     * Dispatched by Android WindowManager when S Pen tip is within ~1.5 - 2.0 cm of screen
     */
    override fun onHoverEvent(event: MotionEvent): Boolean {
        val toolType = event.getToolType(0)
        val isStylus = toolType == MotionEvent.TOOL_TYPE_STYLUS || toolType == MotionEvent.TOOL_TYPE_ERASER

        if (!isStylus) {
            return super.onHoverEvent(event)
        }

        val rawX = (event.x / width.toFloat()).coerceIn(0.0f, 1.0f)
        val rawY = (event.y / height.toFloat()).coerceIn(0.0f, 1.0f)
        val timestamp = System.currentTimeMillis() / 1000.0

        val smoothX = filterX.filter(rawX.toDouble(), timestamp).toFloat()
        val smoothY = filterY.filter(rawY.toDouble(), timestamp).toFloat()

        val tilt = event.getAxisValue(MotionEvent.AXIS_TILT)
        val orientation = event.getAxisValue(MotionEvent.AXIS_ORIENTATION)

        when (event.actionMasked) {
            MotionEvent.ACTION_HOVER_ENTER -> {
                isSpenInProximity = true
                currentX = event.x
                currentY = event.y
                currentPressure = 0.0f
                // Action 6 = HOVER_ENTER: Informs Mac that S Pen entered proximity
                onTelemetryEvent(smoothX, smoothY, 0.0f, tilt, orientation, 6)
                invalidate()
                return true
            }

            MotionEvent.ACTION_HOVER_MOVE -> {
                isSpenInProximity = true
                currentX = event.x
                currentY = event.y
                currentPressure = 0.0f
                // Action 0 = HOVER_MOVE: Continuous real-time hover pointer tracking
                onTelemetryEvent(smoothX, smoothY, 0.0f, tilt, orientation, 0)
                invalidate()
                return true
            }

            MotionEvent.ACTION_HOVER_EXIT -> {
                isSpenInProximity = false
                currentPressure = 0.0f
                // Action 7 = HOVER_EXIT: Informs Mac that S Pen left proximity
                onTelemetryEvent(smoothX, smoothY, 0.0f, 0f, 0f, 7)
                invalidate()
                return true
            }
        }

        return super.onHoverEvent(event)
    }

    /**
     * Fallback for devices delivering hover via onGenericMotionEvent
     */
    override fun onGenericMotionEvent(event: MotionEvent): Boolean {
        if (event.actionMasked == MotionEvent.ACTION_HOVER_ENTER ||
            event.actionMasked == MotionEvent.ACTION_HOVER_MOVE ||
            event.actionMasked == MotionEvent.ACTION_HOVER_EXIT) {
            return onHoverEvent(event)
        }
        return super.onGenericMotionEvent(event)
    }

    /**
     * Physical Contact & Drawing Capture (Down, Move, Up)
     * Enforces Strict Palm & Finger Rejection while S Pen is active
     */
    override fun onTouchEvent(event: MotionEvent): Boolean {
        val toolType = event.getToolType(0)
        val isStylus = toolType == MotionEvent.TOOL_TYPE_STYLUS || toolType == MotionEvent.TOOL_TYPE_ERASER

        // Palm Rejection: If S Pen is hovering or active, reject all finger/palm contacts!
        if (!isStylus && isSpenInProximity) {
            return true // Consume and discard accidental palm touch
        }

        val rawX = (event.x / width.toFloat()).coerceIn(0.0f, 1.0f)
        val rawY = (event.y / height.toFloat()).coerceIn(0.0f, 1.0f)
        var inputPressure = if (isStylus) event.pressure.coerceIn(0.0f, 1.0f) else 0.5f

        // Production Hazard Fix: Asymmetric Pressure-Drop Clamp
        if (inputPressure < prevPressure) {
            val dx = rawX - prevSampleX
            val dy = rawY - prevSampleY
            val dist = sqrt(dx * dx + dy * dy)
            val maxAllowedDrop = (dist - epsilon) / (brushScale * zoomScale)
            val clampedPressure = max(inputPressure, prevPressure - maxAllowedDrop)
            inputPressure = clampedPressure.coerceIn(0.0f, 1.0f)
        }
        prevPressure = inputPressure
        prevSampleX = rawX
        prevSampleY = rawY

        val timestamp = System.currentTimeMillis() / 1000.0
        val smoothX = filterX.filter(rawX.toDouble(), timestamp).toFloat()
        val smoothY = filterY.filter(rawY.toDouble(), timestamp).toFloat()
        val smoothPressure = filterPressure.filter(inputPressure.toDouble(), timestamp).toFloat()

        val tilt = event.getAxisValue(MotionEvent.AXIS_TILT)
        val orientation = event.getAxisValue(MotionEvent.AXIS_ORIENTATION)

        val actionCode = when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                isSpenInProximity = true
                1 // DOWN: Contact begins
            }
            MotionEvent.ACTION_MOVE -> {
                isSpenInProximity = true
                2 // MOVE: Drawing stroke
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                prevPressure = 0.0f
                3 // UP: Contact released
            }
            else -> 2
        }

        currentX = event.x
        currentY = event.y
        currentPressure = if (actionCode == 3) 0f else smoothPressure

        // Stream event immediately to UDP telemetry pipe
        onTelemetryEvent(smoothX, smoothY, currentPressure, tilt, orientation, actionCode)

        invalidate()
        return true
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        canvas.drawColor(Color.parseColor("#0a0b0d"))

        if (isSpenInProximity && currentPressure == 0f) {
            // S Pen Hover Reticle (Air Pointer indicator)
            canvas.drawCircle(currentX, currentY, 12f, hoverRingPaint)
            canvas.drawCircle(currentX, currentY, 3f, hoverDotPaint)
        } else if (currentPressure > 0f) {
            // Contact Drawing Pressure Circle
            canvas.drawCircle(currentX, currentY, 10f + (currentPressure * 26f), cursorPaint)
        }
    }
}

/**
 * 1-Euro Filter (Casiez et al.)
 */
class OneEuroFilter(private val minCutoff: Double = 1.0, private val beta: Double = 0.0) {
    private var xPrev = 0.0
    private var dxPrev = 0.0
    private var tPrev = -1.0

    fun filter(x: Double, timestamp: Double): Double {
        if (tPrev < 0.0) {
            xPrev = x
            dxPrev = 0.0
            tPrev = timestamp
            return x
        }
        val dt = (timestamp - tPrev).coerceAtLeast(0.001)
        val alphaD = smoothingFactor(dt, 1.0)
        val dx = (x - xPrev) / dt
        val dxHat = alphaD * dx + (1.0 - alphaD) * dxPrev

        val cutoff = minCutoff + beta * abs(dxHat)
        val alpha = smoothingFactor(dt, cutoff)
        val xHat = alpha * x + (1.0 - alpha) * xPrev

        xPrev = xHat
        dxPrev = dxHat
        tPrev = timestamp
        return xHat
    }

    private fun smoothingFactor(dt: Double, cutoff: Double): Double {
        val tau = 1.0 / (2.0 * Math.PI * cutoff)
        return 1.0 / (1.0 + tau / dt)
    }
}
