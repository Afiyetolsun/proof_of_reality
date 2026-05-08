import Foundation

actor APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let decoder: JSONDecoder

    init(session: URLSession = .shared) {
        self.session = session
        self.decoder = JSONDecoder()
    }

    func send<R>(_ endpoint: Endpoint<R>) async throws -> R {
        let request = try makeRequest(for: endpoint)
        let (data, response) = try await session.data(for: request)

        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            throw APIError.status(code: http.statusCode, body: String(data: data, encoding: .utf8))
        }

        return try decoder.decode(R.self, from: data)
    }

    private func makeRequest<R>(for endpoint: Endpoint<R>) throws -> URLRequest {
        let url = AppConfig.apiBaseURL.appendingPathComponent(endpoint.path)
        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue
        request.setValue(AppConfig.sharedSecret, forHTTPHeaderField: "X-Voxelio-Key")

        if let multipart = endpoint.multipart {
            request.setValue(
                "multipart/form-data; boundary=\(multipart.boundary)",
                forHTTPHeaderField: "Content-Type"
            )
            request.httpBody = multipart.data
        } else if let body = endpoint.body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = body
        }

        return request
    }
}

enum APIError: Error, LocalizedError {
    case invalidResponse
    case status(code: Int, body: String?)

    var errorDescription: String? {
        switch self {
        case .invalidResponse: return "Invalid response from server"
        case let .status(code, body): return "HTTP \(code): \(body ?? "<no body>")"
        }
    }
}
