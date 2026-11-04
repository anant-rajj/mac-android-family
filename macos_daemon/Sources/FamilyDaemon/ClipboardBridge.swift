import Foundation
import AppKit

public final class ClipboardBridge {
    public static let shared = ClipboardBridge()
    private var lastChangeCount = NSPasteboard.general.changeCount
    private var timer: Timer?
    
    private init() {}
    
    public func startMonitoring(onRemoteSync: @escaping (String) -> Void) {
        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            let pasteboard = NSPasteboard.general
            if pasteboard.changeCount != self.lastChangeCount {
                self.lastChangeCount = pasteboard.changeCount
                if let newString = pasteboard.string(forType: .string) {
                    onRemoteSync(newString)
                }
            }
        }
    }
    
    public func applyIncomingClipboard(_ text: String) {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(text, forType: .string)
        self.lastChangeCount = pasteboard.changeCount
        print("📋 [ClipboardBridge] Applied incoming clipboard text from Android (\(text.count) chars)")
    }
}
