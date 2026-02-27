import Foundation

enum APIError: LocalizedError {
    case unauthorized
    case invalidURL
    case serverError(statusCode: Int, message: String)
    case decodingError
    case networkError(Error)

    var errorDescription: String? {
        switch self {
        case .unauthorized:
            return "Not authenticated. Please sign in again."
        case .invalidURL:
            return "Invalid server URL."
        case .serverError(let code, let message):
            return "Server error (\(code)): \(message)"
        case .decodingError:
            return "Failed to parse server response."
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }
}

class APIClient: ObservableObject {

    private let baseURL: String
    private let session: URLSession

    init() {
        // Read API URL from Info.plist or use default
        self.baseURL = Bundle.main.object(forInfoDictionaryKey: "SCAN_API_URL") as? String
            ?? "https://api.natefit.com"

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 120
        self.session = URLSession(configuration: config)
    }

    // MARK: - Upload scan

    func uploadScan(
        data: ScanData,
        token: String,
        onProgress: @escaping (Double) -> Void,
        retryCount: Int = 1
    ) async throws -> ScanResult {
        guard let url = URL(string: "\(baseURL)/api/scan") else {
            throw APIError.invalidURL
        }

        let boundary = UUID().uuidString
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        let body = buildMultipartBody(data: data, boundary: boundary)
        request.httpBody = body

        onProgress(0.1)

        var lastError: Error?
        for attempt in 0...retryCount {
            do {
                let (responseData, response) = try await session.data(for: request)

                onProgress(0.8)

                guard let httpResponse = response as? HTTPURLResponse else {
                    throw APIError.networkError(URLError(.badServerResponse))
                }

                if httpResponse.statusCode == 401 {
                    throw APIError.unauthorized
                }

                guard (200...299).contains(httpResponse.statusCode) else {
                    let message = String(data: responseData, encoding: .utf8) ?? "Unknown error"
                    throw APIError.serverError(statusCode: httpResponse.statusCode, message: message)
                }

                let decoder = JSONDecoder()
                decoder.keyDecodingStrategy = .convertFromSnakeCase

                guard let result = try? decoder.decode(ScanResult.self, from: responseData) else {
                    throw APIError.decodingError
                }

                onProgress(1.0)
                return result

            } catch let error as APIError {
                // Don't retry auth errors
                if case .unauthorized = error { throw error }
                lastError = error
                if attempt < retryCount {
                    try await Task.sleep(nanoseconds: 2_000_000_000) // 2s backoff
                }
            } catch {
                lastError = error
                if attempt < retryCount {
                    try await Task.sleep(nanoseconds: 2_000_000_000)
                }
            }
        }

        throw lastError.map { APIError.networkError($0) } ?? APIError.networkError(URLError(.unknown))
    }

    // MARK: - Fetch clients

    func fetchClients(token: String) async throws -> [Client] {
        guard let url = URL(string: "\(baseURL)/api/clients") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError(URLError(.badServerResponse))
        }

        if httpResponse.statusCode == 401 { throw APIError.unauthorized }

        guard (200...299).contains(httpResponse.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw APIError.serverError(statusCode: httpResponse.statusCode, message: message)
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601

        guard let clients = try? decoder.decode([Client].self, from: data) else {
            throw APIError.decodingError
        }

        return clients
    }

    // MARK: - Multipart body builder

    private func buildMultipartBody(data: ScanData, boundary: String) -> Data {
        var body = Data()

        // Front RGB image
        appendFile(to: &body, boundary: boundary, name: "front_image", filename: "front.jpg",
                   mimeType: "image/jpeg", data: data.frontRGB)

        // Side RGB image
        appendFile(to: &body, boundary: boundary, name: "side_image", filename: "side.jpg",
                   mimeType: "image/jpeg", data: data.sideRGB)

        // Front depth (raw float32 binary)
        if let frontDepth = data.frontDepth {
            appendFile(to: &body, boundary: boundary, name: "depth_front", filename: "depth_front.bin",
                       mimeType: "application/octet-stream", data: frontDepth)
        }

        // Side depth
        if let sideDepth = data.sideDepth {
            appendFile(to: &body, boundary: boundary, name: "depth_side", filename: "depth_side.bin",
                       mimeType: "application/octet-stream", data: sideDepth)
        }

        // Front confidence
        if let frontConf = data.frontConfidence {
            appendFile(to: &body, boundary: boundary, name: "confidence_front", filename: "confidence_front.bin",
                       mimeType: "application/octet-stream", data: frontConf)
        }

        // Side confidence
        if let sideConf = data.sideConfidence {
            appendFile(to: &body, boundary: boundary, name: "confidence_side", filename: "confidence_side.bin",
                       mimeType: "application/octet-stream", data: sideConf)
        }

        // Camera intrinsics (JSON)
        if let intrinsics = data.intrinsics {
            let intrinsicsJSON: [String: Double] = [
                "fx": intrinsics.fx,
                "fy": intrinsics.fy,
                "cx": intrinsics.cx,
                "cy": intrinsics.cy
            ]
            if let jsonData = try? JSONSerialization.data(withJSONObject: intrinsicsJSON) {
                appendFile(to: &body, boundary: boundary, name: "camera_intrinsics", filename: "intrinsics.json",
                           mimeType: "application/json", data: jsonData)
            }
        }

        // Scalar fields
        appendField(to: &body, boundary: boundary, name: "height_cm", value: "\(data.heightCm)")
        appendField(to: &body, boundary: boundary, name: "weight_kg", value: "\(data.weightKg)")
        appendField(to: &body, boundary: boundary, name: "age", value: "\(data.age)")
        appendField(to: &body, boundary: boundary, name: "sex", value: data.sex)
        appendField(to: &body, boundary: boundary, name: "client_id", value: data.clientId)

        // Closing boundary
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        return body
    }

    private func appendField(to body: inout Data, boundary: String, name: String, value: String) {
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(value)\r\n".data(using: .utf8)!)
    }

    private func appendFile(to body: inout Data, boundary: String, name: String, filename: String,
                            mimeType: String, data: Data) {
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"\(name)\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(data)
        body.append("\r\n".data(using: .utf8)!)
    }
}
