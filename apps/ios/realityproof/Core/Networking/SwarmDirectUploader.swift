import Foundation

/// Uploads raw bytes directly to a Bee node, bypassing the Vercel relay.
/// Used by ProofSubmitter when the scene exceeds Vercel's 4.5 MB body
/// limit — Bee accepts arbitrarily large blobs via its native /bzz API.
///
/// The Vercel-served `/api/upload` endpoint stays in the flow but with
/// the bundle.json only — that path produces the cosmoSig (KMS co-sig)
/// we still need on every mint regardless of scene size.
struct SwarmDirectUploader {

    enum UploadError: Error, LocalizedError {
        case missingPostageBatchId
        case http(Int, String)
        case malformedResponse(String)

        var errorDescription: String? {
            switch self {
            case .missingPostageBatchId:
                return "swarmPostageBatchId not configured in Secrets.swift"
            case .http(let code, let body):
                return "Bee /bzz returned \(code): \(body)"
            case .malformedResponse(let body):
                return "Bee /bzz returned an unexpected payload: \(body)"
            }
        }
    }

    let beeURL: URL
    let postageBatchId: String

    init(beeURL: URL = Secrets.swarmBeeURL,
         postageBatchId: String = Secrets.swarmPostageBatchId) {
        self.beeURL = beeURL
        self.postageBatchId = postageBatchId
    }

    /// POST raw bytes to <bee>/bzz with the postage stamp header.
    /// Returns the 64-hex Swarm reference Bee assigns the content.
    /// `filename` is forwarded so the gateway serves the correct
    /// Content-Disposition when the file is fetched by name later.
    func upload(fileURL: URL, filename: String, contentType: String) async throws -> String {
        guard !postageBatchId.isEmpty,
              postageBatchId != "0x000000000000000000000000000000000000000000000000000000000000change-me" else {
            throw UploadError.missingPostageBatchId
        }

        var request = URLRequest(url: beeURL.appendingPathComponent("bzz"))
        request.httpMethod = "POST"
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        request.setValue(postageBatchId, forHTTPHeaderField: "Swarm-Postage-Batch-Id")
        // Tells Bee not to wrap the bytes in a folder manifest — keeps
        // the returned ref a simple file reference (raw bytes addressable).
        request.setValue("false", forHTTPHeaderField: "Swarm-Collection")
        // Hints the gateway to serve the original filename rather than
        // a generic application/octet-stream blob.
        request.setValue(filename, forHTTPHeaderField: "Swarm-Index-Document")
        request.setValue("attachment; filename=\"\(filename)\"",
                         forHTTPHeaderField: "Content-Disposition")
        request.timeoutInterval = 120

        let (data, response) = try await URLSession.shared.upload(
            for: request,
            fromFile: fileURL
        )
        guard let http = response as? HTTPURLResponse else {
            throw UploadError.malformedResponse(String(decoding: data, as: UTF8.self))
        }
        guard (200..<300).contains(http.statusCode) else {
            let body = String(decoding: data, as: UTF8.self)
            throw UploadError.http(http.statusCode, body)
        }

        struct BzzResponse: Decodable {
            let reference: String
        }
        guard let parsed = try? JSONDecoder().decode(BzzResponse.self, from: data) else {
            throw UploadError.malformedResponse(String(decoding: data, as: UTF8.self))
        }
        return parsed.reference
    }
}
