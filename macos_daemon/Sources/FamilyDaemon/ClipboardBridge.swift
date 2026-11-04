import AppKit
import Foundation

public struct RemoteStreamMetadata: Codable {
    public let clipId: String
    public let itemIndex: Int
    public let fileName: String
    public let mimeType: String
    public let size: Int64
    public let streamURL: URL

    public init(clipId: String, itemIndex: Int, fileName: String, mimeType: String, size: Int64, streamURL: URL) {
        self.clipId = clipId
        self.itemIndex = itemIndex
        self.fileName = fileName
        self.mimeType = mimeType
        self.size = size
        self.streamURL = streamURL
    }
}

public enum ManifestItemKind {
    case text(String)
    case html(plain: String, html: String)
    case stream(RemoteStreamMetadata)
}

public struct ClipManifestPacket {
    public let clipId: String
    public let primaryKind: ManifestItemKind

    public init(clipId: String = UUID().uuidString, primaryKind: ManifestItemKind) {
        self.clipId = clipId
        self.primaryKind = primaryKind
    }

    public static func fromText(_ text: String) -> ClipManifestPacket {
        return ClipManifestPacket(primaryKind: .text(text))
    }

    public static func fromHTML(plain: String, html: String) -> ClipManifestPacket {
        return ClipManifestPacket(primaryKind: .html(plain: plain, html: html))
    }

    public static func fromRawImage(_ data: Data, mimeType: String = "image/png") -> ClipManifestPacket {
        let dummyURL = URL(string: "http://127.0.0.1:27184/stream/local/0")!
        let meta = RemoteStreamMetadata(clipId: UUID().uuidString, itemIndex: 0, fileName: "image.png", mimeType: mimeType, size: Int64(data.count), streamURL: dummyURL)
        return ClipManifestPacket(primaryKind: .stream(meta))
    }

    public static func fromFileURLs(_ urls: [URL]) -> ClipManifestPacket {
        let first = urls.first!
        let size = (try? FileManager.default.attributesOfItem(atPath: first.path)[.size] as? Int64) ?? 0
        let meta = RemoteStreamMetadata(clipId: UUID().uuidString, itemIndex: 0, fileName: first.lastPathComponent, mimeType: "application/octet-stream", size: size, streamURL: first)
        return ClipManifestPacket(primaryKind: .stream(meta))
    }
}

/**
 * Universal Polymorphic Clipboard Engine for macOS:
 * Implements lazy data promise provisioning via NSPasteboardItemDataProvider.
 * Large images, PDFs, and files are only transferred over the wire when the user presses Cmd+V.
 */
public final class ClipboardBridge: NSObject, NSPasteboardItemDataProvider {
    public static let shared = ClipboardBridge()
    private let pasteboard = NSPasteboard.general
    private var lastChangeCount: Int = 0
    private var activePromises: [NSPasteboardItem: RemoteStreamMetadata] = [:]
    private let stagingDir = FileManager.default.temporaryDirectory.appendingPathComponent("OmniClipStaging", isDirectory: true)
    private var pollTimer: Timer?

    private override init() {
        super.init()
        try? FileManager.default.createDirectory(at: stagingDir, withIntermediateDirectories: true)
        lastChangeCount = pasteboard.changeCount
    }

    public func startMonitoring(onRemoteSync: @escaping (ClipManifestPacket) -> Void) {
        pollTimer = Timer.scheduledTimer(withTimeInterval: 0.15, repeats: true) { [weak self] _ in
            self?.pollOutboundPasteboard(broadcast: onRemoteSync)
        }
    }

    private func pollOutboundPasteboard(broadcast: (ClipManifestPacket) -> Void) {
        guard pasteboard.changeCount != lastChangeCount else { return }
        lastChangeCount = pasteboard.changeCount

        // Ignore concealed/sensitive passwords copied from 1Password, Bitwarden, or Keychain
        let concealedType = NSPasteboard.PasteboardType("org.nspasteboard.ConcealedType")
        if pasteboard.types?.contains(concealedType) == true { return }

        // Priority 1: Files copied in Finder
        if let urls = pasteboard.readObjects(forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true]) as? [URL], !urls.isEmpty {
            broadcast(ClipManifestPacket.fromFileURLs(urls))
            return
        }

        // Priority 2: Direct Image Bitmaps (e.g. Cmd+Ctrl+Shift+4 Screenshots)
        if let pngData = pasteboard.data(forType: .png) ?? pasteboard.data(forType: .tiff) {
            broadcast(ClipManifestPacket.fromRawImage(pngData, mimeType: "image/png"))
            return
        }

        // Priority 3: Rich HTML + Plain Text fallback
        if let html = pasteboard.string(forType: .html), let plain = pasteboard.string(forType: .string) {
            broadcast(ClipManifestPacket.fromHTML(plain: plain, html: html))
            return
        }

        // Priority 4: Plain UTF-8 Text
        if let plain = pasteboard.string(forType: .string) {
            broadcast(ClipManifestPacket.fromText(plain))
        }
    }

    public func applyInboundManifest(_ manifest: ClipManifestPacket) {
        pasteboard.clearContents()
        activePromises.removeAll()

        switch manifest.primaryKind {
        case .text(let plain):
            pasteboard.setString(plain, forType: .string)

        case .html(let plain, let html):
            pasteboard.setString(html, forType: .html)
            pasteboard.setString(plain, forType: .string)

        case .stream(let meta):
            let pbItem = NSPasteboardItem()
            activePromises[pbItem] = meta

            if meta.mimeType.hasPrefix("image/") {
                pbItem.setDataProvider(self, forTypes: [.png, .tiff])
            } else {
                pbItem.setDataProvider(self, forTypes: [.fileURL])
            }
            pasteboard.writeObjects([pbItem])
        }
        lastChangeCount = pasteboard.changeCount
    }

    // Invoked by macOS WindowServer ONLY when user presses Cmd+V
    public func pasteboard(_ pasteboard: NSPasteboard?, item: NSPasteboardItem, provideDataForType type: NSPasteboard.PasteboardType) {
        guard let meta = activePromises[item] else { return }
        guard let streamedData = try? Data(contentsOf: meta.streamURL) else { return }

        if type == .png || type == .tiff {
            item.setData(streamedData, forType: type)
        } else if type == .fileURL {
            let safeName = URL(fileURLWithPath: meta.fileName).lastPathComponent
            let destURL = stagingDir.appendingPathComponent(safeName)
            try? streamedData.write(to: destURL, options: .atomic)
            item.setString(destURL.absoluteString, forType: .fileURL)
        }
    }
}
