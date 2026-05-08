// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC721Metadata} from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";

/// @title RealityProof — Proof of Reality NFT (ERC-721 + on-chain proof commitments)
/// @notice ETHPrague 2026 — SpaceComputer track. Stores proof commitments for physical-world scans.
///
/// The contract is intentionally dumb storage. Verification logic lives off-chain in the viewer.
/// On-chain we only commit to: the bundle hash, Swarm references, satellite signature blob,
/// KMS co-signature blob, attestation blob (App Attest OR device-SE signature), capture mode.
contract RealityProof is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    struct Proof {
        bytes32 bundleHash;        // keccak256 of canonical proof bundle JSON (with cosmoSig embedded)
        string  swarmRef;          // bzz reference for the scene file
        string  bundleRef;         // bzz reference for the bundle JSON
        bytes   satSig;            // SpaceComputer cTRNG satellite signature over the cosmic nonce
        bytes   cosmoSig;          // SpaceComputer KMS co-signature over the pre-spaceFabric hash
        bytes   attestation;       // App Attest assertion blob OR (deviceAddr || deviceSig) packed
        uint8   attestationType;   // 0 = appAttest, 1 = deviceSE
        address attestor;          // address(0) for appAttest; org address for deviceSE
        uint64  capturedAt;        // unix seconds, from client
        uint64  mintedAt;          // block.timestamp at mint
        uint8   mode;              // 0 = roomPlan, 1 = objectCapture, 2 = stereoFusion
    }

    mapping(uint256 => Proof) private _proofs;
    mapping(bytes32 => uint256) public hashToToken; // dedupe by bundleHash
    uint256 public nextTokenId;

    event RealityMinted(
        uint256 indexed tokenId,
        address indexed to,
        bytes32 indexed bundleHash,
        string swarmRef,
        string bundleRef,
        uint8 attestationType,
        address attestor,
        uint8 mode,
        uint64 capturedAt
    );

    error DuplicateBundle(bytes32 hash, uint256 existingTokenId);
    error EmptySwarmRef();
    error EmptyBundleRef();
    error EmptySatSig();
    error EmptyCosmoSig();
    error EmptyAttestation();
    error InvalidMode(uint8 mode);
    error InvalidAttestationType(uint8 attestationType);

    constructor(address admin) ERC721("Proof of Reality", "REALITY") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function mint(
        address to,
        bytes32 bundleHash,
        string calldata swarmRef,
        string calldata bundleRef,
        bytes calldata satSig,
        bytes calldata cosmoSig,
        bytes calldata attestation,
        uint8 attestationType,
        address attestor,
        uint64 capturedAt,
        uint8 mode
    ) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        if (bytes(swarmRef).length == 0) revert EmptySwarmRef();
        if (bytes(bundleRef).length == 0) revert EmptyBundleRef();
        if (satSig.length == 0) revert EmptySatSig();
        // cosmoSig may be empty during the experimental KMS window; allow but verifier flags it
        if (attestation.length == 0) revert EmptyAttestation();
        if (mode > 2) revert InvalidMode(mode);
        if (attestationType > 1) revert InvalidAttestationType(attestationType);

        uint256 existing = hashToToken[bundleHash];
        if (existing != 0) revert DuplicateBundle(bundleHash, existing);

        unchecked {
            tokenId = ++nextTokenId;
        }

        _proofs[tokenId] = Proof({
            bundleHash: bundleHash,
            swarmRef: swarmRef,
            bundleRef: bundleRef,
            satSig: satSig,
            cosmoSig: cosmoSig,
            attestation: attestation,
            attestationType: attestationType,
            attestor: attestor,
            capturedAt: capturedAt,
            mintedAt: uint64(block.timestamp),
            mode: mode
        });
        hashToToken[bundleHash] = tokenId;

        _safeMint(to, tokenId);

        emit RealityMinted(
            tokenId,
            to,
            bundleHash,
            swarmRef,
            bundleRef,
            attestationType,
            attestor,
            mode,
            capturedAt
        );
    }

    function getProof(uint256 tokenId) external view returns (Proof memory) {
        _requireOwned(tokenId);
        return _proofs[tokenId];
    }

    function tokenIdOfHash(bytes32 bundleHash) external view returns (uint256) {
        return hashToToken[bundleHash];
    }

    function tokenURI(uint256 tokenId) public view override(ERC721) returns (string memory) {
        _requireOwned(tokenId);
        return string.concat("https://api.gateway.ethswarm.org/bzz/", _proofs[tokenId].bundleRef);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return ERC721.supportsInterface(interfaceId) || AccessControl.supportsInterface(interfaceId);
    }
}
