import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authService: AuthService

    var body: some View {
        NavigationStack {
            Group {
                if authService.isLoading {
                    LoadingView()
                } else if authService.isAuthenticated {
                    ClientSelectView()
                } else {
                    LoginView()
                }
            }
        }
        .tint(Color.neonGreen)
        .task {
            await authService.refreshSession()
        }
    }
}

struct LoadingView: View {
    var body: some View {
        ZStack {
            Color.nateDark.ignoresSafeArea()
            VStack(spacing: 16) {
                ProgressView()
                    .tint(Color.neonGreen)
                    .scaleEffect(1.5)
                Text("NATEFIT")
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                    .foregroundColor(.neonGreen)
            }
        }
    }
}

// MARK: - Color extensions

extension Color {
    static let neonGreen = Color(red: 0, green: 1, blue: 0.53) // #00FF87
    static let nateDark = Color(red: 0.04, green: 0.04, blue: 0.06) // #0A0A0F
    static let nateCard = Color.white.opacity(0.05)
    static let nateBorder = Color.white.opacity(0.1)
}
