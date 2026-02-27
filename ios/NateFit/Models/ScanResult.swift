import Foundation

/// Response from the GPU backend after processing a scan.
struct ScanResult: Codable {
    /// Unique scan ID from the backend.
    let scanId: String?

    /// Circumference measurements in centimeters, keyed by body region.
    /// e.g. "chest": 96.5, "waist": 82.3, "hips": 98.1
    let measurements: [String: Double]

    /// Body composition analysis.
    let bodyComposition: BodyComposition?

    /// 3D mesh vertices as flat array [x,y,z, x,y,z, ...].
    let meshVertices: [Double]?

    /// 3D mesh face indices as flat array [i,j,k, i,j,k, ...].
    let meshFaces: [Int]?

    /// Overall scan confidence (0.0 to 1.0).
    let confidence: Double

    /// Scan tier: "pro" (LiDAR), "standard" (photo-only), "basic" (fallback).
    let scanTier: String

    enum CodingKeys: String, CodingKey {
        case scanId = "scan_id"
        case measurements
        case bodyComposition = "body_composition"
        case meshVertices = "mesh_vertices"
        case meshFaces = "mesh_faces"
        case confidence
        case scanTier = "scan_tier"
    }
}

/// Body composition breakdown.
struct BodyComposition: Codable {
    /// Body fat percentage (e.g. 18.5).
    let bodyFatPercentage: Double

    /// Lean mass in kilograms.
    let leanMassKg: Double

    /// Fat mass in kilograms.
    let fatMassKg: Double

    /// BMI value (optional, may not be returned by all tiers).
    let bmi: Double?

    /// Estimation method used: "navy", "cun_bae", "ensemble".
    let method: String?

    enum CodingKeys: String, CodingKey {
        case bodyFatPercentage = "body_fat_percentage"
        case leanMassKg = "lean_mass_kg"
        case fatMassKg = "fat_mass_kg"
        case bmi
        case method
    }
}
