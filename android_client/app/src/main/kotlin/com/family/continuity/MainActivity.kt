package com.family.continuity

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var telemetryClient: TelemetryClient
    private lateinit var captureView: SpenCaptureView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Default to USB ADB loopback (127.0.0.1:9876 with `adb forward tcp:9876 udp:9876`)
        telemetryClient = TelemetryClient("10.0.2.2", 9876)

        captureView = SpenCaptureView(this) { x, y, pressure, tiltX, tiltY, action ->
            telemetryClient.send(x, y, pressure, tiltX, tiltY, action)
        }

        setContentView(captureView)
    }
}
