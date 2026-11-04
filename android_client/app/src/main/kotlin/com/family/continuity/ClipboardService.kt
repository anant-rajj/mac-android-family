package com.family.continuity

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.graphics.PixelFormat
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent

/**
 * Universal Clipboard Background Watcher:
 * Combines AccessibilityService selection events with a transient 1x1 overlay
 * to obtain temporary focus and legally read ClipboardManager on Android 10 to 17+.
 */
class ClipboardService : AccessibilityService() {

    private lateinit var clipboardController: AndroidClipboardController
    private var windowManager: WindowManager? = null
    private var ephemeralOverlay: View? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        clipboardController = AndroidClipboardController(this) { manifest ->
            // Broadcast UPCP manifest packet over TCP/UDP transport to macOS host
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        val type = event.eventType
        if (type == AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED ||
            type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            
            triggerFocusedRead()
        }
    }

    private fun triggerFocusedRead() {
        mainHandler.post {
            try {
                if (ephemeralOverlay == null) {
                    ephemeralOverlay = View(this).apply {
                        isFocusable = true
                        isFocusableInTouchMode = true
                    }
                    val params = WindowManager.LayoutParams(
                        1, 1,
                        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                        PixelFormat.TRANSLUCENT
                    ).apply {
                        gravity = Gravity.TOP or Gravity.START
                        x = 0
                        y = 0
                        alpha = 0.0f
                    }
                    windowManager?.addView(ephemeralOverlay, params)
                    ephemeralOverlay?.requestFocus()

                    mainHandler.postDelayed({
                        clipboardController.captureAndBroadcastOutboundClip()
                        if (ephemeralOverlay != null) {
                            windowManager?.removeViewImmediate(ephemeralOverlay)
                            ephemeralOverlay = null
                        }
                    }, 20)
                }
            } catch (_: Exception) {
                clipboardController.captureAndBroadcastOutboundClip()
            }
        }
    }

    override fun onInterrupt() {}
}
