import Foundation
import Network

public final class NetworkServer {
    private var listener: NWListener?
    private let port: NWEndpoint.Port = 9876
    
    public init() {}
    
    public func start() {
        do {
            let parameters = NWParameters.udp
            parameters.allowLocalEndpointReuse = true
            listener = try NWListener(using: parameters, on: port)
            
            listener?.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    print("✅ [FamilyDaemon] UDP Turbo listener ready on port \(self.port)")
                case .failed(let error):
                    print("❌ [FamilyDaemon] UDP Listener failed: \(error)")
                default:
                    break
                }
            }
            
            listener?.newConnectionHandler = { connection in
                self.handleConnection(connection)
            }
            
            listener?.start(queue: .global(qos: .userInteractive))
        } catch {
            print("❌ [FamilyDaemon] Failed to start listener: \(error)")
        }
    }
    
    private func handleConnection(_ connection: NWConnection) {
        connection.start(queue: .global(qos: .userInteractive))
        receivePacket(on: connection)
    }
    
    private func receivePacket(on connection: NWConnection) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 128) { data, _, _, error in
            if let data = data, !data.isEmpty {
                self.parsePacket(data)
            }
            if error == nil {
                self.receivePacket(on: connection)
            }
        }
    }
    
    /// Supports both:
    /// Format A (Turbo 12-byte packed integer layout):
    /// [0..1] Magic 0xFACE, [2] action, [4..5] uint16 x, [6..7] uint16 y, [8..9] uint16 pressure, [10] int8 tiltX, [11] int8 tiltY
    /// Format B (Legacy 23-byte float layout):
    private func parsePacket(_ data: Data) {
        let count = data.count
        guard count >= 12, data[0] == 0xFA, data[1] == 0xCE else { return }
        
        let action = Int(data[2])
        var normX: Double = 0.0
        var normY: Double = 0.0
        var pressure: Double = 0.0
        var tiltX: Double = 0.0
        var tiltY: Double = 0.0
        
        if count == 12 {
            // Turbo 12-byte path: zero floating point byte conversion on network
            let uX = data.subdata(in: 4..<6).withUnsafeBytes { $0.load(as: UInt16.self) }
            let uY = data.subdata(in: 6..<8).withUnsafeBytes { $0.load(as: UInt16.self) }
            let uP = data.subdata(in: 8..<10).withUnsafeBytes { $0.load(as: UInt16.self) }
            let tX = Int8(bitPattern: data[10])
            let tY = Int8(bitPattern: data[11])
            
            normX = Double(uX) / 65535.0
            normY = Double(uY) / 65535.0
            pressure = Double(uP) / 65535.0
            tiltX = Double(tX)
            tiltY = Double(tY)
        } else if count >= 23 {
            // 23-byte IEEE float path
            func readFloat(offset: Int) -> Float {
                return data.subdata(in: offset..<(offset + 4)).withUnsafeBytes { $0.load(as: Float.self) }
            }
            normX = Double(readFloat(offset: 3))
            normY = Double(readFloat(offset: 7))
            pressure = Double(readFloat(offset: 11))
            tiltX = Double(readFloat(offset: 15))
            tiltY = Double(readFloat(offset: 19))
        }
        
        QuartzTabletBridge.shared.injectStylusEvent(
            normX: normX,
            normY: normY,
            pressure: pressure,
            tiltX: tiltX,
            tiltY: tiltY,
            action: action
        )
    }
}
