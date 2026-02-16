---
name: solidity-erc8004
description: Expert-level Solidity development for ERC-8004 AI Agent standard, smart contracts, DeFi protocols, and blockchain integration. Use when building AI agents with on-chain capital access, verifiable trust systems, autonomous strategies, or any Ethereum/EVM smart contract development.
---

# Solidity & ERC-8004 AI Agent Development

## ERC-8004 Standard Overview

ERC-8004 is the standard for AI Agents that can:
- Access and manage on-chain capital
- Execute autonomous strategies
- Build verifiable trust through on-chain reputation
- Interact with DeFi protocols

## Core ERC-8004 Interface

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC8004 {
    /// @notice Emitted when an agent is registered
    event AgentRegistered(address indexed agent, bytes32 indexed agentId, string metadata);
    
    /// @notice Emitted when agent executes a strategy
    event StrategyExecuted(bytes32 indexed agentId, bytes32 strategyHash, uint256 timestamp);
    
    /// @notice Emitted when trust score is updated
    event TrustUpdated(bytes32 indexed agentId, uint256 newScore, string reason);
    
    /// @notice Register a new AI agent
    function registerAgent(string calldata metadata) external returns (bytes32 agentId);
    
    /// @notice Execute an on-chain strategy
    function executeStrategy(bytes32 agentId, bytes calldata strategyData) external payable;
    
    /// @notice Get agent's trust score
    function getTrustScore(bytes32 agentId) external view returns (uint256);
    
    /// @notice Delegate capital to an agent
    function delegateCapital(bytes32 agentId, uint256 amount) external;
    
    /// @notice Withdraw delegated capital
    function withdrawCapital(bytes32 agentId, uint256 amount) external;
}
```

## Full ERC-8004 Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract ERC8004AgentRegistry is ReentrancyGuard, AccessControl, Pausable {
    using SafeERC20 for IERC20;
    
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    
    struct Agent {
        address owner;
        string metadata;
        uint256 trustScore;
        uint256 totalCapital;
        uint256 successfulStrategies;
        uint256 totalStrategies;
        uint256 registrationTime;
        bool isActive;
    }
    
    struct Strategy {
        bytes32 agentId;
        bytes32 strategyHash;
        uint256 timestamp;
        uint256 capitalUsed;
        int256 pnl;
        bool completed;
    }
    
    mapping(bytes32 => Agent) public agents;
    mapping(bytes32 => Strategy[]) public agentStrategies;
    mapping(bytes32 => mapping(address => uint256)) public delegatedCapital;
    mapping(address => bytes32[]) public ownerAgents;
    
    uint256 public constant INITIAL_TRUST_SCORE = 100;
    uint256 public constant MAX_TRUST_SCORE = 1000;
    uint256 public agentCount;
    
    event AgentRegistered(address indexed owner, bytes32 indexed agentId, string metadata);
    event StrategyExecuted(bytes32 indexed agentId, bytes32 strategyHash, int256 pnl);
    event TrustUpdated(bytes32 indexed agentId, uint256 oldScore, uint256 newScore);
    event CapitalDelegated(bytes32 indexed agentId, address indexed delegator, uint256 amount);
    event CapitalWithdrawn(bytes32 indexed agentId, address indexed delegator, uint256 amount);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }
    
    function registerAgent(string calldata metadata) external whenNotPaused returns (bytes32) {
        bytes32 agentId = keccak256(abi.encodePacked(msg.sender, block.timestamp, agentCount));
        
        agents[agentId] = Agent({
            owner: msg.sender,
            metadata: metadata,
            trustScore: INITIAL_TRUST_SCORE,
            totalCapital: 0,
            successfulStrategies: 0,
            totalStrategies: 0,
            registrationTime: block.timestamp,
            isActive: true
        });
        
        ownerAgents[msg.sender].push(agentId);
        agentCount++;
        
        emit AgentRegistered(msg.sender, agentId, metadata);
        return agentId;
    }
    
    function executeStrategy(
        bytes32 agentId,
        bytes calldata strategyData,
        uint256 capitalAmount
    ) external nonReentrant whenNotPaused {
        Agent storage agent = agents[agentId];
        require(agent.isActive, "Agent not active");
        require(msg.sender == agent.owner || hasRole(OPERATOR_ROLE, msg.sender), "Unauthorized");
        require(capitalAmount <= agent.totalCapital, "Insufficient capital");
        
        bytes32 strategyHash = keccak256(strategyData);
        
        // Execute strategy logic here
        // This would integrate with DeFi protocols
        
        agent.totalStrategies++;
        
        agentStrategies[agentId].push(Strategy({
            agentId: agentId,
            strategyHash: strategyHash,
            timestamp: block.timestamp,
            capitalUsed: capitalAmount,
            pnl: 0,
            completed: false
        }));
        
        emit StrategyExecuted(agentId, strategyHash, 0);
    }
    
    function updateTrustScore(bytes32 agentId, int256 adjustment) external onlyRole(AUDITOR_ROLE) {
        Agent storage agent = agents[agentId];
        uint256 oldScore = agent.trustScore;
        
        if (adjustment > 0) {
            agent.trustScore = min(agent.trustScore + uint256(adjustment), MAX_TRUST_SCORE);
        } else {
            uint256 decrease = uint256(-adjustment);
            agent.trustScore = decrease >= agent.trustScore ? 0 : agent.trustScore - decrease;
        }
        
        emit TrustUpdated(agentId, oldScore, agent.trustScore);
    }
    
    function delegateCapital(bytes32 agentId, uint256 amount) external payable nonReentrant {
        require(agents[agentId].isActive, "Agent not active");
        require(msg.value == amount, "Value mismatch");
        
        agents[agentId].totalCapital += amount;
        delegatedCapital[agentId][msg.sender] += amount;
        
        emit CapitalDelegated(agentId, msg.sender, amount);
    }
    
    function withdrawCapital(bytes32 agentId, uint256 amount) external nonReentrant {
        require(delegatedCapital[agentId][msg.sender] >= amount, "Insufficient delegated capital");
        
        delegatedCapital[agentId][msg.sender] -= amount;
        agents[agentId].totalCapital -= amount;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit CapitalWithdrawn(agentId, msg.sender, amount);
    }
    
    function getTrustScore(bytes32 agentId) external view returns (uint256) {
        return agents[agentId].trustScore;
    }
    
    function getAgentStats(bytes32 agentId) external view returns (
        uint256 trustScore,
        uint256 totalCapital,
        uint256 successRate,
        uint256 totalStrategies
    ) {
        Agent storage agent = agents[agentId];
        return (
            agent.trustScore,
            agent.totalCapital,
            agent.totalStrategies > 0 ? (agent.successfulStrategies * 100) / agent.totalStrategies : 0,
            agent.totalStrategies
        );
    }
    
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
```

## Agent Strategy Executor

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

contract AgentStrategyExecutor {
    ISwapRouter public immutable swapRouter;
    
    struct SwapParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        uint256 amountIn;
        uint256 minAmountOut;
    }
    
    constructor(address _swapRouter) {
        swapRouter = ISwapRouter(_swapRouter);
    }
    
    function executeSwap(SwapParams calldata params) external returns (uint256 amountOut) {
        IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
        IERC20(params.tokenIn).approve(address(swapRouter), params.amountIn);
        
        ISwapRouter.ExactInputSingleParams memory swapParams = ISwapRouter.ExactInputSingleParams({
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            fee: params.fee,
            recipient: msg.sender,
            deadline: block.timestamp + 300,
            amountIn: params.amountIn,
            amountOutMinimum: params.minAmountOut,
            sqrtPriceLimitX96: 0
        });
        
        amountOut = swapRouter.exactInputSingle(swapParams);
    }
    
    function executeBatchSwaps(SwapParams[] calldata swaps) external returns (uint256[] memory amounts) {
        amounts = new uint256[](swaps.length);
        for (uint256 i = 0; i < swaps.length; i++) {
            amounts[i] = this.executeSwap(swaps[i]);
        }
    }
}
```

## Best Practices

### Security Patterns
1. Always use ReentrancyGuard for functions handling ETH/tokens
2. Use SafeERC20 for token transfers
3. Implement access control with OpenZeppelin's AccessControl
4. Add Pausable for emergency stops
5. Use check-effects-interactions pattern

### Gas Optimization
1. Use `calldata` for read-only array parameters
2. Cache storage variables in memory
3. Use unchecked blocks for safe math operations
4. Pack struct variables efficiently
5. Use events instead of storage for historical data

### Testing Requirements
- Unit tests for all functions
- Integration tests with forked mainnet
- Fuzz testing for edge cases
- Invariant testing for protocol properties

## Development Setup

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Initialize project
forge init ai-agent-contracts
cd ai-agent-contracts

# Install dependencies
forge install OpenZeppelin/openzeppelin-contracts
forge install Uniswap/v3-periphery

# Compile
forge build

# Test
forge test -vvv

# Deploy
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

## Deployment Script

```solidity
// script/Deploy.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/ERC8004AgentRegistry.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        ERC8004AgentRegistry registry = new ERC8004AgentRegistry();
        
        console.log("Registry deployed at:", address(registry));
        
        vm.stopBroadcast();
    }
}
```
