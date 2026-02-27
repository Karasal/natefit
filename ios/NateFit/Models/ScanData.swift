import Foundation

/// Data captured from the iOS device to send to the GPU backend.
struct ScanData {
    /// Front-facing RGB image as JPEG (quality 0.92)
    let frontRGB: Data

    /// Side-facing RGB image as JPEG (quality 0.92)
    let sideRGB: Data

    /// Front LiDAR depth map as raw float32 binary (256x192, ~196KB).
    /// nil on non-LiDAR devices.
    let frontDepth: Data?

    /// Side LiDAR depth map as raw float32 binary.
    let sideDepth: Data?

    /// Front confidence map as raw uint8 binary (256x192).
    /// Values: 0=low, 1=medium, 2=high.
    let frontConfidence: Data?

    /// Side confidence map as raw uint8 binary.
    let sideConfidence: Data?

    /// Camera intrinsics from the LiDAR sensor.
    let intrinsics: CameraIntrinsics?

    /// Client's height in centimeters (user-entered).
    let heightCm: Double

    /// Client's weight in kilograms (user-entered).
    let weightKg: Double

    /// Client's age in years.
    let age: Int

    /// Biological sex: "male" or "female".
    let sex: String

    /// Supabase client ID.
    let clientId: String
}

/// Camera intrinsics extracted from ARFrame.camera.intrinsics.
struct CameraIntrinsics: Codable {
    /// Focal length x (pixels)
    let fx: Double
    /// Focal length y (pixels)
    let fy: Double
    /// Principal point x (pixels)
    let cx: Double
    /// Principal point y (pixels)
    let cy: Double
}
