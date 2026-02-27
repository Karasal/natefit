import SwiftUI

struct ClientSelectView: View {
    @EnvironmentObject var authService: AuthService
    @EnvironmentObject var apiClient: APIClient

    @State private var clients: [Client] = []
    @State private var searchText = ""
    @State private var isLoading = true
    @State private var errorMessage: String?

    var filteredClients: [Client] {
        if searchText.isEmpty { return clients }
        return clients.filter {
            $0.fullName.localizedCaseInsensitiveContains(searchText) ||
            $0.email.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        ZStack {
            Color.nateDark.ignoresSafeArea()

            if isLoading {
                ProgressView()
                    .tint(.neonGreen)
                    .scaleEffect(1.5)
            } else if let error = errorMessage {
                VStack(spacing: 12) {
                    Text("Failed to load clients")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(.white)
                    Text(error)
                        .font(.system(size: 14))
                        .foregroundColor(.white.opacity(0.5))
                    Button("Retry") { Task { await loadClients() } }
                        .foregroundColor(.neonGreen)
                }
            } else {
                List {
                    ForEach(filteredClients) { client in
                        NavigationLink(value: client) {
                            ClientRow(client: client)
                        }
                        .listRowBackground(Color.nateCard)
                        .listRowSeparatorTint(Color.nateBorder)
                    }
                }
                .listStyle(.plain)
                .searchable(text: $searchText, prompt: "Search clients")
                .refreshable { await loadClients() }
            }
        }
        .navigationTitle("Clients")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button(action: { Task { try? await authService.signOut() } }) {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .foregroundColor(.white.opacity(0.6))
                }
            }
        }
        .navigationDestination(for: Client.self) { client in
            ScanCaptureView(client: client)
        }
        .task { await loadClients() }
    }

    private func loadClients() async {
        isLoading = true
        errorMessage = nil
        do {
            guard let token = authService.sessionToken else {
                throw APIError.unauthorized
            }
            clients = try await apiClient.fetchClients(token: token)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

struct ClientRow: View {
    let client: Client

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color.neonGreen.opacity(0.2))
                .frame(width: 44, height: 44)
                .overlay(
                    Text(client.initials)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.neonGreen)
                )

            VStack(alignment: .leading, spacing: 4) {
                Text(client.fullName)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(.white)
                Text(client.email)
                    .font(.system(size: 13))
                    .foregroundColor(.white.opacity(0.5))
            }

            Spacer()

            if let lastScan = client.lastScanDate {
                Text(lastScan, style: .date)
                    .font(.system(size: 12))
                    .foregroundColor(.white.opacity(0.4))
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Client model

struct Client: Identifiable, Hashable, Codable {
    let id: String
    let firstName: String
    let lastName: String
    let email: String
    let lastScanDate: Date?

    var fullName: String { "\(firstName) \(lastName)" }

    var initials: String {
        let first = firstName.prefix(1).uppercased()
        let last = lastName.prefix(1).uppercased()
        return "\(first)\(last)"
    }

    enum CodingKeys: String, CodingKey {
        case id
        case firstName = "first_name"
        case lastName = "last_name"
        case email
        case lastScanDate = "last_scan_date"
    }
}
