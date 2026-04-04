// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IL2Registry} from "./interfaces/IL2Registry.sol";

/// @title CrochethL2Registrar
/// @notice Permissionless registrar for croch.eth subdomains on Base Sepolia.
/// @dev This contract exists for exactly one reason: to enforce that each physical
///      ArUco marker ID can only be registered once (one item = one subdomain).
///      Everything else — ENS subnode creation, text/address records — is handled
///      by Durin's L2Registry. This is purely a uniqueness gatekeeper.
///
///      PRIVACY MODEL:
///      - The item owner's identity is never stored on-chain.
///      - A `commitment` (hash of the owner's public key) is stored as an ENS text record.
///      - Ownership is proven off-chain: derive the public key from a signature,
///        hash it, compare against the on-chain commitment. Any signing mechanism works.
///      - The subdomain NFT is owned by msg.sender (the anonymous relayer).
contract CrochethL2Registrar {

    // ─── Durin Registry ─────────────────────────────────────────

    IL2Registry public immutable registry;

    // ─── State ──────────────────────────────────────────────────

    /// @dev markerID → subnode (keccak256 of parentNode + labelHash)
    mapping(uint256 => bytes32) public markerToSubnode;

    // ─── Events ─────────────────────────────────────────────────

    event ItemRegistered(
        string label,
        bytes32 indexed subnode,
        address indexed wallet,
        bytes32 commitment,
        uint256 markerID
    );

    // ─── Constructor ────────────────────────────────────────────

    /// @param _registry Address of Durin's L2Registry on Base Sepolia
    constructor(address _registry) {
        registry = IL2Registry(_registry);
    }

    // ─── Registration ───────────────────────────────────────────

    /// @notice Register a new balaclava subdomain — callable by anyone (including Unlink relayer)
    /// @param label      The subdomain label (e.g., "midnight" → midnight.croch.eth)
    /// @param haLoCommitment keccak256(haLoAddress) — one-way hash, HaLo address never stored on-chain
    /// @param markerID   The ArUco marker ID crocheted into this item
    function register(
        string calldata label,
        bytes32 haLoCommitment,
        uint256 markerID
    ) external {
        bytes32 node = registry.makeNode(registry.baseNode(), label);

        // Ensure marker hasn't been used before (one balaclava = one subdomain)
        require(markerToSubnode[markerID] == bytes32(0), "Marker already used");

        // Ensure label isn't taken
        require(_available(label), "Label taken");

        // Record marker → subnode mapping before external call (CEI pattern)
        markerToSubnode[markerID] = node;

        // Store croch.eth-specific metadata as ENS text records.
        // The commitment is a one-way hash — the HaLo address is irrecoverable from it.
        registry.setText(node, "commitment", _bytes32ToHex(haLoCommitment));
        registry.setText(node, "marker", _uint256ToString(markerID));

        // Mint the subdomain NFT — owner is msg.sender (the anonymous Unlink burner).
        // No HaLo address or user EOA ever touches the chain.
        registry.createSubnode(
            registry.baseNode(),
            label,
            msg.sender,
            new bytes[](0)
        );

        emit ItemRegistered(label, node, msg.sender, haLoCommitment, markerID);
    }

    // ─── Views ──────────────────────────────────────────────────

    /// @notice Check if a label is available
    function available(string calldata label) external view returns (bool) {
        return _available(label);
    }

    /// @notice Check if a marker ID has already been used
    function markerAvailable(uint256 markerID) external view returns (bool) {
        return markerToSubnode[markerID] == bytes32(0);
    }

    /// @notice Get the subnode for a given marker ID
    function subnodeForMarker(uint256 markerID) external view returns (bytes32) {
        return markerToSubnode[markerID];
    }

    // ─── Internals ──────────────────────────────────────────────

    function _available(string calldata label) internal view returns (bool) {
        bytes32 node = registry.makeNode(registry.baseNode(), label);
        uint256 tokenId = uint256(node);
        try registry.ownerOf(tokenId) {
            return false;
        } catch {
            return true;
        }
    }

    function _bytes32ToHex(bytes32 data) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(66);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 32; i++) {
            str[2 + i * 2] = alphabet[uint8(data[i] >> 4)];
            str[3 + i * 2] = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }

    function _uint256ToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + value % 10));
            value /= 10;
        }
        return string(buffer);
    }
}
