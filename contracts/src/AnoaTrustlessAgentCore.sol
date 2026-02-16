// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title AnoaTrustlessAgentCore
 * @author ANOA Protocol Team
 * @notice Core contract for ERC-8004 Trustless AI Trading Agents
 * @dev Main trading contract integrating:
 *      - ERC-8004 registries (Identity, Reputation, Validation)
 *      - Capital delegation with risk controls
 *      - Trade execution via DEX routers (Uniswap V3, etc.)
 *      - PnL tracking and performance metrics
 *      - EIP-712 typed signatures for trade intents
 * 
 * This contract serves as the "Risk Router" described in ERC-8004,
 * enforcing limits and recording trust signals for AI agents.
 */
contract AnoaTrustlessAgentCore is 
    Ownable,
    ReentrancyGuard,
    Pausable,
    EIP712
{
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // ============================================
    // TYPE DECLARATIONS
    // ============================================
    
    /**
     * @notice Risk parameters for capital delegation
     * @param maxPositionSize Maximum position size in stablecoin terms
     * @param maxLeverage Maximum allowed leverage (basis points, 10000 = 1x)
     * @param dailyLossLimit Maximum daily loss allowed
     * @param allowedMarkets Bitmap of allowed markets/tokens
     * @param cooldownPeriod Minimum time between trades
     * @param requireValidation Whether validation is required
     */
    struct RiskParameters {
        uint256 maxPositionSize;
        uint256 maxLeverage;
        uint256 dailyLossLimit;
        uint256 allowedMarkets;
        uint256 cooldownPeriod;
        bool requireValidation;
    }
    
    /**
     * @notice Capital delegation record
     * @param delegator Address that delegated capital
     * @param amount Amount delegated
     * @param depositedAt Deposit timestamp
     * @param lockupEndsAt End of lockup period
     * @param riskParams Associated risk parameters
     * @param isActive Whether delegation is active
     */
    struct CapitalDelegation {
        address delegator;
        uint256 amount;
        uint256 depositedAt;
        uint256 lockupEndsAt;
        RiskParameters riskParams;
        bool isActive;
    }
    
    /**
     * @notice Agent trading position
     * @param totalCapital Total capital available
     * @param usedCapital Capital currently in use
     * @param unrealizedPnL Unrealized profit/loss
     * @param realizedPnL Realized profit/loss
     * @param todayLoss Total loss for today
     * @param lastResetDay Day number for loss tracking
     * @param tradesCount Total trades executed
     * @param lastTradeAt Last trade timestamp
     */
    struct AgentPosition {
        uint256 totalCapital;
        uint256 usedCapital;
        int256 unrealizedPnL;
        int256 realizedPnL;
        uint256 todayLoss;
        uint256 lastResetDay;
        uint256 tradesCount;
        uint256 lastTradeAt;
    }
    
    /**
     * @notice Trade intent for EIP-712 signing
     * @param agentId Agent token ID
     * @param token Token to trade
     * @param isBuy True for buy, false for sell
     * @param amount Amount to trade
     * @param minAmountOut Minimum amount out (slippage)
     * @param deadline Signature deadline
     * @param nonce Unique nonce
     */
    struct TradeIntent {
        uint256 agentId;
        address token;
        bool isBuy;
        uint256 amount;
        uint256 minAmountOut;
        uint256 deadline;
        uint256 nonce;
    }
    
    /**
     * @notice Trade execution record
     * @param agentId Agent that executed
     * @param token Token traded
     * @param isBuy True for buy, false for sell
     * @param amountIn Amount spent
     * @param amountOut Amount received
     * @param executedAt Execution timestamp
     * @param intentHash Hash of trade intent
     */
    struct TradeRecord {
        uint256 agentId;
        address token;
        bool isBuy;
        uint256 amountIn;
        uint256 amountOut;
        uint256 executedAt;
        bytes32 intentHash;
    }

    // ============================================
    // CONSTANTS
    // ============================================
    
    /// @notice EIP-712 typehash for TradeIntent
    bytes32 public constant TRADE_INTENT_TYPEHASH = keccak256(
        "TradeIntent(uint256 agentId,address token,bool isBuy,uint256 amount,uint256 minAmountOut,uint256 deadline,uint256 nonce)"
    );
    
    /// @notice Basis points denominator
    uint256 public constant BASIS_POINTS = 10000;
    
    /// @notice Minimum lockup period
    uint256 public constant MIN_LOCKUP = 1 days;
    
    /// @notice Maximum lockup period
    uint256 public constant MAX_LOCKUP = 365 days;
    
    /// @notice Protocol fee (basis points) - configurable
    uint256 public protocolFeeBps; // Set via setProtocolFee(), starts at 0

    // ============================================
    // STATE VARIABLES
    // ============================================
    
    /// @notice ERC-8004 Identity Registry
    address public immutable identityRegistry;
    
    /// @notice ERC-8004 Reputation Registry
    address public immutable reputationRegistry;
    
    /// @notice ERC-8004 Validation Registry
    address public immutable validationRegistry;
    
    /// @notice DEX Router for trade execution
    address public dexRouter;
    
    /// @notice Wrapped native token (WMON on Monad)
    address public immutable wrappedNative;
    
    /// @notice Stablecoin for accounting (aUSD or USDC)
    address public stablecoin;
    
    /// @notice Protocol treasury
    address public treasury;
    
    /// @notice Capital delegations by agent ID
    mapping(uint256 => CapitalDelegation[]) private _delegations;
    
    /// @notice Agent positions by agent ID
    mapping(uint256 => AgentPosition) private _positions;
    
    /// @notice Trade records by agent ID
    mapping(uint256 => TradeRecord[]) private _tradeHistory;
    
    /// @notice Nonces for replay protection
    mapping(address => uint256) public nonces;
    
    /// @notice Allowed tokens for trading
    mapping(address => bool) public allowedTokens;
    
    /// @notice Default risk parameters
    RiskParameters public defaultRiskParams;
    
    /// @notice Total protocol TVL
    uint256 public totalTVL;
    
    /// @notice Total fees collected
    uint256 public totalFeesCollected;

    // ============================================
    // EVENTS
    // ============================================
    
    event CapitalDelegated(
        uint256 indexed agentId,
        address indexed delegator,
        uint256 amount,
        uint256 lockupEndsAt
    );
    
    event CapitalWithdrawn(
        uint256 indexed agentId,
        address indexed delegator,
        uint256 amount
    );
    
    event TradeExecuted(
        uint256 indexed agentId,
        address indexed token,
        bool isBuy,
        uint256 amountIn,
        uint256 amountOut,
        bytes32 intentHash
    );
    
    event PnLRealized(
        uint256 indexed agentId,
        int256 pnlAmount,
        uint256 timestamp
    );
    
    event RiskParametersUpdated(
        uint256 indexed agentId,
        uint256 delegationIndex,
        RiskParameters params
    );
    
    event DailyLossLimitReached(
        uint256 indexed agentId,
        uint256 todayLoss,
        uint256 limit
    );
    
    event TokenAllowanceUpdated(
        address indexed token,
        bool allowed
    );
    
    event ProtocolFeeUpdated(
        uint256 feeBps
    );

    // ============================================
    // ERRORS
    // ============================================
    
    error AgentNotFound(uint256 agentId);
    error InvalidAmount();
    error InsufficientCapital(uint256 available, uint256 required);
    error DailyLossLimitExceeded(uint256 todayLoss, uint256 limit);
    error PositionSizeLimitExceeded(uint256 position, uint256 limit);
    error CooldownNotMet(uint256 timeRemaining);
    error LockupNotEnded(uint256 endsAt);
    error InvalidSignature();
    error SignatureExpired();
    error TokenNotAllowed(address token);
    error ValidationRequired(uint256 agentId);
    error NotAgentOwnerOrOperator(address caller, uint256 agentId);
    error SlippageExceeded(uint256 received, uint256 minimum);

    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    /**
     * @notice Initialize the ANOA Trustless Agent Core
     * @param identityRegistry_ ERC-8004 Identity Registry
     * @param reputationRegistry_ ERC-8004 Reputation Registry
     * @param validationRegistry_ ERC-8004 Validation Registry
     * @param dexRouter_ DEX Router for trades
     * @param wrappedNative_ Wrapped native token
     * @param stablecoin_ Stablecoin for accounting
     * @param treasury_ Protocol treasury
     */
    constructor(
        address identityRegistry_,
        address reputationRegistry_,
        address validationRegistry_,
        address dexRouter_,
        address wrappedNative_,
        address stablecoin_,
        address treasury_
    ) Ownable(msg.sender) EIP712("AnoaTrustlessAgent", "1") {
        require(identityRegistry_ != address(0), "Invalid identity registry");
        require(reputationRegistry_ != address(0), "Invalid reputation registry");
        require(validationRegistry_ != address(0), "Invalid validation registry");
        
        identityRegistry = identityRegistry_;
        reputationRegistry = reputationRegistry_;
        validationRegistry = validationRegistry_;
        dexRouter = dexRouter_;
        wrappedNative = wrappedNative_;
        stablecoin = stablecoin_;
        treasury = treasury_ != address(0) ? treasury_ : msg.sender;
        
        // Set default risk parameters
        defaultRiskParams = RiskParameters({
            maxPositionSize: 10000 * 1e18, // 10k stablecoins
            maxLeverage: 30000, // 3x
            dailyLossLimit: 1000 * 1e18, // 1k stablecoins
            allowedMarkets: type(uint256).max, // All markets
            cooldownPeriod: 0, // No cooldown
            requireValidation: false
        });
    }

    // ============================================
    // CAPITAL DELEGATION
    // ============================================
    
    /**
     * @notice Delegate capital to an AI agent
     * @param agentId Agent token ID to delegate to
     * @param lockupDays Number of days to lock capital
     * @param customRiskParams Custom risk parameters (optional)
     */
    function delegateCapital(
        uint256 agentId,
        uint256 lockupDays,
        RiskParameters calldata customRiskParams
    ) external payable nonReentrant whenNotPaused {
        if (msg.value == 0) revert InvalidAmount();
        
        uint256 lockupPeriod = lockupDays * 1 days;
        if (lockupPeriod < MIN_LOCKUP) lockupPeriod = MIN_LOCKUP;
        if (lockupPeriod > MAX_LOCKUP) lockupPeriod = MAX_LOCKUP;
        
        RiskParameters memory params;
        if (customRiskParams.maxPositionSize > 0) {
            params = customRiskParams;
        } else {
            // Copy storage to memory
            params = RiskParameters({
                maxPositionSize: defaultRiskParams.maxPositionSize,
                maxLeverage: defaultRiskParams.maxLeverage,
                dailyLossLimit: defaultRiskParams.dailyLossLimit,
                allowedMarkets: defaultRiskParams.allowedMarkets,
                cooldownPeriod: defaultRiskParams.cooldownPeriod,
                requireValidation: defaultRiskParams.requireValidation
            });
        }
        
        CapitalDelegation memory delegation = CapitalDelegation({
            delegator: msg.sender,
            amount: msg.value,
            depositedAt: block.timestamp,
            lockupEndsAt: block.timestamp + lockupPeriod,
            riskParams: params,
            isActive: true
        });
        
        _delegations[agentId].push(delegation);
        _positions[agentId].totalCapital += msg.value;
        totalTVL += msg.value;
        
        emit CapitalDelegated(agentId, msg.sender, msg.value, delegation.lockupEndsAt);
    }
    
    /**
     * @notice Withdraw delegated capital
     * @param agentId Agent token ID
     * @param delegationIndex Index of delegation to withdraw
     */
    function withdrawCapital(
        uint256 agentId,
        uint256 delegationIndex
    ) external nonReentrant {
        CapitalDelegation storage delegation = _delegations[agentId][delegationIndex];
        
        require(delegation.delegator == msg.sender, "Not delegator");
        require(delegation.isActive, "Already withdrawn");
        
        if (block.timestamp < delegation.lockupEndsAt) {
            revert LockupNotEnded(delegation.lockupEndsAt);
        }
        
        uint256 amount = delegation.amount;
        
        // Calculate proportional PnL
        int256 agentPnL = _positions[agentId].realizedPnL;
        uint256 totalCap = _positions[agentId].totalCapital;
        
        if (totalCap > 0 && agentPnL != 0) {
            int256 share = (agentPnL * int256(amount)) / int256(totalCap);
            if (share > 0) {
                amount += uint256(share);
            } else if (share < 0 && uint256(-share) < amount) {
                amount -= uint256(-share);
            }
        }
        
        delegation.isActive = false;
        _positions[agentId].totalCapital -= delegation.amount;
        totalTVL -= delegation.amount;
        
        (bool success,) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
        
        emit CapitalWithdrawn(agentId, msg.sender, amount);
    }

    // ============================================
    // TRADE EXECUTION
    // ============================================
    
    /**
     * @notice Execute a buy trade with signed intent
     * @param intent TradeIntent struct
     * @param signature EIP-712 signature
     */
    function executeBuy(
        TradeIntent calldata intent,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        _verifyAndExecuteTrade(intent, signature, true);
    }
    
    /**
     * @notice Execute a sell trade with signed intent
     * @param intent TradeIntent struct
     * @param signature EIP-712 signature
     */
    function executeSell(
        TradeIntent calldata intent,
        bytes calldata signature
    ) external nonReentrant whenNotPaused {
        _verifyAndExecuteTrade(intent, signature, false);
    }
    
    /**
     * @notice Internal trade verification and execution
     */
    function _verifyAndExecuteTrade(
        TradeIntent calldata intent,
        bytes calldata signature,
        bool isBuy
    ) internal {
        // Verify signature
        bytes32 structHash = keccak256(abi.encode(
            TRADE_INTENT_TYPEHASH,
            intent.agentId,
            intent.token,
            intent.isBuy,
            intent.amount,
            intent.minAmountOut,
            intent.deadline,
            intent.nonce
        ));

        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);

        // Verify signer is agent owner/operator
        if (!_isAgentOwnerOrOperator(signer, intent.agentId)) {
            revert NotAgentOwnerOrOperator(signer, intent.agentId);
        }

        // Verify deadline
        if (block.timestamp > intent.deadline) {
            revert SignatureExpired();
        }

        // Verify and consume nonce (replay protection)
        require(intent.nonce == nonces[signer], "Invalid nonce");
        nonces[signer]++;
        
        // Verify token allowed
        if (!allowedTokens[intent.token]) {
            revert TokenNotAllowed(intent.token);
        }
        
        // Check risk parameters
        _checkRiskParameters(intent.agentId, intent.amount);
        
        // Execute trade via DEX
        uint256 amountOut = _executeDexTrade(
            intent.token,
            intent.amount,
            intent.minAmountOut,
            isBuy
        );
        
        // Update position
        AgentPosition storage position = _positions[intent.agentId];
        position.tradesCount++;
        position.lastTradeAt = block.timestamp;
        
        if (isBuy) {
            position.usedCapital += intent.amount;
        } else {
            if (position.usedCapital >= intent.amount) {
                position.usedCapital -= intent.amount;
            }
        }
        
        // Record trade
        bytes32 intentHash = keccak256(abi.encode(intent));
        _tradeHistory[intent.agentId].push(TradeRecord({
            agentId: intent.agentId,
            token: intent.token,
            isBuy: isBuy,
            amountIn: intent.amount,
            amountOut: amountOut,
            executedAt: block.timestamp,
            intentHash: intentHash
        }));
        
        emit TradeExecuted(
            intent.agentId,
            intent.token,
            isBuy,
            intent.amount,
            amountOut,
            intentHash
        );
    }
    
    /**
     * @notice Check risk parameters before trade
     */
    function _checkRiskParameters(uint256 agentId, uint256 amount) internal {
        AgentPosition storage position = _positions[agentId];
        
        // Reset daily loss if new day
        uint256 today = block.timestamp / 1 days;
        if (position.lastResetDay < today) {
            position.todayLoss = 0;
            position.lastResetDay = today;
        }
        
        // Get effective risk params
        RiskParameters memory params = defaultRiskParams;
        if (_delegations[agentId].length > 0) {
            params = _delegations[agentId][0].riskParams;
        }
        
        // Check position size
        if (position.usedCapital + amount > params.maxPositionSize) {
            revert PositionSizeLimitExceeded(position.usedCapital + amount, params.maxPositionSize);
        }
        
        // Check daily loss
        if (position.todayLoss >= params.dailyLossLimit) {
            revert DailyLossLimitExceeded(position.todayLoss, params.dailyLossLimit);
        }
        
        // Check cooldown
        if (params.cooldownPeriod > 0 && 
            block.timestamp < position.lastTradeAt + params.cooldownPeriod) {
            revert CooldownNotMet(position.lastTradeAt + params.cooldownPeriod - block.timestamp);
        }
        
        // Check capital
        uint256 availableCapital = position.totalCapital - position.usedCapital;
        if (amount > availableCapital) {
            revert InsufficientCapital(availableCapital, amount);
        }
    }
    
    /**
     * @notice Execute trade via nad.fun bonding curve router
     * @dev Routes buy/sell through the configured dexRouter (Bonding Curve Router).
     *      BuyParams struct: (uint256 amountOutMin, address token, address to, uint256 deadline)
     *      SellParams struct: (uint256 amountIn, uint256 amountOutMin, address token, address to, uint256 deadline)
     *      See documents/trading.md for full ABI reference.
     */
    function _executeDexTrade(
        address token,
        uint256 amountIn,
        uint256 minAmountOut,
        bool isBuy
    ) internal returns (uint256 amountOut) {
        if (dexRouter == address(0)) revert("DEX router not configured");

        uint256 deadline = block.timestamp + 300; // 5 minute deadline

        if (isBuy) {
            // Buy tokens with native MON via bonding curve router
            // Router.buy(BuyParams) where BuyParams = (amountOutMin, token, to, deadline)
            (bool success, bytes memory returnData) = dexRouter.call{value: amountIn}(
                abi.encodeWithSignature(
                    "buy((uint256,address,address,uint256))",
                    minAmountOut,
                    token,
                    address(this),
                    deadline
                )
            );
            require(success, "Buy execution failed");
            amountOut = abi.decode(returnData, (uint256));
        } else {
            // Sell tokens for native MON
            // First approve the router to spend our tokens
            IERC20(token).safeIncreaseAllowance(dexRouter, amountIn);

            // Router.sell(SellParams) where SellParams = (amountIn, amountOutMin, token, to, deadline)
            (bool success, bytes memory returnData) = dexRouter.call(
                abi.encodeWithSignature(
                    "sell((uint256,uint256,address,address,uint256))",
                    amountIn,
                    minAmountOut,
                    token,
                    address(this),
                    deadline
                )
            );
            require(success, "Sell execution failed");
            amountOut = abi.decode(returnData, (uint256));
        }

        if (amountOut < minAmountOut) {
            revert SlippageExceeded(amountOut, minAmountOut);
        }

        // Collect protocol fee (if configured)
        uint256 fee = (amountOut * protocolFeeBps) / BASIS_POINTS;
        if (fee > 0) {
            totalFeesCollected += fee;
            if (treasury != address(0)) {
                if (isBuy) {
                    // Fee in tokens — transfer tokens to treasury
                    IERC20(token).safeTransfer(treasury, fee);
                } else {
                    // Fee in native MON — transfer MON to treasury
                    (bool sent, ) = treasury.call{value: fee}("");
                    require(sent, "Fee transfer failed");
                }
            }
        }

        return amountOut - fee;
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    /**
     * @notice Get agent position
     * @param agentId Agent token ID
     * @return AgentPosition struct
     */
    function getPosition(uint256 agentId) external view returns (AgentPosition memory) {
        return _positions[agentId];
    }
    
    /**
     * @notice Get delegations for an agent
     * @param agentId Agent token ID
     * @return Array of CapitalDelegation structs
     */
    function getDelegations(uint256 agentId) external view returns (CapitalDelegation[] memory) {
        return _delegations[agentId];
    }
    
    /**
     * @notice Get trade history for an agent
     * @param agentId Agent token ID
     * @return Array of TradeRecord structs
     */
    function getTradeHistory(uint256 agentId) external view returns (TradeRecord[] memory) {
        return _tradeHistory[agentId];
    }
    
    /**
     * @notice Get available capital for an agent
     * @param agentId Agent token ID
     * @return Available capital amount
     */
    function getAvailableCapital(uint256 agentId) external view returns (uint256) {
        AgentPosition memory position = _positions[agentId];
        return position.totalCapital - position.usedCapital;
    }
    
    /**
     * @notice Get EIP-712 domain separator
     */
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================
    
    /**
     * @notice Set allowed token
     * @param token Token address
     * @param allowed Whether allowed
     */
    function setAllowedToken(address token, bool allowed) external onlyOwner {
        allowedTokens[token] = allowed;
        emit TokenAllowanceUpdated(token, allowed);
    }
    
    /**
     * @notice Set protocol fee (for backend/frontend configuration)
     * @param feeBps Fee in basis points (e.g., 30 = 0.3%)
     */
    function setProtocolFee(uint256 feeBps) external onlyOwner {
        require(feeBps <= 1000, "Fee too high"); // Max 10%
        protocolFeeBps = feeBps;
        emit ProtocolFeeUpdated(feeBps);
    }
    
    /**
     * @notice Update default risk parameters
     * @param params New default parameters
     */
    function setDefaultRiskParams(RiskParameters calldata params) external onlyOwner {
        defaultRiskParams = params;
    }
    
    /**
     * @notice Update DEX router
     * @param newRouter New router address
     */
    function setDexRouter(address newRouter) external onlyOwner {
        require(newRouter != address(0), "Invalid router");
        dexRouter = newRouter;
    }
    
    /**
     * @notice Update stablecoin
     * @param newStablecoin New stablecoin address
     */
    function setStablecoin(address newStablecoin) external onlyOwner {
        require(newStablecoin != address(0), "Invalid stablecoin");
        stablecoin = newStablecoin;
    }
    
    /**
     * @notice Update treasury
     * @param newTreasury New treasury address
     */
    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        treasury = newTreasury;
    }
    
    /**
     * @notice Withdraw collected protocol fees only (not user capital)
     */
    function withdrawFees() external onlyOwner {
        uint256 fees = totalFeesCollected;
        require(fees > 0, "No fees");
        totalFeesCollected = 0;
        (bool success,) = payable(treasury).call{value: fees}("");
        require(success, "Transfer failed");
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
    // INTERNAL FUNCTIONS
    // ============================================
    
    /**
     * @notice Check if address is agent owner or operator
     * @dev Calls Identity Registry to verify ownership or ERC-721 approval
     */
    function _isAgentOwnerOrOperator(address account, uint256 agentId) internal view returns (bool) {
        // Check ownerOf(agentId)
        (bool success, bytes memory data) = identityRegistry.staticcall(
            abi.encodeWithSignature("ownerOf(uint256)", agentId)
        );

        if (success && data.length >= 32) {
            address owner = abi.decode(data, (address));
            if (owner == account) return true;

            // Check if account is approved for this specific token
            (bool approvedSuccess, bytes memory approvedData) = identityRegistry.staticcall(
                abi.encodeWithSignature("getApproved(uint256)", agentId)
            );
            if (approvedSuccess && approvedData.length >= 32) {
                address approved = abi.decode(approvedData, (address));
                if (approved == account) return true;
            }

            // Check if account is approved-for-all by the owner
            (bool operatorSuccess, bytes memory operatorData) = identityRegistry.staticcall(
                abi.encodeWithSignature("isApprovedForAll(address,address)", owner, account)
            );
            if (operatorSuccess && operatorData.length >= 32) {
                bool isApproved = abi.decode(operatorData, (bool));
                if (isApproved) return true;
            }
        }

        return false;
    }
    
    /**
     * @notice Receive native token
     */
    receive() external payable {}
}
