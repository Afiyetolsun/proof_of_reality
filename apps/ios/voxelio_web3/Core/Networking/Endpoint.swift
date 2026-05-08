import Foundation

struct Endpoint<Response: Decodable> {
    let path: String
    let method: HTTPMethod
    let body: Data?
    let multipart: MultipartBody?

    init(path: String, method: HTTPMethod = .get, body: Data? = nil, multipart: MultipartBody? = nil) {
        self.path = path
        self.method = method
        self.body = body
        self.multipart = multipart
    }
}

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
}

struct MultipartBody {
    let boundary: String
    let data: Data
}

enum API {
    static func nonce() -> Endpoint<NonceResponse> {
        Endpoint(path: "/api/nonce", method: .post)
    }

    static func upload(multipart: MultipartBody) -> Endpoint<UploadResponse> {
        Endpoint(path: "/api/upload", method: .post, multipart: multipart)
    }

    static func mint(payload: MintRequest) -> Endpoint<MintResponse> {
        let body = try? JSONEncoder().encode(payload)
        return Endpoint(path: "/api/mint", method: .post, body: body)
    }
}

struct NonceResponse: Decodable {
    let nonce: String
    let satSig: String
    let expiresAt: TimeInterval
}

struct UploadResponse: Decodable {
    let swarmRef: String
    let bundleHash: String
}

struct MintRequest: Encodable {
    let swarmRef: String
    let bundleRef: String
    let bundleHash: String
    let satSig: String
    let cosmoSig: String
    let attestation: String
    let attestationType: Int   // 0 = appAttest, 1 = deviceSE
    let capturedAt: Int        // unix seconds
    let mode: Int              // 0 = roomPlan, 1 = objectCapture
}

struct MintResponse: Decodable {
    let txHash: String
    let tokenId: String
    let ensName: String?
    let stub: Bool?
}
