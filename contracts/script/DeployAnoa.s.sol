// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {AnoaTrustlessAgentCore} from "../src/AnoaTrustlessAgentCore.sol";
import {AnoaCapitalVault} from "../src/AnoaCapitalVault.sol";

/**
 * @title DeployAnoa
 * @author ANOA Protocol Team
 * @notice Deployment script for ANOA ERC-8004 Trustless Agent Protocol
 * @dev Deploys AnoaTrustlessAgentCore + AnoaCapitalVault only.
 *      Uses official ERC-8004 singleton registries (Identity + Reputation)
 *      that are already deployed on Monad.
 *
 * Usage:
 *   forge script script/DeployAnoa.s.sol:DeployAnoa \
 *     --rpc-url $MONAD_TESTNET_RPC --broadcast --verify
 */
contract DeployAnoa is Script {
    // ============================================
    // OFFICIAL ERC-8004 REGISTRY ADDRESSES
    // Same deterministic addresses on all EVM chains
    // ============================================
    address constant ERC8004_IDENTITY_REGISTRY = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432;
    address constant ERC8004_REPUTATION_REGISTRY = 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63;

    // Validation Registry is not yet deployed (Coming Soon)
    // Use a placeholder that won't be called until validation is enabled
    address constant ERC8004_VALIDATION_REGISTRY = address(1);

    // ============================================
    // MONAD NETWORK ADDRESSES
    // ============================================

    // Monad Testnet (Chain ID: 10143)
    address constant MONAD_TESTNET_WMON = 0x5a4E0bFDeF88C9032CB4d24338C5EB3d3870BfDd;
    address constant MONAD_TESTNET_ROUTER = 0x865054F0F6A288adaAc30261731361EA7E908003; // Bonding Curve Router
    address constant MONAD_TESTNET_USDC = 0x534b2f3A21130d7a60830c2Df862319e593943A3;

    // Monad Mainnet (Chain ID: 143)
    address constant MONAD_MAINNET_WMON = 0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A;
    address constant MONAD_MAINNET_ROUTER = 0x6F6B8F1a20703309951a5127c45B49b1CD981A22; // Bonding Curve Router
    address constant MONAD_MAINNET_USDC = 0x754704Bc059F8C67012fEd69BC8A327a5aafb603;

    // ============================================
    // DeFi PROTOCOL ADDRESSES (Reference)
    // Used by API trading and future integrations
    // ============================================

    // nad.fun Contracts — Lens (Price Queries)
    address constant MONAD_TESTNET_LENS = 0xB056d79CA5257589692699a46623F901a3BB76f1;
    address constant MONAD_MAINNET_LENS = 0x7e78A8DE94f21804F7a17F4E8BF9EC2c872187ea;

    // nad.fun Contracts — DEX Router (for graduated tokens)
    address constant MONAD_TESTNET_DEX_ROUTER = 0x5D4a4f430cA3B1b2dB86B9cFE48a5316800F5fb2;
    address constant MONAD_MAINNET_DEX_ROUTER = 0x0B79d71AE99528D1dB24A4148b5f4F865cc2b137;

    // nad.fun Contracts — V3 Factory
    address constant MONAD_TESTNET_V3_FACTORY = 0xd0a37cf728CE2902eB8d4F6f2afc76854048253b;
    address constant MONAD_MAINNET_V3_FACTORY = 0x6B5F564339DbAD6b780249827f2198a841FEB7F3;

    // nad.fun Contracts — Bonding Curve
    address constant MONAD_TESTNET_CURVE = 0x1228b0dc9481C11D3071E7A924B794CfB038994e;
    address constant MONAD_MAINNET_CURVE = 0xA7283d07812a02AFB7C09B60f8896bCEA3F90aCE;

    // nad.fun Contracts — Creator Treasury
    address constant MONAD_TESTNET_CREATOR_TREASURY = 0x24dFf9B68fA36f8400302e2babC3e049eA19459E;
    address constant MONAD_MAINNET_CREATOR_TREASURY = 0x42e75B4B96d7000E7Da1e0c729Cec8d2049B9731;

    // Multicall3 & Permit2 (Mainnet)
    address constant MULTICALL3 = 0xcA11bde05977b3631167028862bE2a173976CA11;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    // LiFi Router — DEX Aggregator (Mainnet Only)
    address constant LIFI_ROUTER = 0x026F252016A7C47CDEf1F05a3Fc9E20C92a49C37;

    // aUSD — Agora Stablecoin (Mainnet Only)
    address constant AUSD = 0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a;

    // Upshift Vault — earnAUSD Real Yield (Mainnet Only)
    address constant UPSHIFT_VAULT = 0x36eDbF0C834591BFdfCaC0Ef9605528c75c406aA;

    // aPriori — Liquid Staking aprMON (Mainnet Only)
    address constant APRMON = 0x0c65A0BC65a5D819235B71F554D210D3F80E0852;

    // ============================================
    // DEPLOYED CONTRACTS
    // ============================================
    AnoaTrustlessAgentCore public core;
    AnoaCapitalVault public vault;

    // ============================================
    // MAIN DEPLOYMENT
    // ============================================

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);

        console.log("==============================================");
        console.log("ANOA ERC-8004 Trustless Agent Protocol");
        console.log("==============================================");
        console.log("");
        console.log("Deployer:", deployer);
        console.log("Treasury:", treasury);
        console.log("Chain ID:", block.chainid);
        console.log("");

        // Determine network addresses
        address wmon;
        address router;
        address stablecoin;
        string memory network;

        if (block.chainid == 10143) {
            wmon = MONAD_TESTNET_WMON;
            router = MONAD_TESTNET_ROUTER;
            stablecoin = MONAD_TESTNET_USDC;
            network = "Monad Testnet";
        } else if (block.chainid == 143) {
            wmon = MONAD_MAINNET_WMON;
            router = MONAD_MAINNET_ROUTER;
            stablecoin = MONAD_MAINNET_USDC;
            network = "Monad Mainnet";
        } else {
            revert("Unsupported network. Use Monad Testnet (10143) or Mainnet (143)");
        }

        console.log("Network:", network);
        console.log("WMON:", wmon);
        console.log("Router:", router);
        console.log("Stablecoin:", stablecoin);
        console.log("");
        console.log("Using Official ERC-8004 Registries:");
        console.log("  Identity:   ", ERC8004_IDENTITY_REGISTRY);
        console.log("  Reputation: ", ERC8004_REPUTATION_REGISTRY);
        console.log("");

        // Read vault operator key (for server-side PnL recording)
        uint256 operatorKey = vm.envOr("VAULT_OPERATOR_PRIVATE_KEY", uint256(0));
        if (operatorKey != 0) {
            console.log("Vault Operator:", vm.addr(operatorKey));
        }
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // ========================================
        // 1. Deploy Trustless Agent Core (Risk Router)
        // ========================================
        console.log("Deploying AnoaTrustlessAgentCore...");
        core = new AnoaTrustlessAgentCore(
            ERC8004_IDENTITY_REGISTRY,
            ERC8004_REPUTATION_REGISTRY,
            ERC8004_VALIDATION_REGISTRY,
            router,
            wmon,
            stablecoin,
            treasury
        );
        console.log("  -> Address:", address(core));

        // ========================================
        // 2. Deploy Capital Vault
        // ========================================
        console.log("Deploying AnoaCapitalVault...");
        vault = new AnoaCapitalVault(
            deployer,   // owner
            treasury,   // fee recipient
            treasury    // treasury
        );
        console.log("  -> Address:", address(vault));

        // ========================================
        // 3. Configure Contracts
        // ========================================
        console.log("");
        console.log("Configuring contracts...");

        // Allow WMON for trading
        core.setAllowedToken(wmon, true);
        console.log("  -> WMON allowed for trading");

        // Allow stablecoin for trading
        if (stablecoin != address(0)) {
            core.setAllowedToken(stablecoin, true);
            console.log("  -> Stablecoin allowed for trading");

            // Whitelist stablecoin in vault
            vault.setTokenWhitelist(stablecoin, true);
            console.log("  -> Stablecoin whitelisted in Vault");
        }

        // Whitelist aUSD in vault (mainnet only)
        if (block.chainid == 143) {
            vault.setTokenWhitelist(AUSD, true);
            core.setAllowedToken(AUSD, true);
            console.log("  -> aUSD allowed for trading + whitelisted in Vault (mainnet)");
        }

        // Authorize core as vault operator
        vault.setOperator(address(core), true);
        console.log("  -> Core authorized as Vault operator");

        // Authorize EOA operator from env (for server-side PnL recording)
        if (operatorKey != 0) {
            address operatorAddr = vm.addr(operatorKey);
            vault.setOperator(operatorAddr, true);
            console.log("  -> EOA Operator authorized:", operatorAddr);
        } else {
            console.log("  -> WARNING: VAULT_OPERATOR_PRIVATE_KEY not set, no EOA operator authorized");
        }

        vm.stopBroadcast();

        // ========================================
        // Print Summary
        // ========================================
        console.log("");
        console.log("==============================================");
        console.log("DEPLOYMENT COMPLETE");
        console.log("==============================================");
        console.log("");
        console.log("ANOA Contracts:");
        console.log("-------------------------------------------");
        console.log("AnoaTrustlessAgentCore:", address(core));
        console.log("AnoaCapitalVault:      ", address(vault));
        if (operatorKey != 0) {
            console.log("Vault Operator (EOA):  ", vm.addr(operatorKey));
        }
        console.log("");
        console.log("Official ERC-8004 Registries (not deployed, pre-existing):");
        console.log("-------------------------------------------");
        console.log("IdentityRegistry:      ", ERC8004_IDENTITY_REGISTRY);
        console.log("ReputationRegistry:    ", ERC8004_REPUTATION_REGISTRY);
        console.log("");
        console.log("DeFi Reference Addresses:");
        console.log("-------------------------------------------");
        if (block.chainid == 143) {
            console.log("LiFi Router:           ", LIFI_ROUTER);
            console.log("aUSD:                  ", AUSD);
            console.log("Upshift Vault:         ", UPSHIFT_VAULT);
            console.log("aprMON:                ", APRMON);
        }
        console.log("Lens:                  ", block.chainid == 10143 ? MONAD_TESTNET_LENS : MONAD_MAINNET_LENS);
        console.log("DEX Router:            ", block.chainid == 10143 ? MONAD_TESTNET_DEX_ROUTER : MONAD_MAINNET_DEX_ROUTER);
        console.log("V3 Factory:            ", block.chainid == 10143 ? MONAD_TESTNET_V3_FACTORY : MONAD_MAINNET_V3_FACTORY);
        console.log("");
        console.log("Add these to your .env file:");
        console.log("-------------------------------------------");
        console.log("NEXT_PUBLIC_ANOA_CORE=", address(core));
        _printEnvSuffix(network);
        console.log("=", address(vault));
    }

    function _printEnvSuffix(string memory network) internal pure {
        if (keccak256(bytes(network)) == keccak256(bytes("Monad Testnet"))) {
            console.log("NEXT_PUBLIC_CAPITAL_VAULT_TESTNET");
        } else {
            console.log("NEXT_PUBLIC_CAPITAL_VAULT_MAINNET");
        }
    }
}
