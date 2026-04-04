// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {CrochethL2Registrar} from "../src/CrochethL2Registrar.sol";

/// @notice Deploy CrochethL2Registrar to Base Sepolia
/// @dev Usage: npm run deploy:base-sepolia (from repo root)
///      After deploy, call addRegistrar() on the Durin L2Registry to whitelist it.
contract DeployCrochethL2Registrar is Script {
    address constant L2_REGISTRY = 0x228eeCbA8D5336Fe3A904627F9985f6A6ffd0bdf;

    function run() external {
        console.log("Deploying CrochethL2Registrar...");
        console.log("  L2Registry: ", L2_REGISTRY);

        vm.startBroadcast();

        CrochethL2Registrar registrar = new CrochethL2Registrar(L2_REGISTRY);

        console.log("  Deployed at:", address(registrar));
        console.log("");
        console.log("NEXT STEP - whitelist it:");
        console.log("  npm run registrar:approve");

        vm.stopBroadcast();
    }
}
