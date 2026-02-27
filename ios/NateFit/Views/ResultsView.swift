import SwiftUI

struct ResultsView: View {
    let result: ScanResult
    let client: Client

    @Environment(\.dismiss) var dismiss

    var body: some View {
        ZStack {
            Color.nateDark.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 20) {
                    // Header
                    VStack(spacing: 4) {
                        Text("Scan Complete")
                            .font(.system(size: 24, weight: .bold))
                            .foregroundColor(.white)
                        Text(client.fullName)
                            .font(.system(size: 16))
                            .foregroundColor(.white.opacity(0.6))

                        ScanTierBadge(tier: result.scanTier)
                            .padding(.top, 4)
                    }
                    .padding(.top, 8)

                    // Body composition
                    if let comp = result.bodyComposition {
                        BodyCompositionCard(composition: comp)
                    }

                    // Confidence
                    ConfidenceCard(confidence: result.confidence)

                    // Measurements
                    MeasurementsCard(measurements: result.measurements)

                    // Actions
                    VStack(spacing: 12) {
                        Button(action: openDashboard) {
                            Label("View in Dashboard", systemImage: "arrow.up.right.square")
                                .frame(maxWidth: .infinity)
                                .frame(height: 50)
                                .background(Color.neonGreen)
                                .foregroundColor(.black)
                                .fontWeight(.semibold)
                                .cornerRadius(12)
                        }

                        Button(action: { dismiss() }) {
                            Text("Scan Again")
                                .frame(maxWidth: .infinity)
                                .frame(height: 50)
                                .background(Color.nateCard)
                                .foregroundColor(.white)
                                .cornerRadius(12)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(Color.nateBorder, lineWidth: 1)
                                )
                        }
                    }
                    .padding(.top, 8)
                }
                .padding(20)
            }
        }
        .navigationBarBackButtonHidden(true)
    }

    private func openDashboard() {
        guard let url = URL(string: "natefit://dashboard/scan/\(result.scanId ?? "latest")") else { return }
        UIApplication.shared.open(url)
    }
}

// MARK: - Scan tier badge

struct ScanTierBadge: View {
    let tier: String

    var tierColor: Color {
        switch tier.lowercased() {
        case "pro": return .neonGreen
        case "standard": return .blue
        default: return .orange
        }
    }

    var body: some View {
        Text(tier.uppercased())
            .font(.system(size: 11, weight: .bold, design: .monospaced))
            .foregroundColor(tierColor)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(tierColor.opacity(0.15))
            .cornerRadius(6)
    }
}

// MARK: - Body composition card

struct BodyCompositionCard: View {
    let composition: BodyComposition

    var body: some View {
        VStack(spacing: 16) {
            Text("Body Composition")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.white.opacity(0.6))
                .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 16) {
                CompositionGauge(label: "Body Fat", value: composition.bodyFatPercentage, unit: "%", color: .orange)
                CompositionGauge(label: "Lean Mass", value: composition.leanMassKg, unit: "kg", color: .neonGreen)
                CompositionGauge(label: "Fat Mass", value: composition.fatMassKg, unit: "kg", color: .red)
            }

            if let bmi = composition.bmi {
                HStack {
                    Text("BMI")
                        .font(.system(size: 13))
                        .foregroundColor(.white.opacity(0.5))
                    Spacer()
                    Text(String(format: "%.1f", bmi))
                        .font(.system(size: 16, weight: .semibold, design: .monospaced))
                        .foregroundColor(.white)
                }
            }
        }
        .padding(16)
        .background(Color.nateCard)
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.nateBorder, lineWidth: 1))
    }
}

struct CompositionGauge: View {
    let label: String
    let value: Double
    let unit: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Text(String(format: "%.1f", value))
                .font(.system(size: 22, weight: .bold, design: .monospaced))
                .foregroundColor(color)
            Text(unit)
                .font(.system(size: 12))
                .foregroundColor(.white.opacity(0.4))
            Text(label)
                .font(.system(size: 11))
                .foregroundColor(.white.opacity(0.6))
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Confidence card

struct ConfidenceCard: View {
    let confidence: Double

    var confidenceColor: Color {
        if confidence >= 0.8 { return .neonGreen }
        if confidence >= 0.5 { return .orange }
        return .red
    }

    var body: some View {
        HStack {
            Text("Scan Confidence")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.white.opacity(0.6))
            Spacer()
            Text("\(Int(confidence * 100))%")
                .font(.system(size: 18, weight: .bold, design: .monospaced))
                .foregroundColor(confidenceColor)
        }
        .padding(16)
        .background(Color.nateCard)
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.nateBorder, lineWidth: 1))
    }
}

// MARK: - Measurements card

struct MeasurementsCard: View {
    let measurements: [String: Double]

    var sortedKeys: [String] {
        measurements.keys.sorted()
    }

    var body: some View {
        VStack(spacing: 12) {
            Text("Measurements")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(.white.opacity(0.6))
                .frame(maxWidth: .infinity, alignment: .leading)

            ForEach(sortedKeys, id: \.self) { key in
                HStack {
                    Text(formatKey(key))
                        .font(.system(size: 14))
                        .foregroundColor(.white.opacity(0.8))
                    Spacer()
                    Text(String(format: "%.1f cm", measurements[key] ?? 0))
                        .font(.system(size: 14, weight: .medium, design: .monospaced))
                        .foregroundColor(.white)
                }
                if key != sortedKeys.last {
                    Divider().background(Color.nateBorder)
                }
            }
        }
        .padding(16)
        .background(Color.nateCard)
        .cornerRadius(16)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.nateBorder, lineWidth: 1))
    }

    private func formatKey(_ key: String) -> String {
        key.replacingOccurrences(of: "_", with: " ").capitalized
    }
}
