// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title RealityENSResolver
/// @notice ENS resolver for the Proof of Reality project. Each Reality NFT
///         minted on Base Sepolia gets a corresponding subname under
///         realityproof.eth on Ethereum Sepolia, with all proof
///         commitments published as ENS records.
///
///         Anyone with an ENS-aware client can resolve
///         `vin-<bundleHash12>.realityproof.eth` and read:
///           addr()        → NFT recipient (attestor)
///           contenthash() → IPFS CID of the canonical bundle JSON
///           text(key)     → bundleHash, satSig, cosmoSig, capturedAt,
///                           tokenId, mode, description, url, avatar
///
///         This means a verifier doesn't need our contract address or even
///         to know about Base Sepolia — they only need the ENS name. The
///         resolver returns enough to fully verify the proof off-chain.
contract RealityENSResolver {
    struct Proof {
        address attestor;        // = addr(node)
        bytes32 bundleHash;
        bytes contenthash;       // ENSIP-7 multicodec, e.g. ipfs://… encoded
        string satSig;           // hex string from cTRNG
        string cosmoSig;         // hex string from KMS
        string sceneCid;         // raw IPFS CID, used as avatar URL
        uint64 capturedAt;
        uint256 tokenId;
        uint8 mode;              // 0=roomPlan, 1=objectCapture, 2=stereoFusion
    }

    /// node = namehash("vin-<…>.realityproof.eth")
    mapping(bytes32 => Proof) public proofs;
    mapping(bytes32 => bool) public exists;

    address public admin;

    event ProofPublished(
        bytes32 indexed node,
        uint256 indexed tokenId,
        bytes32 bundleHash,
        address attestor
    );

    error NotAdmin();
    error UnknownNode();

    constructor(address _admin) {
        admin = _admin;
    }

    /// @notice Backend writes one proof in a single tx. Idempotent — overwrites.
    function setProof(bytes32 node, Proof calldata p) external {
        if (msg.sender != admin) revert NotAdmin();
        proofs[node] = p;
        exists[node] = true;
        emit ProofPublished(node, p.tokenId, p.bundleHash, p.attestor);
    }

    function setAdmin(address newAdmin) external {
        if (msg.sender != admin) revert NotAdmin();
        admin = newAdmin;
    }

    // ------------------------------------------------------------------
    // ENS resolver interface
    // ------------------------------------------------------------------

    /// EIP-137 addr resolution
    function addr(bytes32 node) external view returns (address payable) {
        return payable(proofs[node].attestor);
    }

    /// ENSIP-7 contenthash (IPFS / IPNS / Swarm multicodec)
    function contenthash(bytes32 node) external view returns (bytes memory) {
        return proofs[node].contenthash;
    }

    /// EIP-634 text records
    function text(bytes32 node, string calldata key) external view returns (string memory) {
        if (!exists[node]) return "";
        Proof storage p = proofs[node];
        bytes32 k = keccak256(bytes(key));

        if (k == _key("bundleHash"))   return _bytes32ToHex(p.bundleHash);
        if (k == _key("satSig"))       return p.satSig;
        if (k == _key("cosmoSig"))     return p.cosmoSig;
        if (k == _key("capturedAt"))   return _uintToString(uint256(p.capturedAt));
        if (k == _key("tokenId"))      return _uintToString(p.tokenId);
        if (k == _key("mode"))         return _modeName(p.mode);
        if (k == _key("description"))  return "Proof of Reality - physical-world attestation NFT";
        if (k == _key("url"))          return _basescanUrl(p.tokenId);
        if (k == _key("avatar"))       return _ipfsUrl(p.sceneCid);
        if (k == _key("com.twitter"))  return "EthPrague";
        return "";
    }

    /// ERC-165 + ENS interface IDs
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == 0x01ffc9a7 || // ERC-165
            interfaceId == 0x3b3b57de || // addr(bytes32)
            interfaceId == 0x59d1d43c || // text(bytes32,string)
            interfaceId == 0xbc1c58d1;   // contenthash(bytes32)
    }

    // ------------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------------

    function _key(string memory s) private pure returns (bytes32) {
        return keccak256(bytes(s));
    }

    function _modeName(uint8 m) private pure returns (string memory) {
        if (m == 0) return "roomPlan";
        if (m == 1) return "objectCapture";
        if (m == 2) return "stereoFusion";
        return "unknown";
    }

    function _basescanUrl(uint256 tokenId) private pure returns (string memory) {
        return string.concat(
            "https://sepolia.basescan.org/token/0xB2bDB1eC0C0FaF8BC97f0fC851d231a975Ff2053?a=",
            _uintToString(tokenId)
        );
    }

    function _ipfsUrl(string memory cid) private pure returns (string memory) {
        if (bytes(cid).length == 0) return "";
        return string.concat("ipfs://", cid);
    }

    function _bytes32ToHex(bytes32 b) private pure returns (string memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory out = new bytes(66);
        out[0] = "0";
        out[1] = "x";
        for (uint256 i = 0; i < 32; i++) {
            uint8 v = uint8(b[i]);
            out[2 + i * 2]     = hexChars[v >> 4];
            out[2 + i * 2 + 1] = hexChars[v & 0x0f];
        }
        return string(out);
    }

    function _uintToString(uint256 v) private pure returns (string memory) {
        if (v == 0) return "0";
        uint256 j = v;
        uint256 len;
        while (j != 0) { len++; j /= 10; }
        bytes memory out = new bytes(len);
        uint256 k = len;
        while (v != 0) {
            k--;
            out[k] = bytes1(uint8(48 + v % 10));
            v /= 10;
        }
        return string(out);
    }
}
