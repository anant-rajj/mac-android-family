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
 * High-performance 240Hz Wacom EMR digitizer capture engine
 * Implements:
 * 1. Asymmetric pressure-drop clamp (Prevents native AndroidX Ink / RoundedPolygon SIGABRT crash)
 * 2. 1-Euro adaptive low-latency jitter filter
 */
class SpenCaptureView(
    context: Context,
    private val onTelemetryEvent: (Float, Float, Float, Float, Float, Int) -> Unit
) : View(context) {

    private val filterX = OneEuroFilter(1.0, 0.007)
    private val filterY = OneEuroFilter(1.0, 0.007)
    private val filterPressure = OneEuroFilter(1.0, 0.005)

    private val cursorPaint = Paint().apply {
        color = Color.CYAN
        style = Paint.Style.STROKE
        strokeWidth = 3f
        isAntiAlias = true
    }

    private var currentX = 0f
    private var currentY = 0f
    private var currentPressure = 0f

    // Asymmetric pressure clamp state
    private var prevPressure = 0.0f
    private var prevSampleX = 0.0f
    private var prevSampleY = 0.0f
    private val brushScale = 1.0f
    private val zoomScale = 1.0f
    private val epsilon = 1e-4f

    override fun onTouchEvent(event: MotionEvent): Boolean {
        val toolType = event.getToolType(0)
        val isStylus = toolType == MotionEvent.TOOL_TYPE_STYLUS

        val rawX = event.x / width.toFloat()
        val rawY = event.y / height.toFloat()
        var inputPressure = if (isStylus) event.pressure.coerceIn(0.0f, 1.0f) else 0.5f

        // Production Hazard Fix: Asymmetric Pressure-Drop Clamp
        // Prevents circle-containment crash where consecutive stroke samples violate r_i - r_{i+1} < ||p_i - p_{i+1}||
        // ONLY clamp pressure decreases; leave pressure ramp-ups completely untouched
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
            MotionEvent.ACTION_DOWN -> 1
            MotionEvent.ACTION_MOVE -> 2
            MotionEvent.ACTION_UP -> {
                prevPressure = 0.0f
                3
            }
            MotionEvent.ACTION_HOVER_MOVE -> 0
            else -> 2
        }

        currentX = event.x
        currentY = event.y
        currentPressure = smoothPressure

        // Stream event immediately to UDP telemetry pipe
        onTelemetryEvent(smoothX, smoothY, smoothPressure, tilt, orientation, actionCode)

        invalidate()
        return true
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        canvas.drawColor(Color.parseColor("#0a0b0d"))
        if (currentPressure > 0f) {
            canvas.drawCircle(currentX, currentY, 14f + (currentPressure * 28f), cursorPaint)
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
