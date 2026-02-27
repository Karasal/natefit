import Foundation
import Combine

/// Manages Supabase authentication state.
/// Uses supabase-swift SDK under the hood.
///
/// Add to your project via SPM:
///   https://github.com/supabase-community/supabase-swift
///   Package: Supabase (>= 2.0.0)
class AuthService: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isLoading = true
    @Published var currentUser: UserProfile?

    /// The current session access token for API calls.
    var sessionToken: String? {
        return storedAccessToken
    }

    private let supabaseURL: String
    private let supabaseAnonKey: String
    private var storedAccessToken: String?
    private var storedRefreshToken: String?

    // Keychain identifiers
    private let keychainAccessTokenKey = "com.natefit.accessToken"
    private let keychainRefreshTokenKey = "com.natefit.refreshToken"

    init() {
        self.supabaseURL = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String
            ?? "https://your-project.supabase.co"
        self.supabaseAnonKey = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String
            ?? ""

        // Load persisted tokens
        storedAccessToken = KeychainHelper.load(key: keychainAccessTokenKey)
        storedRefreshToken = KeychainHelper.load(key: keychainRefreshTokenKey)
    }

    // MARK: - Sign in with email/password

    func signIn(email: String, password: String) async throws {
        let url = URL(string: "\(supabaseURL)/auth/v1/token?grant_type=password")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")

        let body: [String: String] = ["email": email, "password": password]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let errorBody = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let message = errorBody?["error_description"] as? String
                ?? errorBody?["msg"] as? String
                ?? "Sign in failed"
            throw AuthError.signInFailed(message)
        }

        try handleAuthResponse(data: data)
    }

    // MARK: - Magic link

    func signInWithMagicLink(email: String) async throws {
        let url = URL(string: "\(supabaseURL)/auth/v1/magiclink")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")

        let body: [String: String] = ["email": email]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw AuthError.signInFailed("Failed to send magic link")
        }
    }

    // MARK: - Refresh session

    func refreshSession() async {
        defer {
            DispatchQueue.main.async { self.isLoading = false }
        }

        guard let refreshToken = storedRefreshToken else {
            DispatchQueue.main.async { self.isAuthenticated = false }
            return
        }

        let url = URL(string: "\(supabaseURL)/auth/v1/token?grant_type=refresh_token")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")

        let body: [String: String] = ["refresh_token": refreshToken]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                DispatchQueue.main.async { self.isAuthenticated = false }
                clearTokens()
                return
            }
            try handleAuthResponse(data: data)
        } catch {
            DispatchQueue.main.async { self.isAuthenticated = false }
        }
    }

    // MARK: - Sign out

    func signOut() async throws {
        if let token = storedAccessToken {
            let url = URL(string: "\(supabaseURL)/auth/v1/logout")!
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
            _ = try? await URLSession.shared.data(for: request)
        }

        clearTokens()
        DispatchQueue.main.async {
            self.isAuthenticated = false
            self.currentUser = nil
        }
    }

    // MARK: - Internal

    private func handleAuthResponse(data: Data) throws {
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let accessToken = json["access_token"] as? String,
              let refreshToken = json["refresh_token"] as? String else {
            throw AuthError.signInFailed("Invalid auth response")
        }

        // Persist tokens
        storedAccessToken = accessToken
        storedRefreshToken = refreshToken
        KeychainHelper.save(key: keychainAccessTokenKey, value: accessToken)
        KeychainHelper.save(key: keychainRefreshTokenKey, value: refreshToken)

        // Parse user
        if let userDict = json["user"] as? [String: Any] {
            let id = userDict["id"] as? String ?? ""
            let email = userDict["email"] as? String ?? ""
            DispatchQueue.main.async {
                self.currentUser = UserProfile(id: id, email: email)
                self.isAuthenticated = true
            }
        } else {
            DispatchQueue.main.async { self.isAuthenticated = true }
        }
    }

    private func clearTokens() {
        storedAccessToken = nil
        storedRefreshToken = nil
        KeychainHelper.delete(key: keychainAccessTokenKey)
        KeychainHelper.delete(key: keychainRefreshTokenKey)
    }
}

// MARK: - Auth error

enum AuthError: LocalizedError {
    case signInFailed(String)

    var errorDescription: String? {
        switch self {
        case .signInFailed(let message): return message
        }
    }
}

// MARK: - User profile

struct UserProfile {
    let id: String
    let email: String
}

// MARK: - Keychain helper

struct KeychainHelper {
    static func save(key: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)

        let attributes: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        SecItemAdd(attributes as CFDictionary, nil)
    }

    static func load(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess, let data = result as? Data else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    static func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
    }
}
