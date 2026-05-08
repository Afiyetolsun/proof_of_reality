import Foundation
import UniformTypeIdentifiers

enum MultipartBuilder {

    static func make(parts: [Part]) -> MultipartBody {
        let boundary = "Boundary-\(UUID().uuidString)"
        var data = Data()
        for part in parts {
            data.append("--\(boundary)\r\n")
            data.append("Content-Disposition: form-data; name=\"\(part.name)\"")
            if let filename = part.filename {
                data.append("; filename=\"\(filename)\"")
            }
            data.append("\r\n")
            data.append("Content-Type: \(part.contentType)\r\n\r\n")
            data.append(part.body)
            data.append("\r\n")
        }
        data.append("--\(boundary)--\r\n")
        return MultipartBody(boundary: boundary, data: data)
    }

    struct Part {
        let name: String
        let filename: String?
        let contentType: String
        let body: Data

        static func file(name: String, url: URL) throws -> Part {
            let body = try Data(contentsOf: url)
            let mime = UTType(filenameExtension: url.pathExtension)?.preferredMIMEType
                ?? "application/octet-stream"
            return Part(name: name, filename: url.lastPathComponent,
                        contentType: mime, body: body)
        }

        static func text(name: String, value: String) -> Part {
            Part(name: name, filename: nil, contentType: "text/plain; charset=utf-8",
                 body: Data(value.utf8))
        }

        static func json<T: Encodable>(name: String, value: T) throws -> Part {
            let body = try ProofHasher.canonicalEncode(value)
            return Part(name: name, filename: "\(name).json",
                        contentType: "application/json", body: body)
        }
    }
}

private extension Data {
    mutating func append(_ string: String) {
        if let data = string.data(using: .utf8) { append(data) }
    }
}
