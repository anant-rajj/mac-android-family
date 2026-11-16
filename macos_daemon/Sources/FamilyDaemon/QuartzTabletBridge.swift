import Foundation
import CoreGraphics
import AppKit

public final class QuartzTabletBridge {
    public static let shared = QuartzTabletBridge()
    
    private var isPenDown = false
    private let eventSource: CGEventSource?
    
    // Cached displays
    private var cachedDisplays: [CGDirectDisplayID] = []
    private var lastDisplayRefresh: TimeInterval = 0
    
    private init() {
        // Initialize private, isolated event source to prevent modifier latching
        self.eventSource = CGEventSource(stateID: .privateState)
        refreshDisplays()
    }
    
    /// Refresh the list of active connected displays
    public func refreshDisplays() {
        var count: UInt32 = 0
        CGGetActiveDisplayList(0, nil, &count)
        var displays = [CGDirectDisplayID](repeating: 0, count: Int(count))
        CGGetActiveDisplayList(count, &displays, &count)
        self.cachedDisplays = displays
        self.lastDisplayRefresh = Date().timeIntervalSince1970
    }
    
    /// Get the display bounds for a specific screen index (1-based: 1 = Screen 1, 2 = Screen 2, etc.)
    /// If index == 0 or out of bounds, returns the main display bounds or union.
    private func getBoundsForScreen(index: Int) -> (bounds: CGRect, isConstrained: Bool) {
        // Refresh display list if older than 3 seconds
        if Date().timeIntervalSince1970 - lastDisplayRefresh > 3.0 {
            refreshDisplays()
        }
        
        if index > 0 && index <= cachedDisplays.count {
            let bounds = CGDisplayBounds(cachedDisplays[index - 1])
            return (bounds, true)
        }
        
        // Default to main display
        let mainID = CGMainDisplayID()
        let bounds = CGDisplayBounds(mainID)
        return (bounds, false)
    }
    
    /// Inject tablet pointer coordinate or relative trackpad displacement
    /// - Parameters:
    ///   - normXOrDeltaX: In Absolute mode: normX [0.0, 1.0]. In Relative mode: pixel deltaX.
    ///   - normYOrDeltaY: In Absolute mode: normY [0.0, 1.0]. In Relative mode: pixel deltaY.
    ///   - pressure: Pressure [0.0, 1.0]
    ///   - tiltX: Tilt angle X [-90.0, 90.0]
    ///   - tiltY: Tilt angle Y [-90.0, 90.0]
    ///   - action: 0 = Hover, 1 = Down, 2 = Move, 3 = Up, 4 = Scroll, 5 = RightClick
    ///   - isRelative: false = Digitizer absolute mapping, true = Touchpad relative tracking
    ///   - screenIndex: 0 = Auto/All, 1 = Screen 1, 2 = Screen 2, 3 = Screen 3, etc.
    public func injectStylusEvent(
        normXOrDeltaX: Double,
        normYOrDeltaY: Double,
        pressure: Double,
        tiltX: Double,
        tiltY: Double,
        action: Int,
        isRelative: Bool = false,
        screenIndex: Int = 0
    ) {
        let (screenBounds, isConstrained) = getBoundsForScreen(index: screenIndex)
        
        // Handle Scroll Action (Action Code 4)
        if action == 4 {
            let scrollY = Int32(normYOrDeltaY)
            let scrollX = Int32(normXOrDeltaX)
            if let scrollEvent = CGEvent(scrollWheelEvent2Source: eventSource, units: .pixel, wheelCount: 2, wheel1: scrollY, wheel2: scrollX, wheel3: 0) {
                scrollEvent.post(tap: .cghidEventTap)
            }
            return
        }
        
        var targetX: Double = 0.0
        var targetY: Double = 0.0
        
        if isRelative {
            // Touchpad Relative Mode: Continue from current cursor position
            let currentPos = CGEvent(source: nil)?.location ?? CGPoint(x: screenBounds.midX, y: screenBounds.midY)
            targetX = Double(currentPos.x) + normXOrDeltaX
            targetY = Double(currentPos.y) + normYOrDeltaY
        } else {
            // Digitizer Absolute Mode: Map normalized coordinates to chosen screen
            targetX = Double(screenBounds.origin.x) + (normXOrDeltaX * Double(screenBounds.width))
            targetY = Double(screenBounds.origin.y) + (normYOrDeltaY * Double(screenBounds.height))
        }
        
        // Strict Display Clamping: If a specific screen is selected, cursor CANNOT exit that screen
        if isConstrained {
            targetX = max(Double(screenBounds.minX), min(Double(screenBounds.maxX - 1), targetX))
            targetY = max(Double(screenBounds.minY), min(Double(screenBounds.maxY - 1), targetY))
        }
        
        let point = CGPoint(x: targetX, y: targetY)
        
        // Right-Click Action (Action Code 5)
        if action == 5 {
            if let downEvent = CGEvent(mouseEventSource: eventSource, mouseType: .rightMouseDown, mouseCursorPosition: point, mouseButton: .right) {
                downEvent.post(tap: .cghidEventTap)
            }
            if let upEvent = CGEvent(mouseEventSource: eventSource, mouseType: .rightMouseUp, mouseCursorPosition: point, mouseButton: .right) {
                upEvent.post(tap: .cghidEventTap)
            }
            return
        }
        
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
        
        // Modifier flags sanitization (prevents shift sticking)
        let currentModifiers = NSEvent.modifierFlags
        var cgFlags: CGEventFlags = []
        if currentModifiers.contains(.shift) { cgFlags.insert(.maskShift) }
        if currentModifiers.contains(.control) { cgFlags.insert(.maskControl) }
        if currentModifiers.contains(.option) { cgFlags.insert(.maskAlternate) }
        if currentModifiers.contains(.command) { cgFlags.insert(.maskCommand) }
        event.flags = cgFlags
        
        // macOS Auto-Hidden Dock Reveal boundary velocity cue
        if isRelative {
            if normYOrDeltaY > 8.0 {
                event.setDoubleValueField(.mouseEventDeltaY, value: normYOrDeltaY)
            }
        } else {
            if normYOrDeltaY >= 0.995 {
                event.setDoubleValueField(.mouseEventDeltaY, value: 5.0)
            }
        }
        
        // Post directly to system HID event tap
        event.post(tap: .cghidEventTap)
    }
}
