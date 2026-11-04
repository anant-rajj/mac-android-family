package com.family.continuity

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Fast-path sub-frame UDP telemetry client
 */
class TelemetryClient(private val hostIp: String = "127.0.0.1", private val port: Int = 9876) {
    private val socket = DatagramSocket()
    private val address: InetAddress = InetAddress.getByName(hostIp)
    private val buffer = ByteBuffer.allocate(23).order(ByteOrder.LITTLE_ENDIAN)
    private val scope = CoroutineScope(Dispatchers.IO)

    fun send(normX: Float, normY: Float, pressure: Float, tiltX: Float, tiltY: Float, action: Int) {
        scope.launch {
            synchronized(buffer) {
                buffer.clear()
                buffer.put(0xFA.toByte())
                buffer.put(0xCE.toByte())
                buffer.put(action.toByte())
                buffer.putFloat(normX)
                buffer.putFloat(normY)
                buffer.putFloat(pressure)
                buffer.putFloat(tiltX)
                buffer.putFloat(tiltY)
                
                val packet = DatagramPacket(buffer.array(), 23, address, port)
                try {
                    socket.send(packet)
                } catch (_: Exception) {}
            }
        }
    }
}
