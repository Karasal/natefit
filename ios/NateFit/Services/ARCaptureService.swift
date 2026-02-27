import Foundation
import ARKit
import Combine

/// Manages ARKit session and captures RGB + LiDAR depth data.
class ARCaptureService: NSObject, ObservableObject, ARSessionDelegate {
    let session = ARSession()

    @Published var hasLiDAR = false
    @Published var depthQuality: Double = 0
    @Published var poseFeedback: String?
    @Published var isSessionRunning = false

    private var currentFrame: ARFrame?

    override init() {
        super.init()
        session.delegate = self
        hasLiDAR = ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth)
    }

    // MARK: - Session lifecycle

    func startSession() {
        let config = ARWorldTrackingConfiguration()

        if ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) {
            config.frameSemantics.insert(.sceneDepth)
        }
        if ARWorldTrackingConfiguration.supportsFrameSemantics(.smoothedSceneDepth) {
            config.frameSemantics.insert(.smoothedSceneDepth)
        }

        session.run(config, options: [.resetTracking, .removeExistingAnchors])
        isSessionRunning = true
    }

    func pauseSession() {
        session.pause()
        isSessionRunning = false
    }

    func resetSession() {
        pauseSession()
        startSession()
    }

    // MARK: - Frame capture

    func captureCurrentFrame() -> CapturedFrame? {
        guard let frame = currentFrame else { return nil }

        let rgbJPEG = extractRGBImage(from: frame)
        let depthData = extractDepthMap(from: frame)
        let confidenceData = extractConfidenceMap(from: frame)
        let intrinsics = extractIntrinsics(from: frame)

        guard let jpeg = rgbJPEG else { return nil }

        return CapturedFrame(
            rgbJPEG: jpeg,
            depthData: depthData,
            confidenceData: confidenceData,
            intrinsics: intrinsics
        )
    }

    /// Extracts RGB image as JPEG data from an AR frame.
    func extractRGBImage(from frame: ARFrame) -> Data? {
        let pixelBuffer = frame.capturedImage
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        let context = CIContext()

        guard let cgImage = context.createCGImage(ciImage, from: ciImage.extent) else {
            return nil
        }

        let uiImage = UIImage(cgImage: cgImage)
        return uiImage.jpegData(compressionQuality: 0.92)
    }

    /// Extracts depth map as raw float32 binary data.
    /// LiDAR depth map: 256x192 float32 values (distance in meters).
    func extractDepthMap(from frame: ARFrame) -> Data? {
        // Prefer smoothed depth, fall back to raw scene depth
        guard let depthMap = frame.smoothedSceneDepth?.depthMap ?? frame.sceneDepth?.depthMap else {
            return nil
        }

        CVPixelBufferLockBaseAddress(depthMap, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(depthMap, .readOnly) }

        let width = CVPixelBufferGetWidth(depthMap)
        let height = CVPixelBufferGetHeight(depthMap)
        let bytesPerRow = CVPixelBufferGetBytesPerRow(depthMap)

        guard let baseAddress = CVPixelBufferGetBaseAddress(depthMap) else {
            return nil
        }

        // float32 depth values packed row by row
        var data = Data()
        data.reserveCapacity(width * height * MemoryLayout<Float32>.size)

        for row in 0..<height {
            let rowPtr = baseAddress.advanced(by: row * bytesPerRow)
            let floatPtr = rowPtr.assumingMemoryBound(to: Float32.self)
            let rowData = Data(bytes: floatPtr, count: width * MemoryLayout<Float32>.size)
            data.append(rowData)
        }

        return data
    }

    /// Extracts confidence map as raw uint8 binary data.
    /// Values: 0 (low), 1 (medium), 2 (high).
    func extractConfidenceMap(from frame: ARFrame) -> Data? {
        guard let confidenceMap = frame.smoothedSceneDepth?.confidenceMap ?? frame.sceneDepth?.confidenceMap else {
            return nil
        }

        CVPixelBufferLockBaseAddress(confidenceMap, .readOnly)
        defer { CVPixelBufferUnlockBaseAddress(confidenceMap, .readOnly) }

        let width = CVPixelBufferGetWidth(confidenceMap)
        let height = CVPixelBufferGetHeight(confidenceMap)
        let bytesPerRow = CVPixelBufferGetBytesPerRow(confidenceMap)

        guard let baseAddress = CVPixelBufferGetBaseAddress(confidenceMap) else {
            return nil
        }

        var data = Data()
        data.reserveCapacity(width * height)

        for row in 0..<height {
            let rowPtr = baseAddress.advanced(by: row * bytesPerRow)
            let uint8Ptr = rowPtr.assumingMemoryBound(to: UInt8.self)
            let rowData = Data(bytes: uint8Ptr, count: width)
            data.append(rowData)
        }

        return data
    }

    /// Extracts camera intrinsics (fx, fy, cx, cy) from frame.
    func extractIntrinsics(from frame: ARFrame) -> CameraIntrinsics {
        let matrix = frame.camera.intrinsics
        return CameraIntrinsics(
            fx: Double(matrix[0][0]),
            fy: Double(matrix[1][1]),
            cx: Double(matrix[2][0]),
            cy: Double(matrix[2][1])
        )
    }

    // MARK: - ARSessionDelegate

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        currentFrame = frame

        // Update depth quality indicator
        if let depthMap = frame.smoothedSceneDepth?.depthMap ?? frame.sceneDepth?.depthMap {
            let width = CVPixelBufferGetWidth(depthMap)
            let height = CVPixelBufferGetHeight(depthMap)
            // Rough quality: check that we have expected resolution
            let expectedPixels = 256 * 192
            let actualPixels = width * height
            DispatchQueue.main.async {
                self.depthQuality = min(1.0, Double(actualPixels) / Double(expectedPixels))
            }
        }

        // Basic pose feedback from tracking state
        DispatchQueue.main.async {
            switch frame.camera.trackingState {
            case .notAvailable:
                self.poseFeedback = "Tracking not available"
            case .limited(let reason):
                switch reason {
                case .initializing:
                    self.poseFeedback = "Initializing..."
                case .excessiveMotion:
                    self.poseFeedback = "Move slower"
                case .insufficientFeatures:
                    self.poseFeedback = "Need more light"
                case .relocalizing:
                    self.poseFeedback = "Relocalizing..."
                @unknown default:
                    self.poseFeedback = "Limited tracking"
                }
            case .normal:
                self.poseFeedback = nil
            }
        }
    }
}

/// Holds captured RGB + depth data from a single frame.
struct CapturedFrame {
    let rgbJPEG: Data
    let depthData: Data?
    let confidenceData: Data?
    let intrinsics: CameraIntrinsics
}
