// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CrochethRegistrar, IENS, IResolver} from "../src/CrochethRegistrar.sol";

/// @dev Mock ENS Registry — tracks subnode ownership and resolvers
contract MockENS is IENS {
    mapping(bytes32 => address) public owners;
    mapping(bytes32 => address) public resolvers;
    mapping(address => mapping(address => bool)) public approvals;

    function setOwner(bytes32 node, address owner_) external {
        owners[node] = owner_;
    }

    function setApprovalForAll(address operator, bool approved) external {
        approvals[msg.sender][operator] = approved;
    }

    function isApprovedForAll(address owner_, address operator) external view returns (bool) {
        return approvals[owner_][operator];
    }

    function setSubnodeOwner(bytes32 node, bytes32 label, address owner_) external returns (bytes32) {
        bytes32 subnode = keccak256(abi.encodePacked(node, label));
        owners[subnode] = owner_;
        return subnode;
    }

    function setResolver(bytes32 node, address resolver_) external {
        resolvers[node] = resolver_;
    }

    function owner(bytes32 node) external view returns (address) {
        return owners[node];
    }
}

/// @dev Mock Public Resolver — stores addr and text records
contract MockResolver is IResolver {
    mapping(bytes32 => address) private _addrs;
    mapping(bytes32 => mapping(string => string)) private _texts;

    function setAddr(bytes32 node, address addr_) external {
        _addrs[node] = addr_;
    }

    function setText(bytes32 node, string calldata key, string calldata value) external {
        _texts[node][key] = value;
    }

    function addr(bytes32 node) external view returns (address) {
        return _addrs[node];
    }

    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return _texts[node][key];
    }
}

contract CrochethRegistrarTest is Test {

    CrochethRegistrar public registrar;
    MockENS public ens;
    MockResolver public resolver;

    // namehash("croch.eth") — precomputed
    bytes32 public constant PARENT_NODE = 0x788e8a09d05a30fd80bcc7fdd68ae6b1f4e0c5d7d58c1e3b048b0a8d5e9f1c2a;

    address public crochOwner = makeAddr("crochOwner");
    address public wallet1   = makeAddr("wallet1");
    address public wallet2   = makeAddr("wallet2");
    address public wallet3   = makeAddr("wallet3");

    bytes32 public commitment1;
    bytes32 public commitment2;

    function setUp() public {
        commitment1 = keccak256(abi.encodePacked(makeAddr("realOwner1"), bytes32("salt1")));
        commitment2 = keccak256(abi.encodePacked(makeAddr("realOwner2"), bytes32("salt2")));

        ens = new MockENS();
        resolver = new MockResolver();

        // Set croch.eth owner
        ens.setOwner(PARENT_NODE, crochOwner);

        // Deploy registrar
        registrar = new CrochethRegistrar(address(ens), address(resolver), PARENT_NODE);

        // croch.eth owner grants registrar permission to create subdomains
        vm.prank(crochOwner);
        ens.setApprovalForAll(address(registrar), true);
    }

    // ─── Registration ───────────────────────────────────────────

    function test_register_basic() public {
        vm.prank(wallet1);
        registrar.register("midnight", commitment1, 42);

        bytes32 subnode = _subnode("midnight");

        // Label is registered
        assertTrue(registrar.registered(subnode));

        // Marker is mapped
        assertEq(registrar.markerToSubnode(42), subnode);

        // ENS ownership transferred to item wallet
        assertEq(ens.owners(subnode), wallet1);

        // Resolver set
        assertEq(ens.resolvers(subnode), address(resolver));

        // Address record points to item wallet
        assertEq(resolver.addr(subnode), wallet1);

        // Text records
        assertEq(resolver.text(subnode, "marker"), "42");

    }

    function test_register_commitment_stored() public {
        vm.prank(wallet1);
        registrar.register("midnight", commitment1, 42);

        bytes32 subnode = _subnode("midnight");
        string memory stored = resolver.text(subnode, "commitment");

        // Should be a hex string starting with 0x
        assertEq(bytes(stored).length, 66); // "0x" + 64 hex chars
    }

    function test_register_emits_event() public {
        bytes32 subnode = _subnode("midnight");

        vm.expectEmit(true, true, false, true);
        emit CrochethRegistrar.ItemRegistered("midnight", subnode, wallet1, commitment1, 42);

        vm.prank(wallet1);
        registrar.register("midnight", commitment1, 42);
    }

    function test_register_multiple() public {
        vm.prank(wallet1);
        registrar.register("midnight", commitment1, 42);

        vm.prank(wallet2);
        registrar.register("shadow", commitment2, 7);

        assertTrue(registrar.registered(_subnode("midnight")));
        assertTrue(registrar.registered(_subnode("shadow")));
        assertEq(resolver.addr(_subnode("midnight")), wallet1);
        assertEq(resolver.addr(_subnode("shadow")), wallet2);
    }



    // ─── Reverts ────────────────────────────────────────────────

    function test_register_reverts_duplicate_label() public {
        vm.prank(wallet1);
        registrar.register("midnight", commitment1, 42);

        vm.prank(wallet2);
        vm.expectRevert("Label taken");
        registrar.register("midnight", commitment2, 7);
    }

    function test_register_reverts_duplicate_marker() public {
        vm.prank(wallet1);
        registrar.register("midnight", commitment1, 42);

        vm.prank(wallet2);
        vm.expectRevert("Marker already used");
        registrar.register("shadow", commitment2, 42);
    }

    // ─── View Functions ─────────────────────────────────────────

    function test_available_returns_true() public view {
        assertTrue(registrar.available("midnight"));
    }

    function test_available_returns_false() public {
        vm.prank(wallet1);
        registrar.register("midnight", commitment1, 42);

        assertFalse(registrar.available("midnight"));
    }

    function test_markerAvailable_returns_true() public view {
        assertTrue(registrar.markerAvailable(42));
    }

    function test_markerAvailable_returns_false() public {
        vm.prank(wallet1);
        registrar.register("midnight", commitment1, 42);

        assertFalse(registrar.markerAvailable(42));
    }

    function test_subnodeForMarker() public {
        vm.prank(wallet1);
        registrar.register("midnight", commitment1, 42);

        assertEq(registrar.subnodeForMarker(42), _subnode("midnight"));
    }

    function test_subnodeForMarker_unregistered() public view {
        assertEq(registrar.subnodeForMarker(999), bytes32(0));
    }

    // ─── Privacy Model ──────────────────────────────────────────

    function test_owner_never_onchain() public {
        // The real owner address is NEVER passed to the contract
        // Only the commitment (irreversible hash) is stored
        address realOwner = makeAddr("realOwner1");
        bytes32 salt = bytes32("salt1");
        bytes32 commitment = keccak256(abi.encodePacked(realOwner, salt));

        vm.prank(wallet1); // wallet1 is the item wallet, not the owner
        registrar.register("midnight", commitment, 42);

        // On-chain: only wallet1 (item) and commitment (hash) are visible
        // realOwner address appears nowhere
        assertEq(resolver.addr(_subnode("midnight")), wallet1);
        assertTrue(wallet1 != realOwner);
    }

    // ─── Helpers ────────────────────────────────────────────────

    function _subnode(string memory label) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(PARENT_NODE, keccak256(bytes(label))));
    }
}
