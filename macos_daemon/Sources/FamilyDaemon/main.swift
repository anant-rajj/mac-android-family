import Foundation
import AppKit

@main
struct FamilyDaemonApp {
    static func main() {
        print("🚀 [FamilyDaemon] Starting Family Continuity Engine for macOS...")
        
        let server = NetworkServer()
        server.start()
        
        ClipboardBridge.shared.startMonitoring { newText in
            print("📋 [ClipboardBridge] Local macOS clipboard changed (\(newText.count) chars), broadcasting to S23 Ultra...")
        }
        
        print("🟢 [FamilyDaemon] Running. Listening for S23 Ultra S Pen telemetry...")
        RunLoop.current.run()
    }
}
