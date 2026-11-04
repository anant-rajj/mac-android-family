import Foundation
import AppKit

@main
struct FamilyDaemonApp {
    static func main() {
        print("🚀 [FamilyDaemon] Starting Family Continuity Engine for macOS...")
        
        let server = NetworkServer()
        server.start()
        
        ClipboardBridge.shared.startMonitoring { manifest in
            print("📋 [OmniClip] Outbound clipboard broadcast: \(manifest.clipId)")
        }
        
        print("🟢 [FamilyDaemon] Running. Listening for S23 Ultra S Pen telemetry & OmniClip P2P streams...")
        RunLoop.current.run()
    }
}
