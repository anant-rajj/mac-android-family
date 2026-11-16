package com.family.continuity

import android.os.Bundle
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var telemetryClient: TelemetryClient
    private lateinit var captureView: SpenCaptureView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Prevent screen dimming during drawing sessions
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        
        // Default to localhost or Wi-Fi LAN IP (port 9876)
        telemetryClient = TelemetryClient("10.0.2.2", 9876)

        captureView = SpenCaptureView(this) { x, y, pressure, tiltX, tiltY, action ->
            telemetryClient.send(x, y, pressure, tiltX, tiltY, action)
        }

        setContentView(captureView)
    }
}
