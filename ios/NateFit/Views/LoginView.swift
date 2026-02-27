import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authService: AuthService

    @State private var email = ""
    @State private var password = ""
    @State private var useMagicLink = false
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var magicLinkSent = false

    var body: some View {
        ZStack {
            Color.nateDark.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 32) {
                    Spacer().frame(height: 60)

                    // Branding
                    VStack(spacing: 8) {
                        Text("NATEFIT")
                            .font(.system(size: 40, weight: .bold, design: .rounded))
                            .foregroundColor(.neonGreen)
                        Text("Body Scanner")
                            .font(.system(size: 18, weight: .medium))
                            .foregroundColor(.white.opacity(0.6))
                    }

                    Spacer().frame(height: 20)

                    // Form
                    VStack(spacing: 16) {
                        TextField("Email", text: $email)
                            .textFieldStyle(NateTextFieldStyle())
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                            .autocorrectionDisabled()

                        if !useMagicLink {
                            SecureField("Password", text: $password)
                                .textFieldStyle(NateTextFieldStyle())
                                .textContentType(.password)
                        }

                        if let error = errorMessage {
                            Text(error)
                                .font(.system(size: 14))
                                .foregroundColor(.red)
                                .multilineTextAlignment(.center)
                        }

                        if magicLinkSent {
                            Text("Check your email for a login link.")
                                .font(.system(size: 14))
                                .foregroundColor(.neonGreen)
                                .multilineTextAlignment(.center)
                        }

                        Button(action: handleSignIn) {
                            Group {
                                if isLoading {
                                    ProgressView()
                                        .tint(.black)
                                } else {
                                    Text(useMagicLink ? "Send Magic Link" : "Sign In")
                                        .font(.system(size: 16, weight: .semibold))
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 50)
                            .background(Color.neonGreen)
                            .foregroundColor(.black)
                            .cornerRadius(12)
                        }
                        .disabled(isLoading || email.isEmpty || (!useMagicLink && password.isEmpty))
                        .opacity(isLoading || email.isEmpty || (!useMagicLink && password.isEmpty) ? 0.5 : 1)

                        Button(action: {
                            withAnimation {
                                useMagicLink.toggle()
                                errorMessage = nil
                                magicLinkSent = false
                            }
                        }) {
                            Text(useMagicLink ? "Use password instead" : "Use magic link instead")
                                .font(.system(size: 14))
                                .foregroundColor(.white.opacity(0.5))
                        }
                    }
                    .padding(.horizontal, 32)
                }
            }
        }
        .navigationBarHidden(true)
    }

    private func handleSignIn() {
        isLoading = true
        errorMessage = nil
        magicLinkSent = false

        Task {
            do {
                if useMagicLink {
                    try await authService.signInWithMagicLink(email: email)
                    magicLinkSent = true
                } else {
                    try await authService.signIn(email: email, password: password)
                }
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }
}

// MARK: - Custom text field style

struct NateTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding(16)
            .background(Color.nateCard)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.nateBorder, lineWidth: 1)
            )
            .foregroundColor(.white)
            .font(.system(size: 16))
    }
}
