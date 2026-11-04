package com.family.continuity

import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.content.Context
import android.net.Uri
import android.os.Build

enum class ItemKind {
    TEXT, HTML, STREAM
}

data class ManifestItem(
    val index: Int,
    val kind: ItemKind,
    val mimeType: String,
    val fileName: String = "",
    val size: Long = 0,
    val plainText: String = "",
    val htmlText: String = "",
    val localUri: Uri? = null,
    val peerStreamUrl: String = ""
) {
    fun toRemoteClipItem(clipId: String): RemoteClipItem {
        return RemoteClipItem(
            clipId = clipId,
            index = index,
            fileName = fileName,
            mimeType = mimeType,
            size = size,
            peerStreamUrl = peerStreamUrl
        )
    }

    companion object {
        fun fromText(index: Int, text: String) = ManifestItem(
            index = index,
            kind = ItemKind.TEXT,
            mimeType = "text/plain",
            plainText = text
        )

        fun fromHtml(index: Int, text: String, html: String) = ManifestItem(
            index = index,
            kind = ItemKind.HTML,
            mimeType = "text/html",
            plainText = text,
            htmlText = html
        )

        fun fromLocalUri(index: Int, uri: Uri, mimeType: String, fileName: String = "file_$index", size: Long = 0) = ManifestItem(
            index = index,
            kind = ItemKind.STREAM,
            mimeType = mimeType,
            fileName = fileName,
            size = size,
            localUri = uri
        )
    }
}

data class ClipManifestPacket(
    val clipId: String = java.util.UUID.randomUUID().toString(),
    val contentHash: Int = 0,
    val items: List<ManifestItem>
)

/**
 * Universal Android Clipboard Controller:
 * Handles outbound extraction (with EXTRA_IS_SENSITIVE password drop)
 * and inbound injection (text, HTML, and multi-stream ContentProvider URIs).
 */
class AndroidClipboardController(
    private val context: Context,
    private val networkBroadcaster: (ClipManifestPacket) -> Unit
) {
    private val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    private var lastInjectedHash: Int = 0

    fun captureAndBroadcastOutboundClip() {
        val clip: ClipData = clipboard.primaryClip ?: return
        val desc: ClipDescription = clip.description

        // Drop passwords from Bitwarden/1Password/Samsung Pass
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (desc.extras?.getBoolean(ClipDescription.EXTRA_IS_SENSITIVE, false) == true) return
        } else {
            if (desc.extras?.getBoolean("android.content.extra.IS_SENSITIVE", false) == true) return
        }

        val itemsPayload = mutableListOf<ManifestItem>()
        for (i in 0 until clip.itemCount) {
            val item = clip.getItemAt(i)
            val uri = item.uri
            when {
                uri != null -> {
                    val mime = context.contentResolver.getType(uri) ?: "application/octet-stream"
                    itemsPayload.add(ManifestItem.fromLocalUri(i, uri, mime))
                }
                item.htmlText != null -> {
                    itemsPayload.add(ManifestItem.fromHtml(i, item.text.toString(), item.htmlText))
                }
                item.text != null -> {
                    itemsPayload.add(ManifestItem.fromText(i, item.text.toString()))
                }
            }
        }

        if (itemsPayload.isNotEmpty()) {
            val hash = itemsPayload.hashCode()
            if (hash != lastInjectedHash) {
                val packet = ClipManifestPacket(contentHash = hash, items = itemsPayload)
                networkBroadcaster(packet)
            }
        }
    }

    fun applyInboundClipManifest(packet: ClipManifestPacket) {
        lastInjectedHash = packet.contentHash
        val first = packet.items.firstOrNull() ?: return

        val clipData: ClipData = when (first.kind) {
            ItemKind.TEXT -> ClipData.newPlainText("OmniClip", first.plainText)
            ItemKind.HTML -> ClipData.newHtmlText("OmniClip", first.plainText, first.htmlText)
            ItemKind.STREAM -> {
                val firstUri = OmniClipContentProvider.registerRemoteItem(first.toRemoteClipItem(packet.clipId))
                val data = ClipData.newUri(context.contentResolver, first.fileName, firstUri)
                for (idx in 1 until packet.items.size) {
                    val nextItem = packet.items[idx]
                    val nextUri = OmniClipContentProvider.registerRemoteItem(nextItem.toRemoteClipItem(packet.clipId))
                    data.addItem(ClipData.Item(nextUri))
                }
                data
            }
        }
        clipboard.setPrimaryClip(clipData)
    }
}
