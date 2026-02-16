---
name: smart-contract-security
description: Smart contract security patterns, vulnerability prevention, auditing techniques, and secure development practices. Use when developing, reviewing, or auditing Solidity smart contracts to prevent exploits and ensure code safety.
---

# Smart Contract Security

## Common Vulnerabilities & Prevention

### 1. Reentrancy Attack

```solidity
// ❌ VULNERABLE
contract VulnerableVault {
    mapping(address => uint256) public balances;
    
    function withdraw() external {
        uint256 amount = balances[msg.sender];
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success);
        balances[msg.sender] = 0; // State update AFTER external call
    }
}

// ✅ SECURE - Checks-Effects-Interactions Pattern
contract SecureVault {
    mapping(address => uint256) public balances;
    
    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance");
        
        // Effect: Update state BEFORE external call
        balances[msg.sender] = 0;
        
        // Interaction: External call AFTER state update
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }
}

// ✅ SECURE - Using ReentrancyGuard
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract SecureVaultWithGuard is ReentrancyGuard {
    mapping(address => uint256) public balances;
    
    function withdraw() external nonReentrant {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance");
        balances[msg.sender] = 0;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }
}
```

### 2. Integer Overflow/Underflow

```solidity
// ❌ VULNERABLE (Solidity < 0.8.0)
contract VulnerableToken {
    mapping(address => uint256) public balances;
    
    function transfer(address to, uint256 amount) external {
        balances[msg.sender] -= amount; // Can underflow!
        balances[to] += amount; // Can overflow!
    }
}

// ✅ SECURE - Solidity 0.8+ has built-in checks
// Or use SafeMath for older versions
contract SecureToken {
    mapping(address => uint256) public balances;
    
    function transfer(address to, uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        unchecked {
            // Use unchecked only when overflow is impossible
            balances[msg.sender] -= amount;
        }
        balances[to] += amount;
    }
}
```

### 3. Access Control

```solidity
// ❌ VULNERABLE - Missing access control
contract VulnerableAgent {
    address public owner;
    uint256 public funds;
    
    function setOwner(address newOwner) external {
        owner = newOwner; // Anyone can call!
    }
    
    function withdrawFunds() external {
        payable(owner).transfer(funds);
    }
}

// ✅ SECURE - Proper access control
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SecureAgent is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant WITHDRAWER_ROLE = keccak256("WITHDRAWER_ROLE");
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }
    
    function executeStrategy(bytes calldata data) external onlyRole(OPERATOR_ROLE) {
        // Only operators can execute
    }
    
    function withdrawFunds(address to, uint256 amount) external onlyRole(WITHDRAWER_ROLE) {
        // Only withdrawers can withdraw
    }
    
    function emergencyPause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        // Only admin can pause
    }
}
```

### 4. Front-Running Protection

```solidity
// ❌ VULNERABLE to front-running
contract VulnerableSwap {
    function swap(uint256 amountIn, uint256 minAmountOut) external {
        // Attacker can see this tx in mempool and front-run
        uint256 amountOut = calculateOutput(amountIn);
        require(amountOut >= minAmountOut, "Slippage");
        // ...
    }
}

// ✅ SECURE - Commit-Reveal Pattern
contract SecureSwap {
    struct Commitment {
        bytes32 hash;
        uint256 timestamp;
        bool revealed;
    }
    
    mapping(address => Commitment) public commitments;
    uint256 public constant REVEAL_DELAY = 2; // blocks
    
    function commit(bytes32 hash) external {
        commitments[msg.sender] = Commitment({
            hash: hash,
            timestamp: block.number,
            revealed: false
        });
    }
    
    function reveal(
        uint256 amountIn,
        uint256 minAmountOut,
        bytes32 secret
    ) external {
        Commitment storage c = commitments[msg.sender];
        require(!c.revealed, "Already revealed");
        require(block.number >= c.timestamp + REVEAL_DELAY, "Too early");
        require(
            keccak256(abi.encodePacked(amountIn, minAmountOut, secret)) == c.hash,
            "Invalid reveal"
        );
        
        c.revealed = true;
        _executeSwap(msg.sender, amountIn, minAmountOut);
    }
}

// ✅ SECURE - Deadline and slippage protection
contract SecureSwapWithDeadline {
    function swap(
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external {
        require(block.timestamp <= deadline, "Expired");
        
        uint256 amountOut = calculateOutput(amountIn);
        require(amountOut >= minAmountOut, "Slippage exceeded");
        // ...
    }
}
```

### 5. Oracle Manipulation

```solidity
// ❌ VULNERABLE - Spot price manipulation
contract VulnerableLending {
    IUniswapV2Pair public pair;
    
    function getPrice() public view returns (uint256) {
        (uint112 reserve0, uint112 reserve1, ) = pair.getReserves();
        return (reserve1 * 1e18) / reserve0; // Easily manipulated with flash loans
    }
    
    function liquidate(address user) external {
        uint256 price = getPrice();
        // Attacker can manipulate price to liquidate anyone
    }
}

// ✅ SECURE - Use TWAP or Chainlink
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract SecureLending {
    AggregatorV3Interface public priceFeed;
    uint256 public constant PRICE_STALENESS = 1 hours;
    
    constructor(address _priceFeed) {
        priceFeed = AggregatorV3Interface(_priceFeed);
    }
    
    function getPrice() public view returns (uint256) {
        (
            uint80 roundId,
            int256 price,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();
        
        require(price > 0, "Invalid price");
        require(updatedAt >= block.timestamp - PRICE_STALENESS, "Stale price");
        require(answeredInRound >= roundId, "Stale round");
        
        return uint256(price);
    }
}
```

### 6. Flash Loan Attacks

```solidity
// ✅ SECURE - Protect against flash loans
contract FlashLoanProtected {
    mapping(address => uint256) public lastActionBlock;
    
    modifier noFlashLoan() {
        require(
            lastActionBlock[msg.sender] < block.number,
            "Flash loan detected"
        );
        lastActionBlock[msg.sender] = block.number;
        _;
    }
    
    function deposit() external noFlashLoan {
        // Protected from same-block manipulation
    }
    
    function borrow() external noFlashLoan {
        // Protected from same-block manipulation
    }
}
```

### 7. Signature Replay

```solidity
// ❌ VULNERABLE - Signature can be replayed
contract VulnerablePermit {
    function executeWithSignature(
        address user,
        uint256 amount,
        bytes memory signature
    ) external {
        bytes32 hash = keccak256(abi.encodePacked(user, amount));
        address signer = recoverSigner(hash, signature);
        require(signer == user, "Invalid signature");
        // Execute... (same signature can be used again!)
    }
}

// ✅ SECURE - Include nonce and chain ID
contract SecurePermit {
    mapping(address => uint256) public nonces;
    
    bytes32 public constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    
    bytes32 public constant PERMIT_TYPEHASH = keccak256(
        "Permit(address user,uint256 amount,uint256 nonce,uint256 deadline)"
    );
    
    function executeWithSignature(
        address user,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(block.timestamp <= deadline, "Expired");
        
        bytes32 structHash = keccak256(
            abi.encode(PERMIT_TYPEHASH, user, amount, nonces[user]++, deadline)
        );
        
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash)
        );
        
        address signer = ecrecover(digest, v, r, s);
        require(signer == user, "Invalid signature");
        
        // Execute...
    }
    
    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256("SecurePermit"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }
}
```

## Security Checklist

### Before Deployment
- [ ] All functions have proper access control
- [ ] External calls follow checks-effects-interactions
- [ ] ReentrancyGuard on all external state-changing functions
- [ ] No unprotected selfdestruct
- [ ] No unbounded loops
- [ ] No block.timestamp manipulation risks
- [ ] No tx.origin for authentication
- [ ] Proper input validation
- [ ] Events emitted for all state changes
- [ ] Pausable mechanism for emergencies
- [ ] Upgrade mechanism if needed
- [ ] All tests passing with 100% coverage

### Audit Process
1. **Automated Analysis**
   - Run Slither for vulnerability detection
   - Run Mythril for symbolic execution
   - Run Echidna for fuzzing

2. **Manual Review**
   - Review all external calls
   - Check access control
   - Verify math operations
   - Review token handling

3. **Test Coverage**
   - Unit tests for all functions
   - Integration tests
   - Fuzz tests
   - Invariant tests

## Testing Tools

```bash
# Slither - Static analysis
pip install slither-analyzer
slither . --config-file slither.config.json

# Mythril - Symbolic execution
pip install mythril
myth analyze contracts/MyContract.sol

# Echidna - Fuzzing
echidna-test . --contract MyContract --config echidna.yaml
```

```yaml
# echidna.yaml
testMode: assertion
testLimit: 50000
seqLen: 100
deployer: "0x1000000000000000000000000000000000000000"
sender: ["0x2000000000000000000000000000000000000000"]
```

## Invariant Testing (Foundry)

```solidity
// test/invariants/AgentInvariant.t.sol
contract AgentInvariant is Test {
    AgentRegistry public registry;
    AgentHandler public handler;
    
    function setUp() public {
        registry = new AgentRegistry();
        handler = new AgentHandler(registry);
        
        targetContract(address(handler));
    }
    
    // Trust score should never exceed max
    function invariant_trustScoreMax() public {
        bytes32[] memory agents = registry.getAllAgents();
        for (uint i = 0; i < agents.length; i++) {
            uint256 score = registry.getTrustScore(agents[i]);
            assertLe(score, registry.MAX_TRUST_SCORE());
        }
    }
    
    // Total delegated capital should match sum of individual delegations
    function invariant_capitalAccounting() public {
        bytes32[] memory agents = registry.getAllAgents();
        for (uint i = 0; i < agents.length; i++) {
            uint256 reportedCapital = registry.getTotalCapital(agents[i]);
            uint256 summedCapital = sumDelegations(agents[i]);
            assertEq(reportedCapital, summedCapital);
        }
    }
}
```
