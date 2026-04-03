// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CrochethRegistrar — Permissionless ENS subdomain registration for croch.eth
/// @notice Anyone can register a item subdomain under croch.eth.
///         Each subdomain maps to an anonymous persistent wallet with a commitment hash.
/// @dev The croch.eth owner must call ens.setApprovalForAll(registrar, true) once.
contract CrochethRegistrar {

    // ─── Interfaces ─────────────────────────────────────────────

    IENS public immutable ens;
    IResolver public immutable resolver;
    bytes32 public immutable parentNode; // namehash("croch.eth")

    // ─── State ──────────────────────────────────────────────────

    mapping(bytes32 => bool) public registered;
    mapping(uint256 => bytes32) public markerToSubnode; // ArUco marker ID → subnode

    // ─── Events ─────────────────────────────────────────────────

    event ItemRegistered(
        string label,
        bytes32 indexed subnode,
        address indexed wallet,
        bytes32 commitment,
        uint256 markerID
    );

    // ─── Constructor ────────────────────────────────────────────

    constructor(address _ens, address _resolver, bytes32 _parentNode) {
        ens = IENS(_ens);
        resolver = IResolver(_resolver);
        parentNode = _parentNode;
    }

    // ─── Registration ───────────────────────────────────────────

    /// @notice Register a new item subdomain — permissionless
    /// @param label The subdomain label (e.g., "midnight" → midnight.croch.eth)
    /// @param commitment keccak256(ownerEOA, salt) — owner identity never on-chain
    /// @param markerID The ArUco marker ID crocheted into this item
    function register(
        string calldata label,
        bytes32 commitment,
        uint256 markerID
    ) external {
        bytes32 labelHash = keccak256(bytes(label));
        bytes32 subnode = keccak256(abi.encodePacked(parentNode, labelHash));

        require(!registered[subnode], "Label taken");
        require(markerToSubnode[markerID] == bytes32(0), "Marker already used");

        registered[subnode] = true;
        markerToSubnode[markerID] = subnode;

        // Create subdomain owned by this contract (so we can set records)
        ens.setSubnodeOwner(parentNode, labelHash, address(this));

        // Set resolver
        ens.setResolver(subnode, address(resolver));

        // Set address to caller (the item's anonymous wallet)
        resolver.setAddr(subnode, msg.sender);

        // Set text records
        resolver.setText(subnode, "commitment", _bytes32ToHex(commitment));
        resolver.setText(subnode, "marker", _uint256ToString(markerID));

        // Transfer subdomain ownership to the item wallet
        ens.setSubnodeOwner(parentNode, labelHash, msg.sender);

        emit ItemRegistered(label, subnode, msg.sender, commitment, markerID);
    }

    // ─── Views ──────────────────────────────────────────────────

    /// @notice Check if a label is available
    function available(string calldata label) external view returns (bool) {
        bytes32 labelHash = keccak256(bytes(label));
        bytes32 subnode = keccak256(abi.encodePacked(parentNode, labelHash));
        return !registered[subnode];
    }

    /// @notice Check if a marker ID is available
    function markerAvailable(uint256 markerID) external view returns (bool) {
        return markerToSubnode[markerID] == bytes32(0);
    }

    /// @notice Get the subnode for a marker ID
    function subnodeForMarker(uint256 markerID) external view returns (bytes32) {
        return markerToSubnode[markerID];
    }

    // ─── Helpers ────────────────────────────────────────────────

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

// ─── ENS Interfaces ─────────────────────────────────────────

interface IENS {
    function setSubnodeOwner(bytes32 node, bytes32 label, address owner) external returns (bytes32);
    function setResolver(bytes32 node, address resolver) external;
    function owner(bytes32 node) external view returns (address);
}

interface IResolver {
    function setAddr(bytes32 node, address addr) external;
    function setText(bytes32 node, string calldata key, string calldata value) external;
    function addr(bytes32 node) external view returns (address);
    function text(bytes32 node, string calldata key) external view returns (string memory);
}
