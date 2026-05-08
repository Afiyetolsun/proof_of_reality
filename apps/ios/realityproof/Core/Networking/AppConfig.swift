import Foundation

enum AppConfig {
    nonisolated static var apiBaseURL: URL { Secrets.baseURL }
    nonisolated static var sharedSecret: String { Secrets.sharedKey }
}
