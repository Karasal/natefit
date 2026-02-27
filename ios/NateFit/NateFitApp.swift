import SwiftUI

@main
struct NateFitApp: App {
    @StateObject private var authService = AuthService()
    @StateObject private var apiClient = APIClient()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authService)
                .environmentObject(apiClient)
                .preferredColorScheme(.dark)
        }
    }
}
