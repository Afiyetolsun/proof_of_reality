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
    /// Backend-pinned scene ref. Nil when iOS uploaded the scene directly
    /// to Bee (big scene path) and only sent the bundle through /api/upload.
    let swarmRef: String?
    let bundleHash: String
    /// KMS co-signature on bundleHash. Backend returns it whether or not
    /// a scene was uploaded — both paths produce a cosmoSig.
    let cosmoSig: String?
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
    /// User-chosen ENS label, lowercased + trimmed. Nil means: server
    /// falls back to the default `vin-<bundleHash[2:14]>` handle.
    let label: String?

    private enum CodingKeys: String, CodingKey {
        case swarmRef, bundleRef, bundleHash, satSig, cosmoSig
        case attestation, attestationType, capturedAt, mode, label
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(swarmRef, forKey: .swarmRef)
        try c.encode(bundleRef, forKey: .bundleRef)
        try c.encode(bundleHash, forKey: .bundleHash)
        try c.encode(satSig, forKey: .satSig)
        try c.encode(cosmoSig, forKey: .cosmoSig)
        try c.encode(attestation, forKey: .attestation)
        try c.encode(attestationType, forKey: .attestationType)
        try c.encode(capturedAt, forKey: .capturedAt)
        try c.encode(mode, forKey: .mode)
        // Empty / whitespace label collapses to nil — never an empty string
        // on the wire. Backend treats absent label as "use default".
        if let raw = label {
            let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty {
                try c.encode(trimmed, forKey: .label)
            }
        }
    }
}

struct MintResponse: Decodable {
    let txHash: String
    let tokenId: String
    let ensName: String?
    let stub: Bool?
}
