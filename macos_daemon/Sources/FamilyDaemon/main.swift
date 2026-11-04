import Foundation
import AppKit

@main
struct FamilyDaemonApp {
    static func main() {
        print("🎨 [FamilyDaemon] Initializing macOS S Pen Graphics Tablet Engine...")
        
        let server = NetworkServer()
        server.start()
        
        // Setup graceful UNIX signal handling for clean terminal exit
        signal(SIGINT) { _ in
            print("\n🛑 [FamilyDaemon] Terminating gracefully...")
            exit(0)
        }
        signal(SIGTERM) { _ in
            print("\n🛑 [FamilyDaemon] Terminating gracefully...")
            exit(0)
        }
        
        print("🟢 [FamilyDaemon] Online. Receiving 240Hz S Pen telemetry via UDP on port 9876.")
        RunLoop.current.run()
    }
}
