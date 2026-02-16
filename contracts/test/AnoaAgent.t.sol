// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, console} from "forge-std/Test.sol";
import {AnoaAgentIdentity} from "../src/AnoaAgentIdentity.sol";
import {AnoaAgentReputation} from "../src/AnoaAgentReputation.sol";
import {AnoaAgentValidator} from "../src/AnoaAgentValidator.sol";
import {AnoaCapitalVault} from "../src/AnoaCapitalVault.sol";

/**
 * @title AnoaAgentIdentityTest
 * @author ANOA Protocol Team
 * @notice Test suite for ANOA Agent Identity Registry
 */
contract AnoaAgentIdentityTest is Test {
    AnoaAgentIdentity public identity;
    
    address public owner = address(1);
    address public user1 = address(2);
    address public user2 = address(3);
    address public agentWallet = address(4);
    address public treasury = address(5);
    
    uint256 public constant REGISTRATION_FEE = 100 ether; // 100 MON
    string public constant HANDLE = "TestAgent1";
    string public constant METADATA_URI = "ipfs://QmTest123";
    
    event AgentRegistered(
        uint256 indexed tokenId,
        address indexed walletAddress,
        address indexed owner,
        string handle,
        string metadataUri,
        uint256 timestamp
    );
    
    function setUp() public {
        vm.prank(owner);
        identity = new AnoaAgentIdentity(
            "ANOA AI Agents",
            "ANOA",
            REGISTRATION_FEE,
            treasury
        );
        
        // Fund test accounts with enough MON for registration
        vm.deal(user1, 1000 ether);
        vm.deal(user2, 1000 ether);
    }
    
    function test_Deployment() public view {
        assertEq(identity.name(), "ANOA AI Agents");
        assertEq(identity.symbol(), "ANOA");
        assertEq(identity.registrationFee(), REGISTRATION_FEE);
        assertEq(identity.owner(), owner);
    }
    
    function test_RegisterAgent() public {
        vm.prank(user1);
        
        uint256 tokenId = identity.register{value: REGISTRATION_FEE}(
            agentWallet,
            HANDLE,
            METADATA_URI,
            1 // capabilities
        );
        
        assertEq(tokenId, 1);
        assertEq(identity.ownerOf(tokenId), user1);
        assertEq(identity.tokenURI(tokenId), METADATA_URI);
        assertEq(identity.walletToAgent(agentWallet), tokenId);
        
        AnoaAgentIdentity.AgentInfo memory info = identity.getMetadata(tokenId);
        assertEq(info.walletAddress, agentWallet);
        assertEq(info.metadataUri, METADATA_URI);
        assertTrue(info.isActive);
        assertEq(info.operator, user1);
    }
    
    function test_RegisterAgent_InsufficientFee() public {
        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(
                AnoaAgentIdentity.InsufficientRegistrationFee.selector,
                50 ether, // 50 MON (less than 100 MON required)
                REGISTRATION_FEE
            )
        );
        identity.register{value: 50 ether}(agentWallet, HANDLE, METADATA_URI, 1);
    }
    
    function test_RegisterAgent_DuplicateWallet() public {
        // First registration
        vm.prank(user1);
        identity.register{value: REGISTRATION_FEE}(agentWallet, HANDLE, METADATA_URI, 1);
        
        // Try to register same wallet again
        vm.prank(user2);
        vm.expectRevert(
            abi.encodeWithSelector(
                AnoaAgentIdentity.AgentAlreadyRegistered.selector,
                agentWallet
            )
        );
        identity.register{value: REGISTRATION_FEE}(agentWallet, "OtherAgent", METADATA_URI, 1);
    }
    
    function test_RegisterAgent_InvalidWallet() public {
        vm.prank(user1);
        vm.expectRevert(AnoaAgentIdentity.InvalidWalletAddress.selector);
        identity.register{value: REGISTRATION_FEE}(address(0), HANDLE, METADATA_URI, 1);
    }
    
    function test_SetMetadata() public {
        // Register agent
        vm.prank(user1);
        uint256 tokenId = identity.register{value: REGISTRATION_FEE}(
            agentWallet,
            HANDLE,
            METADATA_URI,
            1
        );
        
        // Update metadata
        string memory newUri = "ipfs://QmNewTest456";
        vm.prank(user1);
        identity.setMetadata(tokenId, newUri);
        
        assertEq(identity.tokenURI(tokenId), newUri);
    }
    
    function test_SetOperator() public {
        // Register agent
        vm.prank(user1);
        uint256 tokenId = identity.register{value: REGISTRATION_FEE}(
            agentWallet,
            HANDLE,
            METADATA_URI,
            1
        );
        
        // Set new operator
        vm.prank(user1);
        identity.setOperator(tokenId, user2);
        
        AnoaAgentIdentity.AgentInfo memory info = identity.getMetadata(tokenId);
        assertEq(info.operator, user2);
    }
    
    function test_DeactivateReactivate() public {
        // Register agent
        vm.prank(user1);
        uint256 tokenId = identity.register{value: REGISTRATION_FEE}(
            agentWallet,
            HANDLE,
            METADATA_URI,
            1
        );
        
        // Deactivate
        vm.prank(user1);
        identity.deactivate(tokenId);
        assertFalse(identity.isAgentActive(tokenId));
        
        // Reactivate
        vm.prank(user1);
        identity.reactivate(tokenId);
        assertTrue(identity.isAgentActive(tokenId));
    }
    
    function test_GetGlobalId() public {
        vm.prank(user1);
        uint256 tokenId = identity.register{value: REGISTRATION_FEE}(
            agentWallet,
            HANDLE,
            METADATA_URI,
            1
        );
        
        string memory globalId = identity.getGlobalId(tokenId);
        console.log("Global ID:", globalId);
        // Format: eip155:{chainId}:{address}+{tokenId}
    }
    
    function testFuzz_RegisterAgent(
        address wallet,
        string calldata handle,
        string calldata uri
    ) public {
        vm.assume(wallet != address(0));
        vm.assume(bytes(handle).length > 0 && bytes(handle).length <= 32);
        vm.assume(bytes(uri).length > 0);
        vm.assume(identity.walletToAgent(wallet) == 0);
        
        bytes32 handleHash = keccak256(bytes(handle));
        vm.assume(identity.handleToAgent(handleHash) == 0);
        
        vm.prank(user1);
        uint256 tokenId = identity.register{value: REGISTRATION_FEE}(wallet, handle, uri, 1);
        
        assertEq(identity.ownerOf(tokenId), user1);
        assertEq(identity.walletToAgent(wallet), tokenId);
    }
}

/**
 * @title AnoaAgentReputationTest
 * @notice Test suite for ANOA Agent Reputation Registry
 */
contract AnoaAgentReputationTest is Test {
    AnoaAgentIdentity public identity;
    AnoaAgentReputation public reputation;
    
    address public owner = address(1);
    address public user1 = address(2);
    address public client1 = address(3);
    address public client2 = address(4);
    
    uint256 public agentId;
    
    function setUp() public {
        vm.startPrank(owner);
        identity = new AnoaAgentIdentity("ANOA AI Agents", "ANOA", 0.01 ether, owner);
        reputation = new AnoaAgentReputation(address(identity));
        vm.stopPrank();
        
        // Fund and register agent
        vm.deal(user1, 10 ether);
        vm.deal(client1, 10 ether);
        vm.deal(client2, 10 ether);
        
        vm.prank(user1);
        agentId = identity.register{value: 0.01 ether}(
            address(5),
            "TestAgent",
            "ipfs://test",
            1
        );
    }
    
    function test_GiveFeedback() public {
        bytes32 tag1 = keccak256("FAST_EXECUTION");
        bytes32 tag2 = keccak256("PROFITABLE");
        bytes32 proofHash = keccak256("proof");
        
        vm.prank(client1);
        reputation.giveFeedback(agentId, 85, tag1, tag2, proofHash);
        
        (uint256 total, uint256 avg, uint256 lastAt) = reputation.getSummary(agentId);
        assertEq(total, 1);
        assertEq(avg, 8500); // 85 * 100 (SCORE_PRECISION)
        assertGt(lastAt, 0);
    }
    
    function test_MultipleFeedbacks() public {
        // Client 1 gives 80
        vm.prank(client1);
        reputation.giveFeedback(
            agentId, 80, bytes32(0), bytes32(0), bytes32(0)
        );
        
        // Client 2 gives 90
        vm.prank(client2);
        reputation.giveFeedback(
            agentId, 90, bytes32(0), bytes32(0), bytes32(0)
        );
        
        (uint256 total, uint256 avg,) = reputation.getSummary(agentId);
        assertEq(total, 2);
        assertEq(avg, 8500); // (80 + 90) / 2 * 100
    }
    
    function test_FeedbackCooldown() public {
        // Record initial timestamp
        uint256 startTime = block.timestamp;
        
        // First feedback - should work (no prior feedback)
        vm.prank(client1);
        reputation.giveFeedback(
            agentId, 80, bytes32(0), bytes32(0), bytes32(0)
        );
        
        // Try immediate second feedback - should fail with cooldown error
        // Time remaining = startTime + 1hour - startTime = 1 hour = 3600 seconds
        vm.prank(client1);
        vm.expectRevert(abi.encodeWithSelector(
            AnoaAgentReputation.FeedbackCooldownNotMet.selector,
            1 hours // 3600 seconds remaining
        ));
        reputation.giveFeedback(
            agentId, 90, bytes32(0), bytes32(0), bytes32(0)
        );
        
        // Warp past cooldown (1 hour from start)
        vm.warp(startTime + 1 hours + 1);
        
        // Should work now
        vm.prank(client1);
        reputation.giveFeedback(
            agentId, 90, bytes32(0), bytes32(0), bytes32(0)
        );
        
        (uint256 total,,) = reputation.getSummary(agentId);
        assertEq(total, 2);
    }
    
    function test_InvalidScore() public {
        vm.prank(client1);
        vm.expectRevert(
            abi.encodeWithSelector(
                AnoaAgentReputation.InvalidScore.selector,
                101
            )
        );
        reputation.giveFeedback(
            agentId, 101, bytes32(0), bytes32(0), bytes32(0)
        );
    }
    
    function test_GetTrustScore() public {
        // Give 5 feedbacks (minimum required)
        for (uint8 i = 0; i < 5; i++) {
            vm.prank(address(uint160(10 + i)));
            reputation.giveFeedback(
                agentId, 80, bytes32(0), bytes32(0), bytes32(0)
            );
        }
        
        uint256 trustScore = reputation.getTrustScore(agentId);
        assertEq(trustScore, 80);
    }
    
    function test_HasMinimumReputation() public {
        // Before enough feedbacks
        assertFalse(reputation.hasMinimumReputation(agentId, 70));
        
        // Give 5 feedbacks with score 80
        for (uint8 i = 0; i < 5; i++) {
            vm.prank(address(uint160(10 + i)));
            reputation.giveFeedback(
                agentId, 80, bytes32(0), bytes32(0), bytes32(0)
            );
        }
        
        // Now should have reputation
        assertTrue(reputation.hasMinimumReputation(agentId, 70));
        assertFalse(reputation.hasMinimumReputation(agentId, 90));
    }
    
    function test_ValidatorFeedback() public {
        // Register validator
        vm.prank(owner);
        reputation.registerValidator(address(100), 5);
        
        // Give validator feedback
        vm.prank(address(100));
        reputation.giveValidatorFeedback(agentId, 95, keccak256("proof"));
        
        AnoaAgentReputation.ReputationSummary memory summary = reputation.getFullSummary(agentId);
        assertEq(summary.totalValidatorFeedbacks, 1);
    }
}

/**
 * @title AnoaAgentValidatorTest
 * @notice Test suite for ANOA Agent Validation Registry
 */
contract AnoaAgentValidatorTest is Test {
    AnoaAgentIdentity public identity;
    AnoaAgentValidator public validator;
    
    address public owner = address(1);
    address public validatorAddr = address(2);
    address public user1 = address(3);
    address public treasury = address(4);
    
    uint256 public agentId;
    
    function setUp() public {
        vm.startPrank(owner);
        identity = new AnoaAgentIdentity("ANOA AI Agents", "ANOA", 0.01 ether, treasury);
        validator = new AnoaAgentValidator(address(identity), treasury);
        vm.stopPrank();
        
        // Fund accounts
        vm.deal(user1, 10 ether);
        vm.deal(validatorAddr, 10 ether);
        
        // Register agent
        vm.prank(user1);
        agentId = identity.register{value: 0.01 ether}(
            address(5),
            "TestAgent",
            "ipfs://test",
            1
        );
    }
    
    function test_DefaultSchemes() public view {
        assertEq(validator.schemeCount(), 3);
        
        AnoaAgentValidator.ValidationScheme[] memory schemes = validator.getSchemes();
        assertEq(schemes[0].name, "BASIC");
        assertEq(schemes[1].name, "STANDARD");
        assertEq(schemes[2].name, "ADVANCED");
    }
    
    function test_RegisterValidator() public {
        uint256[] memory schemes = new uint256[](1);
        schemes[0] = 0; // BASIC scheme
        
        vm.prank(validatorAddr);
        validator.registerValidator{value: 1 ether}("Test Validator", schemes);
        
        AnoaAgentValidator.Validator memory v = validator.getValidator(validatorAddr);
        assertEq(v.name, "Test Validator");
        assertEq(v.stakedAmount, 1 ether);
        assertTrue(v.isActive);
    }
    
    function test_ValidateAgent() public {
        // Register validator first
        uint256[] memory schemes = new uint256[](1);
        schemes[0] = 0;
        
        vm.prank(validatorAddr);
        validator.registerValidator{value: 1 ether}("Test Validator", schemes);
        
        // Validate agent
        vm.prank(validatorAddr);
        validator.validateAgent(
            agentId,
            0, // BASIC scheme
            true,
            keccak256("proof"),
            "Agent passed basic validation"
        );
        
        assertTrue(validator.isAgentValidated(agentId, 0));
        
        AnoaAgentValidator.AgentValidation memory v = validator.getValidation(agentId, 0);
        assertEq(v.validator, validatorAddr);
        assertEq(uint8(v.status), uint8(AnoaAgentValidator.ValidationStatus.VALIDATED));
    }
    
    function test_ValidationExpiry() public {
        // Register validator
        uint256[] memory schemes = new uint256[](1);
        schemes[0] = 0;
        
        vm.prank(validatorAddr);
        validator.registerValidator{value: 1 ether}("Test Validator", schemes);
        
        // Validate agent
        vm.prank(validatorAddr);
        validator.validateAgent(agentId, 0, true, keccak256("proof"), "");
        
        assertTrue(validator.isAgentValidated(agentId, 0));
        
        // Warp past expiry (BASIC is 365 days)
        vm.warp(block.timestamp + 366 days);
        
        assertFalse(validator.isAgentValidated(agentId, 0));
    }
    
    function test_RevokeValidation() public {
        // Register validator
        uint256[] memory schemes = new uint256[](1);
        schemes[0] = 0;
        
        vm.prank(validatorAddr);
        validator.registerValidator{value: 1 ether}("Test Validator", schemes);
        
        // Validate agent
        vm.prank(validatorAddr);
        validator.validateAgent(agentId, 0, true, keccak256("proof"), "");
        
        assertTrue(validator.isAgentValidated(agentId, 0));
        
        // Revoke
        vm.prank(validatorAddr);
        validator.revokeValidation(agentId, 0, "Misbehavior detected");
        
        assertFalse(validator.isAgentValidated(agentId, 0));
    }
    
    function test_SlashValidator() public {
        // Register validator
        uint256[] memory schemes = new uint256[](1);
        schemes[0] = 0;
        
        vm.prank(validatorAddr);
        validator.registerValidator{value: 2 ether}("Test Validator", schemes);
        
        // Slash
        vm.prank(owner);
        validator.slashValidator(validatorAddr, 0.5 ether, "Misconduct");
        
        AnoaAgentValidator.Validator memory v = validator.getValidator(validatorAddr);
        assertEq(v.stakedAmount, 1.5 ether);
    }
}

/**
 * @title AnoaCapitalVaultTest
 * @notice Test suite for ANOA Capital Vault — delegation, withdrawal, fees
 */
contract AnoaCapitalVaultTest is Test {
    AnoaCapitalVault public vault;

    address public owner = address(1);
    address public treasury = address(2);
    address public user1 = address(3);
    address public user2 = address(4);

    uint256 public constant AGENT_ID = 1;

    event CapitalDelegated(
        uint256 indexed delegationId,
        address indexed delegator,
        uint256 indexed agentId,
        uint256 amount,
        uint256 lockupEndsAt
    );

    event CapitalWithdrawn(
        uint256 indexed delegationId,
        address indexed delegator,
        address indexed recipient,
        uint256 amount,
        uint256 fee
    );

    event RegistrationFeePaid(
        address indexed payer,
        uint256 indexed agentId,
        uint256 amount
    );

    function setUp() public {
        vm.prank(owner);
        vault = new AnoaCapitalVault(owner, treasury, treasury);

        // Fund test accounts
        vm.deal(user1, 1000 ether);
        vm.deal(user2, 1000 ether);
    }

    // ── Deployment ──

    function test_Deployment() public view {
        assertEq(vault.owner(), owner);
        assertEq(vault.treasury(), treasury);
        assertEq(vault.feeRecipient(), treasury);
        assertEq(vault.totalDelegatedCapital(), 0);
        assertEq(vault.accumulatedFees(), 0);
    }

    function test_DefaultFeeConfig() public view {
        AnoaCapitalVault.FeeConfig memory cfg = vault.getFeeConfig();
        assertEq(cfg.registrationFee, 0);
        assertEq(cfg.tradingFeeBps, 0);
        assertEq(cfg.withdrawalFeeBps, 0);
        assertEq(cfg.minCapital, 0);
    }

    // ── Delegation ──

    function test_DelegateCapital() public {
        vm.prank(user1);
        uint256 delegationId = vault.delegateCapital{value: 10 ether}(AGENT_ID);

        assertEq(delegationId, 1);
        assertEq(vault.totalDelegatedCapital(), 10 ether);
        assertEq(vault.agentCapital(AGENT_ID), 10 ether);

        AnoaCapitalVault.Delegation memory d = vault.getDelegation(delegationId);
        assertEq(d.delegator, user1);
        assertEq(d.agentId, AGENT_ID);
        assertEq(d.amount, 10 ether);
        assertTrue(d.isActive);
    }

    function test_DelegateCapital_MultipleDelegators() public {
        vm.prank(user1);
        uint256 id1 = vault.delegateCapital{value: 10 ether}(AGENT_ID);

        vm.prank(user2);
        uint256 id2 = vault.delegateCapital{value: 20 ether}(AGENT_ID);

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(vault.totalDelegatedCapital(), 30 ether);
        assertEq(vault.agentCapital(AGENT_ID), 30 ether);

        // Each delegator has their own record
        AnoaCapitalVault.Delegation memory d1 = vault.getDelegation(id1);
        AnoaCapitalVault.Delegation memory d2 = vault.getDelegation(id2);
        assertEq(d1.delegator, user1);
        assertEq(d2.delegator, user2);
    }

    function test_DelegateCapital_ZeroAmount() public {
        vm.prank(user1);
        vm.expectRevert(AnoaCapitalVault.ZeroAmount.selector);
        vault.delegateCapital{value: 0}(AGENT_ID);
    }

    function test_DelegateCapital_BelowMinCapital() public {
        // Set min capital to 5 ether
        vm.prank(owner);
        vault.updateFeeConfig(0, 0, 0, 5 ether);

        vm.prank(user1);
        vm.expectRevert(AnoaCapitalVault.BelowMinCapital.selector);
        vault.delegateCapital{value: 1 ether}(AGENT_ID);
    }

    function test_DelegateCapital_EmitsEvent() public {
        vm.prank(user1);
        vm.expectEmit(true, true, true, true);
        emit CapitalDelegated(1, user1, AGENT_ID, 10 ether, block.timestamp);
        vault.delegateCapital{value: 10 ether}(AGENT_ID);
    }

    // ── Withdrawal ──

    function test_WithdrawCapital_NoFee() public {
        // Delegate (no lockup, no fee by default)
        vm.prank(user1);
        uint256 delegationId = vault.delegateCapital{value: 10 ether}(AGENT_ID);

        uint256 balBefore = user1.balance;

        // Withdraw to self
        vm.prank(user1);
        vault.withdrawCapital(delegationId, user1);

        uint256 balAfter = user1.balance;
        assertEq(balAfter - balBefore, 10 ether);
        assertEq(vault.totalDelegatedCapital(), 0);
        assertEq(vault.agentCapital(AGENT_ID), 0);

        AnoaCapitalVault.Delegation memory d = vault.getDelegation(delegationId);
        assertFalse(d.isActive);
    }

    function test_WithdrawCapital_WithFee() public {
        // Set 1% withdrawal fee (100 bps)
        vm.prank(owner);
        vault.updateFeeConfig(0, 0, 100, 0);

        vm.prank(user1);
        uint256 delegationId = vault.delegateCapital{value: 100 ether}(AGENT_ID);

        uint256 balBefore = user1.balance;

        vm.prank(user1);
        vault.withdrawCapital(delegationId, user1);

        uint256 balAfter = user1.balance;
        // Fee = ceil(100 ether * 100 / 10000) = 1 ether
        assertEq(balAfter - balBefore, 99 ether);
        assertEq(vault.accumulatedFees(), 1 ether);
    }

    function test_WithdrawCapital_ToRecipient() public {
        address recipient = address(99);

        vm.prank(user1);
        uint256 delegationId = vault.delegateCapital{value: 10 ether}(AGENT_ID);

        uint256 balBefore = recipient.balance;

        vm.prank(user1);
        vault.withdrawCapital(delegationId, recipient);

        assertEq(recipient.balance - balBefore, 10 ether);
    }

    function test_WithdrawCapital_NotDelegator() public {
        vm.prank(user1);
        uint256 delegationId = vault.delegateCapital{value: 10 ether}(AGENT_ID);

        // user2 tries to withdraw user1's delegation
        vm.prank(user2);
        vm.expectRevert(AnoaCapitalVault.NotDelegator.selector);
        vault.withdrawCapital(delegationId, user2);
    }

    function test_WithdrawCapital_AlreadyWithdrawn() public {
        vm.prank(user1);
        uint256 delegationId = vault.delegateCapital{value: 10 ether}(AGENT_ID);

        vm.prank(user1);
        vault.withdrawCapital(delegationId, user1);

        // Try to withdraw again
        vm.prank(user1);
        vm.expectRevert(AnoaCapitalVault.DelegationNotActive.selector);
        vault.withdrawCapital(delegationId, user1);
    }

    function test_WithdrawCapital_LockupNotExpired() public {
        // Set 1 day lockup
        vm.prank(owner);
        vault.updateDefaultLockupPeriod(1 days);

        vm.prank(user1);
        uint256 delegationId = vault.delegateCapital{value: 10 ether}(AGENT_ID);

        // Try to withdraw immediately
        vm.prank(user1);
        vm.expectRevert(AnoaCapitalVault.LockupNotEnded.selector);
        vault.withdrawCapital(delegationId, user1);

        // Warp past lockup
        vm.warp(block.timestamp + 1 days + 1);

        // Now should work
        vm.prank(user1);
        vault.withdrawCapital(delegationId, user1);
    }

    // ── Emergency Withdraw ──

    function test_EmergencyWithdraw() public {
        vm.prank(owner);
        vault.updateDefaultLockupPeriod(1 days);

        vm.prank(user1);
        uint256 delegationId = vault.delegateCapital{value: 10 ether}(AGENT_ID);

        // Warp past lockup + 7 days emergency delay
        vm.warp(block.timestamp + 1 days + 7 days + 1);

        uint256 balBefore = user1.balance;
        vm.prank(user1);
        vault.emergencyWithdraw(delegationId);

        // Full amount, no fee
        assertEq(user1.balance - balBefore, 10 ether);
    }

    function test_EmergencyWithdraw_TooEarly() public {
        vm.prank(owner);
        vault.updateDefaultLockupPeriod(1 days);

        vm.prank(user1);
        uint256 delegationId = vault.delegateCapital{value: 10 ether}(AGENT_ID);

        // Warp past lockup but NOT past 7-day emergency delay
        vm.warp(block.timestamp + 1 days + 3 days);

        vm.prank(user1);
        vm.expectRevert(AnoaCapitalVault.LockupNotEnded.selector);
        vault.emergencyWithdraw(delegationId);
    }

    // ── Registration Fee ──

    function test_PayRegistrationFee() public {
        // Set 100 MON registration fee
        vm.prank(owner);
        vault.updateFeeConfig(100 ether, 0, 0, 0);

        vm.prank(user1);
        vault.payRegistrationFee{value: 100 ether}(AGENT_ID);

        assertEq(vault.accumulatedFees(), 100 ether);
    }

    function test_PayRegistrationFee_Insufficient() public {
        vm.prank(owner);
        vault.updateFeeConfig(100 ether, 0, 0, 0);

        vm.prank(user1);
        vm.expectRevert(AnoaCapitalVault.InsufficientAmount.selector);
        vault.payRegistrationFee{value: 50 ether}(AGENT_ID);
    }

    function test_PayRegistrationFee_EmitsEvent() public {
        vm.prank(user1);
        vm.expectEmit(true, true, false, true);
        emit RegistrationFeePaid(user1, AGENT_ID, 100 ether);
        vault.payRegistrationFee{value: 100 ether}(AGENT_ID);
    }

    // ── Fee Calculations ──

    function test_CalculateWithdrawalFee() public {
        // Set 2.5% fee (250 bps)
        vm.prank(owner);
        vault.updateFeeConfig(0, 0, 250, 0);

        (uint256 afterFee, uint256 fee) = vault.calculateWithdrawalFee(100 ether);
        // fee = ceil(100 ether * 250 / 10000) = 2.5 ether
        assertEq(fee, 2.5 ether);
        assertEq(afterFee, 97.5 ether);
    }

    function test_CalculateWithdrawalFee_Zero() public view {
        // Default 0 fee
        (uint256 afterFee, uint256 fee) = vault.calculateWithdrawalFee(100 ether);
        assertEq(fee, 0);
        assertEq(afterFee, 100 ether);
    }

    // ── Fee Withdrawal (Admin) ──

    function test_WithdrawFees() public {
        // Accumulate fees via registration
        vm.prank(user1);
        vault.payRegistrationFee{value: 50 ether}(AGENT_ID);

        uint256 treasuryBal = treasury.balance;

        vm.prank(owner);
        vault.withdrawFees();

        assertEq(treasury.balance - treasuryBal, 50 ether);
        assertEq(vault.accumulatedFees(), 0);
    }

    function test_WithdrawFees_OnlyOwner() public {
        vm.prank(user1);
        vault.payRegistrationFee{value: 10 ether}(AGENT_ID);

        vm.prank(user1);
        vm.expectRevert();
        vault.withdrawFees();
    }

    // ── Admin Config ──

    function test_UpdateFeeConfig() public {
        vm.prank(owner);
        vault.updateFeeConfig(10 ether, 50, 100, 1 ether);

        AnoaCapitalVault.FeeConfig memory cfg = vault.getFeeConfig();
        assertEq(cfg.registrationFee, 10 ether);
        assertEq(cfg.tradingFeeBps, 50);
        assertEq(cfg.withdrawalFeeBps, 100);
        assertEq(cfg.minCapital, 1 ether);
    }

    function test_UpdateFeeConfig_ExceedsMax() public {
        // MAX_FEE_BPS = 1000 (10%)
        vm.prank(owner);
        vm.expectRevert(AnoaCapitalVault.InvalidFee.selector);
        vault.updateFeeConfig(0, 1001, 0, 0);
    }

    function test_Pause_BlocksDelegation() public {
        vm.prank(owner);
        vault.pause();

        vm.prank(user1);
        vm.expectRevert();
        vault.delegateCapital{value: 10 ether}(AGENT_ID);

        // Unpause
        vm.prank(owner);
        vault.unpause();

        // Should work now
        vm.prank(user1);
        vault.delegateCapital{value: 10 ether}(AGENT_ID);
        assertEq(vault.totalDelegatedCapital(), 10 ether);
    }

    // ── View Functions ──

    function test_GetAgentDelegations() public {
        vm.prank(user1);
        vault.delegateCapital{value: 5 ether}(AGENT_ID);

        vm.prank(user2);
        vault.delegateCapital{value: 7 ether}(AGENT_ID);

        uint256[] memory ids = vault.getAgentDelegations(AGENT_ID);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
    }

    function test_GetDelegatorDelegations() public {
        vm.prank(user1);
        vault.delegateCapital{value: 5 ether}(AGENT_ID);

        vm.prank(user1);
        vault.delegateCapital{value: 3 ether}(2); // Different agent

        uint256[] memory ids = vault.getDelegatorDelegations(user1);
        assertEq(ids.length, 2);
    }

    function test_GetActiveAgentCapital() public {
        vm.prank(user1);
        uint256 id1 = vault.delegateCapital{value: 10 ether}(AGENT_ID);

        vm.prank(user2);
        vault.delegateCapital{value: 20 ether}(AGENT_ID);

        assertEq(vault.getActiveAgentCapital(AGENT_ID), 30 ether);

        // Withdraw one
        vm.prank(user1);
        vault.withdrawCapital(id1, user1);

        assertEq(vault.getActiveAgentCapital(AGENT_ID), 20 ether);
    }

    // ── Fund Separation ──

    function test_FundSeparation_FeeVsCapital() public {
        // Set fees
        vm.prank(owner);
        vault.updateFeeConfig(10 ether, 0, 100, 0); // 1% withdrawal fee

        // User delegates
        vm.prank(user1);
        uint256 delegationId = vault.delegateCapital{value: 100 ether}(AGENT_ID);

        // Another user pays registration
        vm.prank(user2);
        vault.payRegistrationFee{value: 10 ether}(AGENT_ID);

        // Fees = 10 ether (registration)
        // Capital = 100 ether (delegation)
        assertEq(vault.accumulatedFees(), 10 ether);
        assertEq(vault.totalDelegatedCapital(), 100 ether);

        // User withdraws — fee goes to platform, rest to user
        vm.prank(user1);
        vault.withdrawCapital(delegationId, user1);

        // Fees = 10 (registration) + 1 (withdrawal fee) = 11 ether
        assertEq(vault.accumulatedFees(), 11 ether);
        assertEq(vault.totalDelegatedCapital(), 0);
    }

    // ========================================
    // PNL RECORDING TESTS
    // ========================================

    function test_recordDelegationPnl() public {
        // Setup: operator + delegation
        vm.prank(owner);
        vault.setOperator(address(10), true);

        vm.prank(user1);
        uint256 delegationId = vault.delegateCapital{value: 100 ether}(AGENT_ID);

        // Record positive PnL
        vm.prank(address(10));
        vault.recordDelegationPnl(delegationId, 5 ether);

        assertEq(vault.getDelegationPnl(delegationId), 5 ether);

        // Record negative PnL
        vm.prank(address(10));
        vault.recordDelegationPnl(delegationId, -2 ether);

        assertEq(vault.getDelegationPnl(delegationId), 3 ether);
    }

    function test_batchRecordPnl() public {
        // Setup operator
        vm.prank(owner);
        vault.setOperator(address(10), true);

        // Create 3 delegations
        vm.prank(user1);
        uint256 d1 = vault.delegateCapital{value: 50 ether}(AGENT_ID);
        vm.prank(user1);
        uint256 d2 = vault.delegateCapital{value: 30 ether}(AGENT_ID);
        vm.prank(user2);
        uint256 d3 = vault.delegateCapital{value: 20 ether}(AGENT_ID);

        // Batch record PnL
        uint256[] memory ids = new uint256[](3);
        ids[0] = d1;
        ids[1] = d2;
        ids[2] = d3;

        int256[] memory pnls = new int256[](3);
        pnls[0] = 10 ether;
        pnls[1] = 6 ether;
        pnls[2] = -3 ether;

        vm.prank(address(10));
        vault.batchRecordPnl(ids, pnls);

        assertEq(vault.getDelegationPnl(d1), 10 ether);
        assertEq(vault.getDelegationPnl(d2), 6 ether);
        assertEq(vault.getDelegationPnl(d3), -3 ether);
    }

    function test_batchRecordPnl_onlyOperator() public {
        vm.prank(user1);
        uint256 delegationId = vault.delegateCapital{value: 50 ether}(AGENT_ID);

        uint256[] memory ids = new uint256[](1);
        ids[0] = delegationId;
        int256[] memory pnls = new int256[](1);
        pnls[0] = 1 ether;

        // Non-operator should revert
        vm.prank(user2);
        vm.expectRevert(AnoaCapitalVault.NotAuthorized.selector);
        vault.batchRecordPnl(ids, pnls);
    }

    function test_batchRecordPnl_lengthMismatch() public {
        vm.prank(owner);
        vault.setOperator(address(10), true);

        uint256[] memory ids = new uint256[](2);
        int256[] memory pnls = new int256[](1);

        vm.prank(address(10));
        vm.expectRevert(AnoaCapitalVault.LengthMismatch.selector);
        vault.batchRecordPnl(ids, pnls);
    }

    // ── Multiple Operators (mirrors DeployAnoa.s.sol pattern) ──

    function test_multipleOperators() public {
        address coreContract = address(20);
        address eoaOperator = address(21);

        // Owner authorizes both core contract and EOA operator (like deploy script)
        vm.startPrank(owner);
        vault.setOperator(coreContract, true);
        vault.setOperator(eoaOperator, true);
        vm.stopPrank();

        // Create delegation
        vm.prank(user1);
        uint256 delegationId = vault.delegateCapital{value: 50 ether}(AGENT_ID);

        uint256[] memory ids = new uint256[](1);
        ids[0] = delegationId;
        int256[] memory pnls = new int256[](1);
        pnls[0] = 5 ether;

        // Both should be able to record PnL
        vm.prank(coreContract);
        vault.batchRecordPnl(ids, pnls);
        assertEq(vault.getDelegationPnl(delegationId), 5 ether);

        pnls[0] = 3 ether;
        vm.prank(eoaOperator);
        vault.batchRecordPnl(ids, pnls);
        assertEq(vault.getDelegationPnl(delegationId), 8 ether);
    }

    function test_revokeOperator() public {
        address eoaOperator = address(21);

        vm.startPrank(owner);
        vault.setOperator(eoaOperator, true);
        vault.setOperator(eoaOperator, false); // Revoke
        vm.stopPrank();

        vm.prank(user1);
        uint256 delegationId = vault.delegateCapital{value: 50 ether}(AGENT_ID);

        uint256[] memory ids = new uint256[](1);
        ids[0] = delegationId;
        int256[] memory pnls = new int256[](1);
        pnls[0] = 1 ether;

        // Revoked operator should fail
        vm.prank(eoaOperator);
        vm.expectRevert(AnoaCapitalVault.NotAuthorized.selector);
        vault.batchRecordPnl(ids, pnls);
    }

    function test_withdrawWithProfit() public {
        // Setup operator
        vm.prank(owner);
        vault.setOperator(address(10), true);

        // Delegate 100 ether
        vm.prank(user1);
        uint256 delegationId = vault.delegateCapital{value: 100 ether}(AGENT_ID);

        // Record +20 ether profit
        vm.prank(address(10));
        vault.recordDelegationPnl(delegationId, 20 ether);

        // Deposit profits so vault has enough balance
        vm.deal(address(20), 20 ether);
        vm.prank(address(20));
        vault.depositProfits{value: 20 ether}(AGENT_ID);

        // Withdraw — performance fee = 20 * 20% = 4 ether
        // Net = 100 + 16 = 116 ether (no withdrawal fee set)
        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        vault.withdrawCapital(delegationId, user1);
        uint256 balanceAfter = user1.balance;

        assertEq(balanceAfter - balanceBefore, 116 ether);
        // Performance fee goes to accumulatedFees
        assertEq(vault.accumulatedFees(), 4 ether);
    }

    function test_withdrawWithLoss() public {
        // Setup operator
        vm.prank(owner);
        vault.setOperator(address(10), true);

        // Delegate 100 ether
        vm.prank(user1);
        uint256 delegationId = vault.delegateCapital{value: 100 ether}(AGENT_ID);

        // Record -30 ether loss
        vm.prank(address(10));
        vault.recordDelegationPnl(delegationId, -30 ether);

        // Withdraw — should get 100 - 30 = 70 ether
        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        vault.withdrawCapital(delegationId, user1);
        uint256 balanceAfter = user1.balance;

        assertEq(balanceAfter - balanceBefore, 70 ether);
    }

    function test_withdrawWithProfitAndFee() public {
        // Setup: operator + 1% withdrawal fee
        vm.prank(owner);
        vault.setOperator(address(10), true);
        vm.prank(owner);
        vault.updateFeeConfig(0, 0, 100, 0); // 1% withdrawal fee

        // Delegate 100 ether
        vm.prank(user1);
        uint256 delegationId = vault.delegateCapital{value: 100 ether}(AGENT_ID);

        // Record +50 ether profit
        vm.prank(address(10));
        vault.recordDelegationPnl(delegationId, 50 ether);

        // Deposit profits
        vm.deal(address(20), 50 ether);
        vm.prank(address(20));
        vault.depositProfits{value: 50 ether}(AGENT_ID);

        // Performance fee = 50 * 20% = 10 ether
        // Net total = 100 + 40 = 140 ether
        // Withdrawal fee = ceil(140e18 * 100 / 10000) = 1.4 ether
        // Amount after fee = 140 - 1.4 = 138.6 ether
        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        vault.withdrawCapital(delegationId, user1);
        uint256 balanceAfter = user1.balance;

        assertEq(balanceAfter - balanceBefore, 138.6 ether);
        // accumulatedFees = performanceFee(10) + withdrawalFee(1.4) = 11.4 ether
        assertEq(vault.accumulatedFees(), 11.4 ether);
    }

    function test_depositProfits() public {
        // Deposit profits to vault
        vm.deal(address(20), 50 ether);
        uint256 vaultBefore = address(vault).balance;

        vm.prank(address(20));
        vault.depositProfits{value: 50 ether}(AGENT_ID);

        assertEq(address(vault).balance, vaultBefore + 50 ether);
    }

    function test_depositProfits_zeroReverts() public {
        vm.prank(user1);
        vm.expectRevert(AnoaCapitalVault.ZeroAmount.selector);
        vault.depositProfits{value: 0}(AGENT_ID);
    }

    function test_setAgentPerformanceFee() public {
        // Owner can set
        vm.prank(owner);
        vault.setAgentPerformanceFee(AGENT_ID, 3000);
        assertEq(vault.getPerformanceFee(AGENT_ID), 3000);

        // Default for unset agent
        assertEq(vault.getPerformanceFee(999), 2000); // defaultPerformanceFeeBps
    }

    function test_setAgentPerformanceFee_nonOwnerReverts() public {
        vm.prank(user1);
        vm.expectRevert();
        vault.setAgentPerformanceFee(AGENT_ID, 3000);
    }

    function test_setAgentPerformanceFee_tooHighReverts() public {
        vm.prank(owner);
        vm.expectRevert(AnoaCapitalVault.InvalidFee.selector);
        vault.setAgentPerformanceFee(AGENT_ID, 6000); // > 5000 = 50%
    }

    function test_withdrawWithTotalLoss() public {
        // Setup operator
        vm.prank(owner);
        vault.setOperator(address(10), true);

        // Delegate 100 ether
        vm.prank(user1);
        uint256 delegationId = vault.delegateCapital{value: 100 ether}(AGENT_ID);

        // Record loss >= principal (-120 ether)
        vm.prank(address(10));
        vault.recordDelegationPnl(delegationId, -120 ether);

        // Withdraw — should get 0 (total loss)
        uint256 balanceBefore = user1.balance;
        vm.prank(user1);
        vault.withdrawCapital(delegationId, user1);
        uint256 balanceAfter = user1.balance;

        assertEq(balanceAfter - balanceBefore, 0);
    }

    // ========================================
    // CAPITAL FLOW TESTS
    // ========================================

    function test_setAgentWallet() public {
        address agentWalletAddr = address(50);

        // Owner can set
        vm.prank(owner);
        vault.setAgentWallet(AGENT_ID, agentWalletAddr);
        assertEq(vault.getAgentWallet(AGENT_ID), agentWalletAddr);

        // Operator can set
        vm.prank(owner);
        vault.setOperator(address(10), true);

        vm.prank(address(10));
        vault.setAgentWallet(AGENT_ID, address(51));
        assertEq(vault.getAgentWallet(AGENT_ID), address(51));
    }

    function test_setAgentWallet_notAuthorized() public {
        vm.prank(user1);
        vm.expectRevert(AnoaCapitalVault.NotAuthorized.selector);
        vault.setAgentWallet(AGENT_ID, address(50));
    }

    function test_setAgentWallet_zeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(AnoaCapitalVault.ZeroAddress.selector);
        vault.setAgentWallet(AGENT_ID, address(0));
    }

    function test_releaseFundsToAgent() public {
        address agentWalletAddr = address(50);

        // Setup: operator + agent wallet + delegation
        vm.startPrank(owner);
        vault.setOperator(address(10), true);
        vault.setAgentWallet(AGENT_ID, agentWalletAddr);
        vm.stopPrank();

        vm.prank(user1);
        vault.delegateCapital{value: 100 ether}(AGENT_ID);

        // Check releasable
        assertEq(vault.getReleasableCapital(AGENT_ID), 100 ether);

        // Release 80 ether to agent
        uint256 walletBefore = agentWalletAddr.balance;
        vm.prank(address(10));
        vault.releaseFundsToAgent(AGENT_ID, 80 ether);

        assertEq(agentWalletAddr.balance - walletBefore, 80 ether);
        assertEq(vault.releasedCapital(AGENT_ID), 80 ether);
        assertEq(vault.getReleasableCapital(AGENT_ID), 20 ether);
    }

    function test_releaseFundsToAgent_noWalletSet() public {
        vm.prank(owner);
        vault.setOperator(address(10), true);

        vm.prank(user1);
        vault.delegateCapital{value: 100 ether}(AGENT_ID);

        vm.prank(address(10));
        vm.expectRevert(AnoaCapitalVault.AgentWalletNotSet.selector);
        vault.releaseFundsToAgent(AGENT_ID, 50 ether);
    }

    function test_releaseFundsToAgent_exceedsAvailable() public {
        vm.startPrank(owner);
        vault.setOperator(address(10), true);
        vault.setAgentWallet(AGENT_ID, address(50));
        vm.stopPrank();

        vm.prank(user1);
        vault.delegateCapital{value: 100 ether}(AGENT_ID);

        // Try to release more than delegated
        vm.prank(address(10));
        vm.expectRevert(AnoaCapitalVault.InsufficientReleasableCapital.selector);
        vault.releaseFundsToAgent(AGENT_ID, 101 ether);
    }

    function test_returnFundsFromAgent() public {
        address agentWalletAddr = address(50);
        vm.deal(agentWalletAddr, 200 ether);

        vm.startPrank(owner);
        vault.setOperator(address(10), true);
        vault.setAgentWallet(AGENT_ID, agentWalletAddr);
        vm.stopPrank();

        vm.prank(user1);
        vault.delegateCapital{value: 100 ether}(AGENT_ID);

        // Release funds
        vm.prank(address(10));
        vault.releaseFundsToAgent(AGENT_ID, 100 ether);
        assertEq(vault.releasedCapital(AGENT_ID), 100 ether);

        // Return 120 ether (profit)
        uint256 vaultBefore = address(vault).balance;
        vm.prank(agentWalletAddr);
        vault.returnFundsFromAgent{value: 120 ether}(AGENT_ID);

        assertEq(address(vault).balance - vaultBefore, 120 ether);
        assertEq(vault.releasedCapital(AGENT_ID), 0); // Cleared
    }

    function test_capitalFlowFullCycle() public {
        address agentWalletAddr = address(50);
        vm.deal(agentWalletAddr, 500 ether);

        // Setup
        vm.startPrank(owner);
        vault.setOperator(address(10), true);
        vault.setAgentWallet(AGENT_ID, agentWalletAddr);
        vm.stopPrank();

        // Step 1: Two users delegate
        vm.prank(user1);
        uint256 d1 = vault.delegateCapital{value: 60 ether}(AGENT_ID);
        vm.prank(user2);
        uint256 d2 = vault.delegateCapital{value: 40 ether}(AGENT_ID);

        assertEq(vault.agentCapital(AGENT_ID), 100 ether);

        // Step 2: Operator releases all funds to agent
        vm.prank(address(10));
        vault.releaseFundsToAgent(AGENT_ID, 100 ether);

        // Step 3: Agent trades, makes 10% profit (110 ether)
        // Agent returns funds
        vm.prank(agentWalletAddr);
        vault.returnFundsFromAgent{value: 110 ether}(AGENT_ID);

        // Step 4: Operator records pro-rata PnL
        // user1: 60/100 * 10 = +6 ether, user2: 40/100 * 10 = +4 ether
        uint256[] memory ids = new uint256[](2);
        ids[0] = d1;
        ids[1] = d2;
        int256[] memory pnls = new int256[](2);
        pnls[0] = 6 ether;
        pnls[1] = 4 ether;

        vm.prank(address(10));
        vault.batchRecordPnl(ids, pnls);

        // Step 5: User1 withdraws — 60 + 6 profit, perf fee = 6*20% = 1.2, net = 64.8
        uint256 bal1Before = user1.balance;
        vm.prank(user1);
        vault.withdrawCapital(d1, user1);
        assertEq(user1.balance - bal1Before, 64.8 ether);

        // Step 6: User2 withdraws — 40 + 4 profit, perf fee = 4*20% = 0.8, net = 43.2
        uint256 bal2Before = user2.balance;
        vm.prank(user2);
        vault.withdrawCapital(d2, user2);
        assertEq(user2.balance - bal2Before, 43.2 ether);

        // Total performance fees = 1.2 + 0.8 = 2 ether
        assertEq(vault.accumulatedFees(), 2 ether);
    }

    function test_getAgentCapitalStatus() public {
        address agentWalletAddr = address(50);

        vm.startPrank(owner);
        vault.setOperator(address(10), true);
        vault.setAgentWallet(AGENT_ID, agentWalletAddr);
        vm.stopPrank();

        vm.prank(user1);
        vault.delegateCapital{value: 100 ether}(AGENT_ID);

        // Before release
        (uint256 total, uint256 released, uint256 inVault, address wallet) = vault.getAgentCapitalStatus(AGENT_ID);
        assertEq(total, 100 ether);
        assertEq(released, 0);
        assertEq(inVault, 100 ether);
        assertEq(wallet, agentWalletAddr);

        // After partial release
        vm.prank(address(10));
        vault.releaseFundsToAgent(AGENT_ID, 60 ether);

        (total, released, inVault, wallet) = vault.getAgentCapitalStatus(AGENT_ID);
        assertEq(total, 100 ether);
        assertEq(released, 60 ether);
        assertEq(inVault, 40 ether);
    }

    function test_setDefaultPerformanceFeeBps() public {
        vm.prank(owner);
        vault.setDefaultPerformanceFeeBps(1500); // 15%
        assertEq(vault.defaultPerformanceFeeBps(), 1500);

        // Unset agent should use new default
        assertEq(vault.getPerformanceFee(999), 1500);
    }

    function test_setDefaultPerformanceFeeBps_tooHigh() public {
        vm.prank(owner);
        vm.expectRevert(AnoaCapitalVault.InvalidFee.selector);
        vault.setDefaultPerformanceFeeBps(6000);
    }
}
