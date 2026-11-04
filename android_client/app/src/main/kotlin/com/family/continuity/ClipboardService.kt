package com.family.continuity

import android.accessibilityservice.AccessibilityService
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.view.accessibility.AccessibilityEvent

/**
 * Android 10+ Universal Clipboard background bypass service
 */
class ClipboardService : AccessibilityService() {
    private var lastCopiedText: String = ""

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Detect selection/copy interactions in foreground apps
        if (event?.eventType == AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED ||
            event?.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
            if (clipboard != null && clipboard.hasPrimaryClip()) {
                val clip = clipboard.primaryClip?.getItemAt(0)?.text?.toString()
                if (!clip.isNullOrEmpty() && clip != lastCopiedText) {
                    lastCopiedText = clip
                    // Broadcast to LocalSend / Family Mac Daemon
                    syncToMac(clip)
                }
            }
        }
    }

    private fun syncToMac(text: String) {
        // Asynchronous LocalSend protocol REST payload dispatch to macOS host
    }

    override fun onInterrupt() {}
}
