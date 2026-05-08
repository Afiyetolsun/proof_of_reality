// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title DeviceRegistry — On-chain registry of B2B capture devices for Proof of Reality.
/// @notice Each device has a hardware-resident keypair (USB Armory Mk II / ATECC608 / SE05x).
///         The org that operates the device registers its address (= keccak of pubkey) here,
///         publicly staking the org's reputation on every scan that device produces.
///
///         The viewer's verification flow:
///           1. ecrecover(deviceSig over bundleHash) → deviceAddr
///           2. devices[deviceAddr].org must be non-zero AND not revoked
///           3. devices[deviceAddr].org must equal the proof.attestor recorded in RealityProof
///
///         Permissionless: any org wallet can register devices; the registry is global.
contract DeviceRegistry {
    struct Device {
        address org;            // org wallet that registered this device
        uint64  registeredAt;
        bool    revoked;
        string  label;          // human-readable, e.g. "Prague-WarehouseA-Cam01"
        bytes32 birthNonce;     // SpaceComputer cTRNG nonce captured at provisioning
        bytes   vendorAttestation; // optional factory cert from chip vendor (opaque blob)
    }

    mapping(address => Device) public devices;

    event DeviceRegistered(
        address indexed device,
        address indexed org,
        bytes32 birthNonce,
        string label
    );
    event DeviceRevoked(address indexed device, address indexed org);

    error AlreadyRegistered(address device);
    error NotRegistered(address device);
    error NotDeviceOrg(address device, address caller);
    error EmptyLabel();
    error ZeroDevice();

    function register(
        address device,
        bytes32 birthNonce,
        string calldata label,
        bytes calldata vendorAttestation
    ) external {
        if (device == address(0)) revert ZeroDevice();
        if (bytes(label).length == 0) revert EmptyLabel();
        if (devices[device].org != address(0)) revert AlreadyRegistered(device);

        devices[device] = Device({
            org: msg.sender,
            registeredAt: uint64(block.timestamp),
            revoked: false,
            label: label,
            birthNonce: birthNonce,
            vendorAttestation: vendorAttestation
        });

        emit DeviceRegistered(device, msg.sender, birthNonce, label);
    }

    function revoke(address device) external {
        Device storage d = devices[device];
        if (d.org == address(0)) revert NotRegistered(device);
        if (d.org != msg.sender) revert NotDeviceOrg(device, msg.sender);
        d.revoked = true;
        emit DeviceRevoked(device, msg.sender);
    }

    function isActive(address device) external view returns (bool) {
        Device storage d = devices[device];
        return d.org != address(0) && !d.revoked;
    }
}
