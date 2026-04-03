// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CrochethRegistrar} from "../src/CrochethRegistrar.sol";

contract Deploy is Script {
    // Ethereum Sepolia ENS addresses
    address constant ENS_REGISTRY = 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e;
    address constant PUBLIC_RESOLVER = 0x8FADE66B79cC9f707aB26799354482EB93a5B7dD;

    // namehash("croch.eth") — must be precomputed
    // keccak256(abi.encodePacked(namehash("eth"), keccak256("croch")))
    bytes32 constant PARENT_NODE = 0x788e8a09d05a30fd80bcc7fdd68ae6b1f4e0c5d7d58c1e3b048b0a8d5e9f1c2a;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        CrochethRegistrar registrar = new CrochethRegistrar(
            ENS_REGISTRY,
            PUBLIC_RESOLVER,
            PARENT_NODE
        );

        console.log("CrochethRegistrar deployed at:", address(registrar));
        console.log("Parent node (croch.eth):", vm.toString(PARENT_NODE));
        console.log("");
        console.log("NEXT STEPS:");
        console.log("1. From croch.eth owner, call:");
        console.log("   ens.setApprovalForAll(registrar, true)");

        vm.stopBroadcast();
    }
}
