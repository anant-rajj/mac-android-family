import Foundation
import CoreGraphics
import AppKit

public final class QuartzTabletBridge {
    public static let shared = QuartzTabletBridge()
    
    private var isPenDown = false
    private let screenBounds: CGRect
    
    // Isolated Event Source to prevent system-wide modifier key latching (Shift sticking bug #3303)
    private let eventSource: CGEventSource?
    
    // Relative mode 2D residual error vector for sub-pixel accuracy
    private var residualX: Double = 0.0
    private var residualY: Double = 0.0
    
    private init() {
        if let mainScreen = NSScreen.main {
            self.screenBounds = mainScreen.frame
        } else {
            self.screenBounds = CGRect(x: 0, y: 0, width: 1920, height: 1080)
        }
        // Initialize private, isolated event source
        self.eventSource = CGEventSource(stateID: .privateState)
    }
    
    /// Inject tablet pointer coordinate, pressure, and tilt
    /// - Parameters:
    ///   - normX: Normalized X [0.0, 1.0]
    ///   - normY: Normalized Y [0.0, 1.0] (0 = top, 1 = bottom)
    ///   - pressure: Pressure [0.0, 1.0]
    ///   - tiltX: Tilt angle X [-60.0, 60.0]
    ///   - tiltY: Tilt angle Y [-60.0, 60.0]
    ///   - action: 0 = Hover, 1 = Down, 2 = Move, 3 = Up
    public func injectStylusEvent(normX: Double, normY: Double, pressure: Double, tiltX: Double, tiltY: Double, action: Int) {
        let targetX = normX * Double(screenBounds.width)
        let targetY = normY * Double(screenBounds.height)
        let point = CGPoint(x: targetX, y: targetY)
        
        var eventType: CGEventType = .mouseMoved
        let mouseButton: CGMouseButton = .left
        
        switch action {
        case 1: // DOWN
            isPenDown = true
            eventType = .leftMouseDown
        case 2: // MOVE / DRAG
            eventType = isPenDown ? .leftMouseDragged : .mouseMoved
        case 3: // UP
            isPenDown = false
            eventType = .leftMouseUp
        default: // HOVER
            eventType = .mouseMoved
        }
        
        guard let event = CGEvent(mouseEventSource: eventSource, mouseType: eventType, mouseCursorPosition: point, mouseButton: mouseButton) else {
            return
        }
        
        // Populate standard Wacom/Apple Quartz Tablet Event Fields
        let scaledPressure = Int64(pressure * 65535.0)
        event.setIntegerValueField(.tabletEventPointPressure, value: scaledPressure)
        event.setDoubleValueField(.tabletEventTiltX, value: tiltX)
        event.setDoubleValueField(.tabletEventTiltY, value: tiltY)
        
        // Bug Fix 1: Explicitly sanitize modifier flags to eliminate phantom Shift latching (Bug #3303)
        let currentModifiers = NSEvent.modifierFlags
        var cgFlags: CGEventFlags = []
        if currentModifiers.contains(.shift) { cgFlags.insert(.maskShift) }
        if currentModifiers.contains(.control) { cgFlags.insert(.maskControl) }
        if currentModifiers.contains(.option) { cgFlags.insert(.maskAlternate) }
        if currentModifiers.contains(.command) { cgFlags.insert(.maskCommand) }
        event.flags = cgFlags
        
        // Bug Fix 2: macOS Tahoe (26.x) Auto-Hidden Dock Reveal Fix (Bug #4986)
        // WindowServer requires outward boundary delta velocity cues to trigger dock reveal
        if normY >= 0.995 {
            event.setDoubleValueField(.mouseEventDeltaY, value: 5.0)
        }
        
        // Post directly to system HID event tap
        event.post(tap: .cghidEventTap)
    }
}
