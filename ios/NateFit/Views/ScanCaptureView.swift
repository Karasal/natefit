import SwiftUI
import ARKit

enum ScanPhase {
    case front
    case side
    case uploading
    case complete
}

struct ScanCaptureView: View {
    let client: Client

    @EnvironmentObject var authService: AuthService
    @EnvironmentObject var apiClient: APIClient
    @StateObject private var arService = ARCaptureService()

    @State private var phase: ScanPhase = .front
    @State private var frontCapture: CapturedFrame?
    @State private var sideCapture: CapturedFrame?
    @State private var scanResult: ScanResult?
    @State private var errorMessage: String?
    @State private var uploadProgress: Double = 0

    // Client metadata (entered before scan or pulled from profile)
    @State private var heightCm: Double = 175
    @State private var weightKg: Double = 75
    @State private var age: Int = 30
    @State private var sex: String = "male"
    @State private var showMetadataSheet = true

    var body: some View {
        ZStack {
            Color.nateDark.ignoresSafeArea()

            switch phase {
            case .front, .side:
                cameraView
            case .uploading:
                uploadingView
            case .complete:
                if let result = scanResult {
                    ResultsView(result: result, client: client)
                }
            }
        }
        .navigationTitle(phaseTitle)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showMetadataSheet) {
            MetadataSheet(
                heightCm: $heightCm,
                weightKg: $weightKg,
                age: $age,
                sex: $sex,
                clientName: client.fullName
            )
        }
        .alert("Scan Error", isPresented: .init(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )) {
            Button("Retry") { phase = .front; frontCapture = nil; sideCapture = nil }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "An unknown error occurred.")
        }
    }

    private var phaseTitle: String {
        switch phase {
        case .front: return "Front Pose"
        case .side: return "Side Pose"
        case .uploading: return "Processing"
        case .complete: return "Results"
        }
    }

    // MARK: - Camera view

    private var cameraView: some View {
        ZStack {
            ARViewRepresentable(arService: arService)
                .ignoresSafeArea()

            PoseGuideOverlay(phase: phase)

            VStack {
                // LiDAR quality indicator
                HStack {
                    Spacer()
                    LiDARIndicator(hasLiDAR: arService.hasLiDAR, depthQuality: arService.depthQuality)
                        .padding()
                }

                Spacer()

                // Pose feedback
                if let feedback = arService.poseFeedback {
                    Text(feedback)
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(.white)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(Color.black.opacity(0.7))
                        .cornerRadius(20)
                        .padding(.bottom, 8)
                }

                // Instruction
                Text(phase == .front ? "Face the camera, arms slightly out" : "Turn 90 degrees to your left")
                    .font(.system(size: 14))
                    .foregroundColor(.white.opacity(0.8))
                    .padding(.bottom, 8)

                // Capture button
                Button(action: captureFrame) {
                    ZStack {
                        Circle()
                            .stroke(Color.neonGreen, lineWidth: 4)
                            .frame(width: 80, height: 80)
                        Circle()
                            .fill(Color.neonGreen)
                            .frame(width: 64, height: 64)
                    }
                }
                .padding(.bottom, 40)
            }
        }
        .onAppear { arService.startSession() }
        .onDisappear { arService.pauseSession() }
    }

    // MARK: - Uploading view

    private var uploadingView: some View {
        VStack(spacing: 24) {
            ProgressView(value: uploadProgress)
                .tint(.neonGreen)
                .scaleEffect(x: 1, y: 3, anchor: .center)
                .padding(.horizontal, 60)

            Text("Processing scan...")
                .font(.system(size: 18, weight: .medium))
                .foregroundColor(.white)

            Text("\(Int(uploadProgress * 100))%")
                .font(.system(size: 48, weight: .bold, design: .monospaced))
                .foregroundColor(.neonGreen)
        }
    }

    // MARK: - Actions

    private func captureFrame() {
        guard let frame = arService.captureCurrentFrame() else {
            errorMessage = "Could not capture frame. Please try again."
            return
        }

        switch phase {
        case .front:
            frontCapture = frame
            withAnimation { phase = .side }
        case .side:
            sideCapture = frame
            withAnimation { phase = .uploading }
            Task { await uploadScan() }
        default:
            break
        }
    }

    private func uploadScan() async {
        guard let front = frontCapture, let side = sideCapture else {
            errorMessage = "Missing capture data."
            return
        }

        let scanData = ScanData(
            frontRGB: front.rgbJPEG,
            sideRGB: side.rgbJPEG,
            frontDepth: front.depthData,
            sideDepth: side.depthData,
            frontConfidence: front.confidenceData,
            sideConfidence: side.confidenceData,
            intrinsics: front.intrinsics,
            heightCm: heightCm,
            weightKg: weightKg,
            age: age,
            sex: sex,
            clientId: client.id
        )

        do {
            guard let token = authService.sessionToken else {
                throw APIError.unauthorized
            }
            scanResult = try await apiClient.uploadScan(
                data: scanData,
                token: token,
                onProgress: { progress in
                    Task { @MainActor in uploadProgress = progress }
                }
            )
            withAnimation { phase = .complete }
        } catch {
            errorMessage = error.localizedDescription
            phase = .front
            frontCapture = nil
            sideCapture = nil
        }
    }
}

// MARK: - LiDAR indicator

struct LiDARIndicator: View {
    let hasLiDAR: Bool
    let depthQuality: Double

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(hasLiDAR ? Color.neonGreen : Color.orange)
                .frame(width: 8, height: 8)
            Text(hasLiDAR ? "LiDAR" : "No LiDAR")
                .font(.system(size: 12, weight: .medium, design: .monospaced))
                .foregroundColor(.white.opacity(0.7))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.black.opacity(0.6))
        .cornerRadius(16)
    }
}

// MARK: - Metadata sheet

struct MetadataSheet: View {
    @Binding var heightCm: Double
    @Binding var weightKg: Double
    @Binding var age: Int
    @Binding var sex: String
    let clientName: String

    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Color.nateDark.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        Text("Scan details for \(clientName)")
                            .font(.system(size: 16))
                            .foregroundColor(.white.opacity(0.6))
                            .padding(.top, 8)

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Height (cm)")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(.white.opacity(0.6))
                            TextField("175", value: $heightCm, format: .number)
                                .textFieldStyle(NateTextFieldStyle())
                                .keyboardType(.decimalPad)
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Weight (kg)")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(.white.opacity(0.6))
                            TextField("75", value: $weightKg, format: .number)
                                .textFieldStyle(NateTextFieldStyle())
                                .keyboardType(.decimalPad)
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Age")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(.white.opacity(0.6))
                            TextField("30", value: $age, format: .number)
                                .textFieldStyle(NateTextFieldStyle())
                                .keyboardType(.numberPad)
                        }

                        VStack(alignment: .leading, spacing: 8) {
                            Text("Sex")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(.white.opacity(0.6))
                            Picker("Sex", selection: $sex) {
                                Text("Male").tag("male")
                                Text("Female").tag("female")
                            }
                            .pickerStyle(.segmented)
                        }
                    }
                    .padding(24)
                }
            }
            .navigationTitle("Client Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Start Scan") { dismiss() }
                        .foregroundColor(.neonGreen)
                        .fontWeight(.semibold)
                }
            }
        }
        .presentationDetents([.medium])
    }
}

// MARK: - ARView representable

struct ARViewRepresentable: UIViewRepresentable {
    let arService: ARCaptureService

    func makeUIView(context: Context) -> ARSCNView {
        let view = ARSCNView()
        view.session = arService.session
        view.automaticallyUpdatesLighting = true
        return view
    }

    func updateUIView(_ uiView: ARSCNView, context: Context) {}
}
