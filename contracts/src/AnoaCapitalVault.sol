// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title AnoaCapitalVault
 * @author ANOA Protocol Team
 * @notice Capital Vault for ERC-8004 AI Trading Agents
 * @dev Handles capital delegation, fee collection, and withdrawals
 *
 * Key Features:
 * - Native MON token deposits and withdrawals
 * - ERC20 token support for stablecoins
 * - Platform fee collection (registration + trading fees)
 * - Delegation to external wallets (not just contract)
 * - Agent capital tracking
 * - Multi-recipient withdrawals
 * - Emergency controls
 *
 * FUND SEPARATION MODEL:
 * ──────────────────────
 * 1. **User Delegation Funds** — Each delegation is tracked with a unique
 *    delegationId. ONLY the original delegator (delegation.delegator) can
 *    withdraw their own capital. Multiple users delegating to the same agent
 *    each get separate delegation records. Funds NEVER mix between delegators.
 *
 * 2. **Platform Fees (accumulatedFees / tokenFees)** — Revenue collected from
 *    agent registration fees, trading fees (basis points on trade volume), and
 *    withdrawal fees. ONLY the contract owner can withdraw these via
 *    withdrawFees() / withdrawTokenFees(). Platform fees are completely
 *    separate from user capital.
 *
 * These two pools NEVER mix. The contract maintains strict accounting so
 * user funds are never accessible by admin, and fee revenue is never
 * accessible by delegators.
 */
contract AnoaCapitalVault is 
    Ownable,
    ReentrancyGuard,
    Pausable
{
    using SafeERC20 for IERC20;

    // ============================================
    // TYPE DECLARATIONS
    // ============================================
    
    /**
     * @notice Capital delegation record
     * @param delegator Address that delegated capital
     * @param agentId Agent token ID
     * @param amount Amount delegated
     * @param depositedAt Deposit timestamp
     * @param lockupEndsAt Lock period end timestamp
     * @param isActive Whether delegation is active
     */
    struct Delegation {
        address delegator;
        uint256 agentId;
        uint256 amount;
        uint256 depositedAt;
        uint256 lockupEndsAt;
        bool isActive;
        int256 accumulatedPnl;
    }
    
    /**
     * @notice Fee configuration
     * @param registrationFee Fee for agent registration
     * @param tradingFeeBps Trading fee in basis points (100 = 1%)
     * @param withdrawalFeeBps Withdrawal fee in basis points
     * @param minCapital Minimum capital for delegation
     */
    struct FeeConfig {
        uint256 registrationFee;
        uint256 tradingFeeBps;
        uint256 withdrawalFeeBps;
        uint256 minCapital;
    }

    // ============================================
    // CONSTANTS
    // ============================================
    
    /// @notice Maximum basis points (100%)
    uint256 public constant MAX_BPS = 10000;
    
    /// @notice Maximum fee in basis points (10%)
    uint256 public constant MAX_FEE_BPS = 1000;
    
    /// @notice Minimum lockup period (1 hour)
    uint256 public constant MIN_LOCKUP_PERIOD = 1 hours;
    
    /// @notice Maximum lockup period (365 days)
    uint256 public constant MAX_LOCKUP_PERIOD = 365 days;

    // ============================================
    // STATE VARIABLES
    // ============================================
    
    /// @notice Fee configuration
    FeeConfig public feeConfig;
    
    /// @notice Fee recipient address
    address public feeRecipient;
    
    /// @notice Treasury address for platform revenue
    address public treasury;
    
    /// @notice Default lockup period for delegations
    uint256 public defaultLockupPeriod;
    
    /// @notice Total accumulated platform fees (native)
    uint256 public accumulatedFees;
    
    /// @notice Total capital delegated (native)
    uint256 public totalDelegatedCapital;
    
    /// @notice Delegation counter
    uint256 private _delegationIdCounter;
    
    /// @notice Mapping from delegation ID to delegation data
    mapping(uint256 => Delegation) public delegations;
    
    /// @notice Mapping from agent ID to total delegated capital
    mapping(uint256 => uint256) public agentCapital;
    
    /// @notice Mapping from agent ID to array of delegation IDs
    mapping(uint256 => uint256[]) public agentDelegations;
    
    /// @notice Mapping from delegator to array of delegation IDs
    mapping(address => uint256[]) public delegatorDelegations;
    
    /// @notice Mapping from token address to accumulated fees
    mapping(address => uint256) public tokenFees;
    
    /// @notice Mapping from token address to total delegated (global)
    mapping(address => uint256) public tokenDelegatedCapital;

    /// @notice Mapping from agent ID => token address => delegated amount (per-agent ERC20 tracking)
    mapping(uint256 => mapping(address => uint256)) public agentTokenCapital;
    
    /// @notice Whitelisted tokens for delegation
    mapping(address => bool) public whitelistedTokens;
    
    /// @notice Authorized operators (can trigger trades)
    mapping(address => bool) public authorizedOperators;

    /// @notice Performance fee per agent in basis points (e.g., 2000 = 20%)
    mapping(uint256 => uint256) public agentPerformanceFeeBps;

    /// @notice Default performance fee (20%)
    uint256 public defaultPerformanceFeeBps = 2000;

    /// @notice Mapping from agent ID to agent trading wallet address
    mapping(uint256 => address) public agentWallets;

    /// @notice Mapping from agent ID to total capital currently released to agent for trading
    mapping(uint256 => uint256) public releasedCapital;

    // ============================================
    // EVENTS
    // ============================================
    
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
    
    event TokenDelegated(
        uint256 indexed delegationId,
        address indexed token,
        address indexed delegator,
        uint256 agentId,
        uint256 amount
    );
    
    event TokenWithdrawn(
        uint256 indexed delegationId,
        address indexed token,
        address indexed recipient,
        uint256 amount,
        uint256 fee
    );
    
    event RegistrationFeePaid(
        address indexed payer,
        uint256 indexed agentId,
        uint256 amount
    );
    
    event TradingFeePaid(
        uint256 indexed agentId,
        address indexed token,
        uint256 amount
    );
    
    event FeesWithdrawn(
        address indexed recipient,
        uint256 amount
    );
    
    event TokenFeesWithdrawn(
        address indexed token,
        address indexed recipient,
        uint256 amount
    );
    
    event FeeConfigUpdated(
        uint256 registrationFee,
        uint256 tradingFeeBps,
        uint256 withdrawalFeeBps,
        uint256 minCapital
    );
    
    event FeeRecipientUpdated(address indexed newRecipient);
    event TreasuryUpdated(address indexed newTreasury);
    event TokenWhitelisted(address indexed token, bool status);
    event OperatorUpdated(address indexed operator, bool status);
    event LockupPeriodUpdated(uint256 newPeriod);

    event PnLRecorded(
        uint256 indexed delegationId,
        uint256 indexed agentId,
        address indexed delegator,
        int256 pnlAmount,
        int256 totalAccumulatedPnl
    );

    event ProfitsDeposited(
        uint256 indexed agentId,
        address indexed depositor,
        uint256 amount
    );

    event PerformanceFeeUpdated(
        uint256 indexed agentId,
        uint256 feeBps
    );

    event AgentWalletSet(
        uint256 indexed agentId,
        address indexed wallet
    );

    event FundsReleasedToAgent(
        uint256 indexed agentId,
        address indexed agentWallet,
        uint256 amount
    );

    event FundsReturnedFromAgent(
        uint256 indexed agentId,
        address indexed sender,
        uint256 amount
    );

    event PerformanceFeeCharged(
        uint256 indexed delegationId,
        uint256 indexed agentId,
        uint256 feeAmount
    );

    event DefaultPerformanceFeeUpdated(
        uint256 feeBps
    );

    // ============================================
    // ERRORS
    // ============================================
    
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientAmount();
    error BelowMinCapital();
    error InvalidFee();
    error InvalidPeriod();
    error DelegationNotActive();
    error LockupNotEnded();
    error NotDelegator();
    error TokenNotWhitelisted();
    error InsufficientBalance();
    error TransferFailed();
    error NotAuthorized();
    error LengthMismatch();
    error BatchTooLarge();
    error AgentWalletNotSet();
    error InsufficientReleasableCapital();
    error NotAgentWallet();

    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    /**
     * @notice Initialize the Capital Vault
     * @param _owner Contract owner address
     * @param _feeRecipient Fee recipient address
     * @param _treasury Treasury address
     */
    constructor(
        address _owner,
        address _feeRecipient,
        address _treasury
    ) Ownable(_owner) {
        if (_feeRecipient == address(0)) revert ZeroAddress();
        if (_treasury == address(0)) revert ZeroAddress();
        
        feeRecipient = _feeRecipient;
        treasury = _treasury;
        
        // All fees start at 0 - must be configured via updateFeeConfig()
        // This allows backend/frontend to control fee settings
        feeConfig = FeeConfig({
            registrationFee: 0,    // Configurable
            tradingFeeBps: 0,      // Configurable
            withdrawalFeeBps: 0,   // Configurable
            minCapital: 0          // Configurable
        });
        
        defaultLockupPeriod = 0; // Configurable via updateLockupPeriod()
    }

    // ============================================
    // EXTERNAL FUNCTIONS - DELEGATION
    // ============================================
    
    /**
     * @notice Delegate native MON to an agent
     * @param agentId Agent token ID
     * @return delegationId The delegation ID
     */
    function delegateCapital(uint256 agentId) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
        returns (uint256 delegationId) 
    {
        if (msg.value == 0) revert ZeroAmount();
        if (msg.value < feeConfig.minCapital) revert BelowMinCapital();
        
        delegationId = _createDelegation(
            msg.sender,
            agentId,
            msg.value,
            block.timestamp + defaultLockupPeriod
        );
        
        totalDelegatedCapital += msg.value;
        agentCapital[agentId] += msg.value;
        
        emit CapitalDelegated(
            delegationId,
            msg.sender,
            agentId,
            msg.value,
            block.timestamp + defaultLockupPeriod
        );
    }
    
    /**
     * @notice Delegate native MON with custom lockup period
     * @param agentId Agent token ID
     * @param lockupPeriod Custom lockup period in seconds
     * @return delegationId The delegation ID
     */
    function delegateCapitalWithLockup(uint256 agentId, uint256 lockupPeriod) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
        returns (uint256 delegationId) 
    {
        if (msg.value == 0) revert ZeroAmount();
        if (msg.value < feeConfig.minCapital) revert BelowMinCapital();
        if (lockupPeriod < MIN_LOCKUP_PERIOD || lockupPeriod > MAX_LOCKUP_PERIOD) {
            revert InvalidPeriod();
        }
        
        delegationId = _createDelegation(
            msg.sender,
            agentId,
            msg.value,
            block.timestamp + lockupPeriod
        );
        
        totalDelegatedCapital += msg.value;
        agentCapital[agentId] += msg.value;
        
        emit CapitalDelegated(
            delegationId,
            msg.sender,
            agentId,
            msg.value,
            block.timestamp + lockupPeriod
        );
    }
    
    /**
     * @notice Delegate ERC20 tokens to an agent
     * @param token Token address
     * @param agentId Agent token ID
     * @param amount Amount to delegate
     * @return delegationId The delegation ID
     */
    function delegateToken(
        address token,
        uint256 agentId,
        uint256 amount
    ) 
        external 
        nonReentrant 
        whenNotPaused 
        returns (uint256 delegationId) 
    {
        if (token == address(0)) revert ZeroAddress();
        if (!whitelistedTokens[token]) revert TokenNotWhitelisted();
        if (amount == 0) revert ZeroAmount();
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        delegationId = _createDelegation(
            msg.sender,
            agentId,
            amount,
            block.timestamp + defaultLockupPeriod
        );

        tokenDelegatedCapital[token] += amount;
        agentTokenCapital[agentId][token] += amount;

        emit TokenDelegated(
            delegationId,
            token,
            msg.sender,
            agentId,
            amount
        );
    }

    // ============================================
    // EXTERNAL FUNCTIONS - WITHDRAWAL
    // ============================================
    
    /**
     * @notice Withdraw delegated capital to any recipient
     * @param delegationId Delegation ID
     * @param recipient Recipient address (can be any wallet)
     */
    function withdrawCapital(uint256 delegationId, address recipient) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        if (recipient == address(0)) revert ZeroAddress();
        
        Delegation storage delegation = delegations[delegationId];
        
        if (!delegation.isActive) revert DelegationNotActive();
        if (delegation.delegator != msg.sender) revert NotDelegator();
        if (block.timestamp < delegation.lockupEndsAt) revert LockupNotEnded();

        // Calculate total withdrawable including PnL with performance fee deduction
        uint256 principal = delegation.amount;
        int256 pnl = delegation.accumulatedPnl;
        uint256 performanceFee = 0;
        uint256 totalWithdrawable;

        if (pnl > 0) {
            // Deduct performance fee from profits only
            uint256 profit = uint256(pnl);
            uint256 perfFeeBps = getPerformanceFee(delegation.agentId);
            performanceFee = (profit * perfFeeBps) / MAX_BPS;
            uint256 netProfit = profit - performanceFee;
            totalWithdrawable = principal + netProfit;
        } else if (pnl < 0) {
            uint256 loss = uint256(-pnl);
            totalWithdrawable = loss >= principal ? 0 : principal - loss;
        } else {
            totalWithdrawable = principal;
        }

        uint256 withdrawalFee = (totalWithdrawable * feeConfig.withdrawalFeeBps + MAX_BPS - 1) / MAX_BPS;
        uint256 amountAfterFee = totalWithdrawable - withdrawalFee;
        uint256 totalFee = performanceFee + withdrawalFee;

        // Validate contract has sufficient balance before transfer
        if (address(this).balance < amountAfterFee) revert InsufficientBalance();

        // Update state
        delegation.isActive = false;
        totalDelegatedCapital -= principal;
        agentCapital[delegation.agentId] -= principal;
        accumulatedFees += totalFee;

        // Transfer to recipient (can be any external wallet)
        (bool success, ) = payable(recipient).call{value: amountAfterFee}("");
        if (!success) revert TransferFailed();

        if (performanceFee > 0) {
            emit PerformanceFeeCharged(delegationId, delegation.agentId, performanceFee);
        }

        emit CapitalWithdrawn(
            delegationId,
            msg.sender,
            recipient,
            amountAfterFee,
            totalFee
        );
    }
    
    /**
     * @notice Emergency withdraw without fee (only after extended lockup)
     * @param delegationId Delegation ID
     */
    function emergencyWithdraw(uint256 delegationId) 
        external 
        nonReentrant 
    {
        Delegation storage delegation = delegations[delegationId];
        
        if (!delegation.isActive) revert DelegationNotActive();
        if (delegation.delegator != msg.sender) revert NotDelegator();
        
        // Allow emergency withdraw 7 days after lockup ends
        if (block.timestamp < delegation.lockupEndsAt + 7 days) {
            revert LockupNotEnded();
        }
        
        uint256 amount = delegation.amount;

        // Validate contract has sufficient balance before transfer
        if (address(this).balance < amount) revert InsufficientBalance();

        // Update state
        delegation.isActive = false;
        totalDelegatedCapital -= amount;
        agentCapital[delegation.agentId] -= amount;

        // Transfer without fee
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit CapitalWithdrawn(
            delegationId,
            msg.sender,
            msg.sender,
            amount,
            0
        );
    }
    
    /**
     * @notice Withdraw ERC20 tokens to any recipient
     * @param delegationId Delegation ID
     * @param token Token address
     * @param recipient Recipient address
     */
    function withdrawToken(
        uint256 delegationId,
        address token,
        address recipient
    ) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        if (recipient == address(0)) revert ZeroAddress();
        if (token == address(0)) revert ZeroAddress();
        
        Delegation storage delegation = delegations[delegationId];
        
        if (!delegation.isActive) revert DelegationNotActive();
        if (delegation.delegator != msg.sender) revert NotDelegator();
        if (block.timestamp < delegation.lockupEndsAt) revert LockupNotEnded();
        
        uint256 amount = delegation.amount;
        uint256 fee = (amount * feeConfig.withdrawalFeeBps + MAX_BPS - 1) / MAX_BPS;
        uint256 amountAfterFee = amount - fee;

        // Validate contract has sufficient token balance before transfer
        if (IERC20(token).balanceOf(address(this)) < amountAfterFee) revert InsufficientBalance();

        // Update state
        delegation.isActive = false;
        tokenDelegatedCapital[token] -= amount;
        agentTokenCapital[delegation.agentId][token] -= amount;
        tokenFees[token] += fee;
        
        // Transfer to recipient
        IERC20(token).safeTransfer(recipient, amountAfterFee);
        
        emit TokenWithdrawn(
            delegationId,
            token,
            recipient,
            amountAfterFee,
            fee
        );
    }

    // ============================================
    // EXTERNAL FUNCTIONS - FEES
    // ============================================
    
    /**
     * @notice Pay registration fee for agent creation
     * @param agentId Agent token ID being registered
     */
    function payRegistrationFee(uint256 agentId) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
    {
        if (msg.value < feeConfig.registrationFee) revert InsufficientAmount();
        
        accumulatedFees += msg.value;
        
        emit RegistrationFeePaid(msg.sender, agentId, msg.value);
    }
    
    /**
     * @notice Record trading fee (called by authorized operators)
     * @param agentId Agent token ID
     * @param token Token address (address(0) for native)
     * @param tradeAmount Trade amount to calculate fee
     */
    function recordTradingFee(
        uint256 agentId,
        address token,
        uint256 tradeAmount
    ) 
        external 
        nonReentrant 
    {
        if (!authorizedOperators[msg.sender]) revert NotAuthorized();
        
        uint256 fee = (tradeAmount * feeConfig.tradingFeeBps + MAX_BPS - 1) / MAX_BPS;
        
        if (token == address(0)) {
            accumulatedFees += fee;
        } else {
            tokenFees[token] += fee;
        }
        
        emit TradingFeePaid(agentId, token, fee);
    }
    
    /**
     * @notice Withdraw accumulated native fees to treasury
     */
    function withdrawFees() 
        external 
        nonReentrant 
        onlyOwner 
    {
        uint256 amount = accumulatedFees;
        if (amount == 0) revert ZeroAmount();
        
        accumulatedFees = 0;
        
        (bool success, ) = payable(treasury).call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit FeesWithdrawn(treasury, amount);
    }
    
    /**
     * @notice Withdraw accumulated token fees to treasury
     * @param token Token address
     */
    function withdrawTokenFees(address token) 
        external 
        nonReentrant 
        onlyOwner 
    {
        if (token == address(0)) revert ZeroAddress();
        
        uint256 amount = tokenFees[token];
        if (amount == 0) revert ZeroAmount();
        
        tokenFees[token] = 0;
        
        IERC20(token).safeTransfer(treasury, amount);
        
        emit TokenFeesWithdrawn(token, treasury, amount);
    }
    
    /**
     * @notice Withdraw fees to custom recipient
     * @param recipient Custom recipient address
     * @param amount Amount to withdraw
     */
    function withdrawFeesToRecipient(address recipient, uint256 amount) 
        external 
        nonReentrant 
        onlyOwner 
    {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (amount > accumulatedFees) revert InsufficientBalance();
        
        accumulatedFees -= amount;
        
        (bool success, ) = payable(recipient).call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit FeesWithdrawn(recipient, amount);
    }

    // ============================================
    // EXTERNAL FUNCTIONS - ADMIN
    // ============================================
    
    /**
     * @notice Update fee configuration
     * @param _registrationFee New registration fee
     * @param _tradingFeeBps New trading fee in basis points
     * @param _withdrawalFeeBps New withdrawal fee in basis points
     * @param _minCapital New minimum capital
     */
    function updateFeeConfig(
        uint256 _registrationFee,
        uint256 _tradingFeeBps,
        uint256 _withdrawalFeeBps,
        uint256 _minCapital
    ) 
        external 
        onlyOwner 
    {
        if (_tradingFeeBps > MAX_FEE_BPS) revert InvalidFee();
        if (_withdrawalFeeBps > MAX_FEE_BPS) revert InvalidFee();
        
        feeConfig = FeeConfig({
            registrationFee: _registrationFee,
            tradingFeeBps: _tradingFeeBps,
            withdrawalFeeBps: _withdrawalFeeBps,
            minCapital: _minCapital
        });
        
        emit FeeConfigUpdated(
            _registrationFee,
            _tradingFeeBps,
            _withdrawalFeeBps,
            _minCapital
        );
    }
    
    /**
     * @notice Update fee recipient
     * @param _feeRecipient New fee recipient address
     */
    function updateFeeRecipient(address _feeRecipient) 
        external 
        onlyOwner 
    {
        if (_feeRecipient == address(0)) revert ZeroAddress();
        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(_feeRecipient);
    }
    
    /**
     * @notice Update treasury address
     * @param _treasury New treasury address
     */
    function updateTreasury(address _treasury) 
        external 
        onlyOwner 
    {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }
    
    /**
     * @notice Update default lockup period
     * @param _period New lockup period in seconds
     */
    function updateDefaultLockupPeriod(uint256 _period) 
        external 
        onlyOwner 
    {
        if (_period < MIN_LOCKUP_PERIOD || _period > MAX_LOCKUP_PERIOD) {
            revert InvalidPeriod();
        }
        defaultLockupPeriod = _period;
        emit LockupPeriodUpdated(_period);
    }
    
    /**
     * @notice Whitelist or remove token for delegation
     * @param token Token address
     * @param status Whitelist status
     */
    function setTokenWhitelist(address token, bool status) 
        external 
        onlyOwner 
    {
        if (token == address(0)) revert ZeroAddress();
        whitelistedTokens[token] = status;
        emit TokenWhitelisted(token, status);
    }
    
    /**
     * @notice Set authorized operator status
     * @param operator Operator address
     * @param status Authorization status
     */
    function setOperator(address operator, bool status) 
        external 
        onlyOwner 
    {
        if (operator == address(0)) revert ZeroAddress();
        authorizedOperators[operator] = status;
        emit OperatorUpdated(operator, status);
    }
    
    /**
     * @notice Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    /**
     * @notice Get delegation details
     * @param delegationId Delegation ID
     * @return delegation Delegation data
     */
    function getDelegation(uint256 delegationId) 
        external 
        view 
        returns (Delegation memory) 
    {
        return delegations[delegationId];
    }
    
    /**
     * @notice Get all delegations for an agent
     * @param agentId Agent token ID
     * @return delegationIds Array of delegation IDs
     */
    function getAgentDelegations(uint256 agentId) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return agentDelegations[agentId];
    }
    
    /**
     * @notice Get all delegations for a delegator
     * @param delegator Delegator address
     * @return delegationIds Array of delegation IDs
     */
    function getDelegatorDelegations(address delegator) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return delegatorDelegations[delegator];
    }
    
    /**
     * @notice Get active delegated capital for an agent
     * @param agentId Agent token ID
     * @return total Total active delegated capital
     */
    function getActiveAgentCapital(uint256 agentId) 
        external 
        view 
        returns (uint256 total) 
    {
        uint256[] memory ids = agentDelegations[agentId];
        for (uint256 i = 0; i < ids.length; i++) {
            if (delegations[ids[i]].isActive) {
                total += delegations[ids[i]].amount;
            }
        }
    }
    
    /**
     * @notice Check if delegation lockup has ended
     * @param delegationId Delegation ID
     * @return ended Whether lockup has ended
     */
    function isLockupEnded(uint256 delegationId) 
        external 
        view 
        returns (bool) 
    {
        return block.timestamp >= delegations[delegationId].lockupEndsAt;
    }
    
    /**
     * @notice Get current fee configuration
     * @return config Fee configuration
     */
    function getFeeConfig() 
        external 
        view 
        returns (FeeConfig memory) 
    {
        return feeConfig;
    }
    
    /**
     * @notice Calculate withdrawal amount after fee
     * @param amount Original amount
     * @return amountAfterFee Amount after fee deduction
     * @return fee Fee amount
     */
    function calculateWithdrawalFee(uint256 amount) 
        external 
        view 
        returns (uint256 amountAfterFee, uint256 fee) 
    {
        fee = (amount * feeConfig.withdrawalFeeBps + MAX_BPS - 1) / MAX_BPS;
        amountAfterFee = amount - fee;
    }

    // ============================================
    // INTERNAL FUNCTIONS
    // ============================================
    
    /**
     * @notice Create a new delegation record
     * @param delegator Delegator address
     * @param agentId Agent token ID
     * @param amount Amount delegated
     * @param lockupEndsAt Lockup end timestamp
     * @return delegationId The new delegation ID
     */
    function _createDelegation(
        address delegator,
        uint256 agentId,
        uint256 amount,
        uint256 lockupEndsAt
    ) 
        internal 
        returns (uint256 delegationId) 
    {
        delegationId = ++_delegationIdCounter;
        
        delegations[delegationId] = Delegation({
            delegator: delegator,
            agentId: agentId,
            amount: amount,
            depositedAt: block.timestamp,
            lockupEndsAt: lockupEndsAt,
            isActive: true,
            accumulatedPnl: 0
        });
        
        agentDelegations[agentId].push(delegationId);
        delegatorDelegations[delegator].push(delegationId);
    }

    // ============================================
    // EXTERNAL FUNCTIONS - PNL RECORDING
    // ============================================

    /**
     * @notice Record PnL for a single delegation (operator-only)
     * @param delegationId On-chain delegation ID
     * @param pnlAmount PnL amount (positive = profit, negative = loss)
     */
    function recordDelegationPnl(uint256 delegationId, int256 pnlAmount)
        external
        whenNotPaused
    {
        if (!authorizedOperators[msg.sender]) revert NotAuthorized();

        Delegation storage d = delegations[delegationId];
        if (!d.isActive) revert DelegationNotActive();

        d.accumulatedPnl += pnlAmount;

        emit PnLRecorded(delegationId, d.agentId, d.delegator, pnlAmount, d.accumulatedPnl);
    }

    /**
     * @notice Batch record PnL for multiple delegations (operator-only)
     * @param delegationIds Array of on-chain delegation IDs
     * @param pnlAmounts Array of PnL amounts (positive = profit, negative = loss)
     */
    function batchRecordPnl(
        uint256[] calldata delegationIds,
        int256[] calldata pnlAmounts
    )
        external
        whenNotPaused
    {
        if (!authorizedOperators[msg.sender]) revert NotAuthorized();
        if (delegationIds.length != pnlAmounts.length) revert LengthMismatch();
        if (delegationIds.length > 50) revert BatchTooLarge();

        for (uint256 i = 0; i < delegationIds.length; i++) {
            Delegation storage d = delegations[delegationIds[i]];
            if (!d.isActive) revert DelegationNotActive();

            d.accumulatedPnl += pnlAmounts[i];

            emit PnLRecorded(
                delegationIds[i],
                d.agentId,
                d.delegator,
                pnlAmounts[i],
                d.accumulatedPnl
            );
        }
    }

    /**
     * @notice Deposit trading profits into vault for agent's delegators to withdraw
     * @dev Ensures vault has sufficient balance for profitable withdrawals
     * @param agentId Agent token ID
     */
    function depositProfits(uint256 agentId) external payable whenNotPaused {
        if (msg.value == 0) revert ZeroAmount();
        emit ProfitsDeposited(agentId, msg.sender, msg.value);
    }

    // ============================================
    // EXTERNAL FUNCTIONS - CAPITAL FLOW TO AGENT
    // ============================================

    /**
     * @notice Set the trading wallet address for an agent
     * @dev Only owner or authorized operator can set agent wallet
     * @param agentId Agent token ID
     * @param wallet Agent's trading wallet address
     */
    function setAgentWallet(uint256 agentId, address wallet)
        external
    {
        if (msg.sender != owner() && !authorizedOperators[msg.sender]) revert NotAuthorized();
        if (wallet == address(0)) revert ZeroAddress();

        agentWallets[agentId] = wallet;
        emit AgentWalletSet(agentId, wallet);
    }

    /**
     * @notice Release delegated capital to agent's wallet for trading
     * @dev Only authorized operators can release funds. Tracks released amount.
     *      The operator calls this after verifying the delegation is valid.
     *      Agent wallet must be set first via setAgentWallet().
     * @param agentId Agent token ID
     * @param amount Amount to release (in wei)
     */
    function releaseFundsToAgent(uint256 agentId, uint256 amount)
        external
        nonReentrant
        whenNotPaused
    {
        if (!authorizedOperators[msg.sender]) revert NotAuthorized();
        if (amount == 0) revert ZeroAmount();

        address agentWallet = agentWallets[agentId];
        if (agentWallet == address(0)) revert AgentWalletNotSet();

        // Can only release up to (delegated - already released) for this agent
        uint256 available = agentCapital[agentId] - releasedCapital[agentId];
        if (amount > available) revert InsufficientReleasableCapital();

        // Ensure vault has sufficient balance
        if (address(this).balance < amount) revert InsufficientBalance();

        releasedCapital[agentId] += amount;

        (bool success, ) = payable(agentWallet).call{value: amount}("");
        if (!success) revert TransferFailed();

        emit FundsReleasedToAgent(agentId, agentWallet, amount);
    }

    /**
     * @notice Return funds from agent wallet back to vault after trading
     * @dev Anyone can call (typically the agent wallet or operator).
     *      The returned MON goes back into the vault balance.
     *      PnL recording is handled separately via batchRecordPnl.
     * @param agentId Agent token ID
     */
    function returnFundsFromAgent(uint256 agentId)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        if (msg.value == 0) revert ZeroAmount();

        // Reduce released capital tracker (can't go below 0)
        if (msg.value >= releasedCapital[agentId]) {
            releasedCapital[agentId] = 0;
        } else {
            releasedCapital[agentId] -= msg.value;
        }

        emit FundsReturnedFromAgent(agentId, msg.sender, msg.value);
    }

    // ============================================
    // EXTERNAL FUNCTIONS - PERFORMANCE FEE
    // ============================================

    /**
     * @notice Set performance fee for a specific agent
     * @param agentId Agent token ID
     * @param feeBps Performance fee in basis points (max 5000 = 50%)
     */
    function setAgentPerformanceFee(uint256 agentId, uint256 feeBps)
        external
        onlyOwner
    {
        if (feeBps > 5000) revert InvalidFee();
        agentPerformanceFeeBps[agentId] = feeBps;
        emit PerformanceFeeUpdated(agentId, feeBps);
    }

    /**
     * @notice Update the default performance fee for all agents
     * @param feeBps New default performance fee in basis points (max 5000 = 50%)
     */
    function setDefaultPerformanceFeeBps(uint256 feeBps)
        external
        onlyOwner
    {
        if (feeBps > 5000) revert InvalidFee();
        defaultPerformanceFeeBps = feeBps;
        emit DefaultPerformanceFeeUpdated(feeBps);
    }

    /**
     * @notice Get performance fee for an agent
     * @param agentId Agent token ID
     * @return feeBps Performance fee in basis points
     */
    function getPerformanceFee(uint256 agentId)
        public
        view
        returns (uint256 feeBps)
    {
        feeBps = agentPerformanceFeeBps[agentId];
        if (feeBps == 0) {
            feeBps = defaultPerformanceFeeBps;
        }
    }

    /**
     * @notice Get accumulated PnL for a delegation
     * @param delegationId Delegation ID
     * @return pnl Accumulated PnL (can be negative)
     */
    function getDelegationPnl(uint256 delegationId)
        external
        view
        returns (int256)
    {
        return delegations[delegationId].accumulatedPnl;
    }

    /**
     * @notice Get the trading wallet address for an agent
     * @param agentId Agent token ID
     * @return wallet Agent's trading wallet address
     */
    function getAgentWallet(uint256 agentId)
        external
        view
        returns (address)
    {
        return agentWallets[agentId];
    }

    /**
     * @notice Get how much capital can still be released to an agent
     * @param agentId Agent token ID
     * @return available Amount of delegated capital not yet released
     */
    function getReleasableCapital(uint256 agentId)
        external
        view
        returns (uint256 available)
    {
        uint256 delegated = agentCapital[agentId];
        uint256 released = releasedCapital[agentId];
        available = delegated > released ? delegated - released : 0;
    }

    /**
     * @notice Get capital flow status for an agent
     * @param agentId Agent token ID
     * @return totalDelegated Total capital delegated to agent
     * @return released Capital currently released to agent wallet
     * @return inVault Capital held in vault (not yet released)
     * @return wallet Agent's trading wallet address
     */
    function getAgentCapitalStatus(uint256 agentId)
        external
        view
        returns (
            uint256 totalDelegated,
            uint256 released,
            uint256 inVault,
            address wallet
        )
    {
        totalDelegated = agentCapital[agentId];
        released = releasedCapital[agentId];
        inVault = totalDelegated > released ? totalDelegated - released : 0;
        wallet = agentWallets[agentId];
    }

    // ============================================
    // RECEIVE & FALLBACK
    // ============================================
    
    /**
     * @notice Receive native tokens
     */
    receive() external payable {
        // Accept native token transfers
    }
    
    /**
     * @notice Fallback function
     */
    fallback() external payable {
        // Accept native token transfers
    }
}
