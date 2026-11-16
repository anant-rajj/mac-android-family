import Foundation
import CoreGraphics
import AppKit

public final class QuartzTabletBridge {
    public static let shared = QuartzTabletBridge()
    
    private var isPenDown = false
    private var isStylusInProximity = false
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
    public func getBoundsForScreen(index: Int) -> (bounds: CGRect, isConstrained: Bool) {
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
    
    /// Inject tablet pointer coordinate, hover, or relative trackpad displacement
    /// - Parameters:
    ///   - normXOrDeltaX: In Absolute mode: normX [0.0, 1.0]. In Relative mode: pixel deltaX.
    ///   - normYOrDeltaY: In Absolute mode: normY [0.0, 1.0]. In Relative mode: pixel deltaY.
    ///   - pressure: Pressure [0.0, 1.0] (0.0 for hover)
    ///   - tiltX: Tilt angle X [-90.0, 90.0]
    ///   - tiltY: Tilt angle Y [-90.0, 90.0]
    ///   - action:
    ///       0 = HOVER_MOVE (S Pen proximity movement without contact, pressure=0)
    ///       1 = DOWN (Pen touches screen, drawing begins)
    ///       2 = MOVE / DRAG (Pen moves while in contact)
    ///       3 = UP (Pen leaves screen contact, stroke terminates)
    ///       4 = SCROLL (Two-finger trackpad scroll)
    ///       5 = RIGHT_CLICK (Two-finger trackpad tap)
    ///       6 = HOVER_ENTER (S Pen enters proximity range)
    ///       7 = HOVER_EXIT (S Pen leaves proximity range)
    ///   - isRelative: false = Digitizer/S Pen absolute mapping, true = Touchpad relative tracking
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
        
        // Handle Hover Exit (Action Code 7)
        if action == 7 {
            if isPenDown {
                // If pen was still touching when leaving proximity, safely lift it up
                isPenDown = false
                let currentPos = CGEvent(source: nil)?.location ?? CGPoint(x: screenBounds.midX, y: screenBounds.midY)
                if let upEvent = CGEvent(mouseEventSource: eventSource, mouseType: .leftMouseUp, mouseCursorPosition: currentPos, mouseButton: .left) {
                    upEvent.setIntegerValueField(.mouseEventSubtype, value: 1) // tabletPoint
                    upEvent.setIntegerValueField(.tabletEventPointPressure, value: 0)
                    upEvent.post(tap: .cghidEventTap)
                }
            }
            
            // Post Tablet Proximity Exit event
            if isStylusInProximity {
                isStylusInProximity = false
                if let proxEvent = CGEvent(source: eventSource) {
                    proxEvent.type = .tabletProximity
                    proxEvent.setIntegerValueField(.tabletProximityEventEnterProximity, value: 0)
                    proxEvent.setIntegerValueField(.tabletProximityEventPointerType, value: 1) // Pen
                    proxEvent.post(tap: .cghidEventTap)
                }
            }
            return
        }
        
        // Calculate Target Position
        var targetX: Double = 0.0
        var targetY: Double = 0.0
        
        if isRelative {
            // Touchpad Relative Mode: Continue from current cursor position
            let currentPos = CGEvent(source: nil)?.location ?? CGPoint(x: screenBounds.midX, y: screenBounds.midY)
            targetX = Double(currentPos.x) + normXOrDeltaX
            targetY = Double(currentPos.y) + normYOrDeltaY
        } else {
            // S Pen / Digitizer Absolute Mode: Map normalized coordinates to chosen screen
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
        
        // Handle Hover Enter (Action Code 6)
        if action == 6 {
            if !isStylusInProximity {
                isStylusInProximity = true
                if let proxEvent = CGEvent(source: eventSource) {
                    proxEvent.type = .tabletProximity
                    proxEvent.setIntegerValueField(.tabletProximityEventEnterProximity, value: 1)
                    proxEvent.setIntegerValueField(.tabletProximityEventPointerType, value: 1) // Pen
                    proxEvent.setIntegerValueField(.tabletProximityEventDeviceID, value: 1)
                    proxEvent.post(tap: .cghidEventTap)
                }
            }
        }
        
        // Hardware Cursor Synchronization:
        // CGWarpMouseCursorPosition ensures macOS physically updates the on-screen cursor
        // even during pure hover (Action 0 / 6) before any click occurs!
        CGWarpMouseCursorPosition(point)
        
        var eventType: CGEventType = .mouseMoved
        let mouseButton: CGMouseButton = .left
        
        switch action {
        case 1: // DOWN: Pen contacts screen, start stroke
            isPenDown = true
            eventType = .leftMouseDown
        case 2: // MOVE / DRAG: Pen moves while touching
            eventType = isPenDown ? .leftMouseDragged : .mouseMoved
        case 3: // UP: Pen lifts off screen, stroke ends
            isPenDown = false
            eventType = .leftMouseUp
        case 0, 6: // HOVER: Pen moves in air without touching, pressure = 0
            isPenDown = false
            eventType = .mouseMoved
        default:
            eventType = .mouseMoved
        }
        
        guard let event = CGEvent(mouseEventSource: eventSource, mouseType: eventType, mouseCursorPosition: point, mouseButton: mouseButton) else {
            return
        }
        
        // Subtype 1 = tabletPoint: notifies macOS creative apps (Photoshop, Krita, etc.)
        // that this is a professional graphics tablet stylus
        event.setIntegerValueField(.mouseEventSubtype, value: 1)
        
        // Tablet Point Pressure: 0 for hover, scaled [0..65535] for contact
        let scaledPressure = (action == 0 || action == 6 || action == 3) ? 0 : Int64(pressure * 65535.0)
        event.setIntegerValueField(.tabletEventPointPressure, value: scaledPressure)
        event.setDoubleValueField(.tabletEventTiltX, value: tiltX)
        event.setDoubleValueField(.tabletEventTiltY, value: tiltY)
        event.setIntegerValueField(.tabletEventDeviceID, value: 1)
        
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
