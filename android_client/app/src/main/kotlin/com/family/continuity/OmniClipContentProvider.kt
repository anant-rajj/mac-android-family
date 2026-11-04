package com.family.continuity

import android.content.*
import android.content.res.AssetFileDescriptor
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap

data class RemoteClipItem(
    val clipId: String,
    val index: Int,
    val fileName: String,
    val mimeType: String,
    val size: Long,
    val peerStreamUrl: String // e.g. "http://10.7.17.83:27184/stream/{clipId}/{index}"
)

/**
 * OmniClipContentProvider:
 * Zero-copy virtual stream ContentProvider that allows any Android app
 * (WhatsApp, Gmail, Notes, Slack) to stream files/images copied on macOS
 * directly on Paste without intermediate disk bloat.
 */
class OmniClipContentProvider : ContentProvider(), ContentProvider.PipeDataWriter<RemoteClipItem> {

    companion object {
        const val AUTHORITY = "com.family.continuity.omniclip.provider"
        private val activeClips = ConcurrentHashMap<String, RemoteClipItem>()

        fun registerRemoteItem(item: RemoteClipItem): Uri {
            val key = "${item.clipId}/${item.index}"
            activeClips[key] = item
            return Uri.parse("content://$AUTHORITY/clip/$key")
        }
    }

    override fun onCreate(): Boolean = true

    private fun resolveItem(uri: Uri): RemoteClipItem? {
        val segments = uri.pathSegments
        if (segments.size < 3 || segments[0] != "clip") return null
        return activeClips["${segments[1]}/${segments[2]}"]
    }

    override fun getType(uri: Uri): String? = resolveItem(uri)?.mimeType

    override fun getStreamTypes(uri: Uri, mimeTypeFilter: String): Array<String>? {
        val item = resolveItem(uri) ?: return null
        return arrayOf(item.mimeType)
    }

    override fun query(
        uri: Uri, projection: Array<out String>?, selection: String?,
        selectionArgs: Array<out String>?, sortOrder: String?
    ): Cursor? {
        val item = resolveItem(uri) ?: return null
        val cols = projection ?: arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)
        val cursor = MatrixCursor(cols, 1)
        val row = cursor.newRow()
        for (col in cols) {
            when (col) {
                OpenableColumns.DISPLAY_NAME -> row.add(sanitizeFileName(item.fileName))
                OpenableColumns.SIZE -> row.add(item.size)
            }
        }
        return cursor
    }

    override fun openTypedAssetFile(uri: Uri, mimeTypeFilter: String, opts: Bundle?): AssetFileDescriptor? {
        val item = resolveItem(uri) ?: return null
        val pfd: ParcelFileDescriptor = openPipeHelper(uri, item.mimeType, opts, item, this)
        return AssetFileDescriptor(pfd, 0, item.size)
    }

    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor? {
        val item = resolveItem(uri) ?: return null
        return openPipeHelper(uri, item.mimeType, null, item, this)
    }

    override fun writeDataToPipe(
        output: ParcelFileDescriptor, uri: Uri, mimeType: String,
        opts: Bundle?, args: RemoteClipItem?
    ) {
        val item = args ?: return
        ParcelFileDescriptor.AutoCloseOutputStream(output).use { outStream ->
            val conn = (URL(item.peerStreamUrl).openConnection() as HttpURLConnection).apply {
                connectTimeout = 3000
                readTimeout = 15000
                requestMethod = "GET"
            }
            conn.inputStream.use { netIn ->
                val buffer = ByteArray(64 * 1024)
                var read: Int
                while (netIn.read(buffer).also { read = it } != -1) {
                    outStream.write(buffer, 0, read)
                }
                outStream.flush()
            }
        }
    }

    // CVE-2025-27142 Path Traversal Sanitizer
    private fun sanitizeFileName(raw: String): String =
        raw.substringAfterLast('/').substringAfterLast('\\').replace("..", "_")

    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
    override fun update(uri: Uri, values: ContentValues?, s: String?, sa: Array<out String>?): Int = 0
}
