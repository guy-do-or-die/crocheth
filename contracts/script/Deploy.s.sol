// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CrochethRegistrar} from "../src/CrochethRegistrar.sol";

contract Deploy is Script {
    // Ethereum Sepolia ENS addresses
    address constant ENS_REGISTRY = 0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e;
    address constant PUBLIC_RESOLVER = 0x8FADE66B79cC9f707aB26799354482EB93a5B7dD;

    function run() external {
        // namehash("croch.eth") — computed off-chain
        // namehash("eth") = 0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae
        // namehash("croch.eth") = keccak256(abi.encodePacked(namehash("eth"), keccak256("croch")))
        bytes32 parentNode = keccak256(abi.encodePacked(
            bytes32(0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae),
            keccak256("croch")
        ));

        console.log("Parent node (croch.eth):", vm.toString(parentNode));

        vm.startBroadcast();

        CrochethRegistrar registrar = new CrochethRegistrar(
            ENS_REGISTRY,
            PUBLIC_RESOLVER,
            parentNode
        );

        console.log("CrochethRegistrar deployed at:", address(registrar));
        console.log("");
        console.log("NEXT STEPS:");
        console.log("1. From croch.eth owner, call:");
        console.log("   ens.setApprovalForAll(registrar, true)");

        vm.stopBroadcast();
    }
}
