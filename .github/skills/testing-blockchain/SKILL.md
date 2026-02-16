---
name: testing-blockchain
description: Comprehensive testing for blockchain applications including smart contract testing with Foundry/Hardhat, frontend testing with Vitest/Jest, E2E testing with Playwright, and integration testing patterns.
---

# Blockchain Testing Guide

## Smart Contract Testing with Foundry

### Setup

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Basic Test Structure

```solidity
// test/AgentRegistry.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/AgentRegistry.sol";

contract AgentRegistryTest is Test {
    AgentRegistry public registry;
    address public owner = address(1);
    address public user1 = address(2);
    address public user2 = address(3);

    event AgentRegistered(bytes32 indexed agentId, address indexed owner);
    event TrustScoreUpdated(bytes32 indexed agentId, uint256 newScore);

    function setUp() public {
        vm.prank(owner);
        registry = new AgentRegistry();
    }

    function test_RegisterAgent() public {
        vm.startPrank(user1);
        
        vm.expectEmit(true, true, false, false);
        emit AgentRegistered(bytes32(0), user1);
        
        bytes32 agentId = registry.registerAgent("Test Agent", "ipfs://metadata");
        
        assertEq(registry.getAgentOwner(agentId), user1);
        assertEq(registry.getTrustScore(agentId), 100);
        
        vm.stopPrank();
    }

    function test_RevertWhen_DuplicateAgent() public {
        vm.startPrank(user1);
        registry.registerAgent("Test Agent", "ipfs://metadata");
        
        vm.expectRevert("Agent already exists");
        registry.registerAgent("Test Agent", "ipfs://metadata");
        
        vm.stopPrank();
    }

    function test_DelegateCapital() public {
        vm.prank(user1);
        bytes32 agentId = registry.registerAgent("Test Agent", "ipfs://metadata");

        uint256 amount = 1 ether;
        vm.deal(user2, amount);
        
        vm.prank(user2);
        registry.delegateCapital{value: amount}(agentId);

        assertEq(registry.getTotalCapital(agentId), amount);
        assertEq(registry.getDelegation(agentId, user2), amount);
    }

    function testFuzz_DelegateCapital(uint256 amount) public {
        vm.assume(amount > 0 && amount < 1000 ether);
        
        vm.prank(user1);
        bytes32 agentId = registry.registerAgent("Test Agent", "ipfs://metadata");

        vm.deal(user2, amount);
        vm.prank(user2);
        registry.delegateCapital{value: amount}(agentId);

        assertEq(registry.getTotalCapital(agentId), amount);
    }
}
```

### Advanced Testing Patterns

```solidity
// test/AgentRegistry.invariant.t.sol
contract AgentRegistryInvariantTest is Test {
    AgentRegistry public registry;
    AgentHandler public handler;

    function setUp() public {
        registry = new AgentRegistry();
        handler = new AgentHandler(registry);
        
        targetContract(address(handler));
    }

    // Trust score should never exceed maximum
    function invariant_trustScoreMax() public {
        bytes32[] memory agents = handler.getAgents();
        for (uint i = 0; i < agents.length; i++) {
            uint256 score = registry.getTrustScore(agents[i]);
            assertLe(score, registry.MAX_TRUST_SCORE());
        }
    }

    // Sum of delegations should equal total capital
    function invariant_capitalAccounting() public {
        bytes32[] memory agents = handler.getAgents();
        for (uint i = 0; i < agents.length; i++) {
            uint256 reported = registry.getTotalCapital(agents[i]);
            uint256 summed = handler.sumDelegations(agents[i]);
            assertEq(reported, summed);
        }
    }
}

// Handler for invariant testing
contract AgentHandler is Test {
    AgentRegistry public registry;
    bytes32[] public agents;
    address[] public delegators;

    constructor(AgentRegistry _registry) {
        registry = _registry;
    }

    function registerAgent(string memory name) external {
        bytes32 agentId = registry.registerAgent(name, "ipfs://test");
        agents.push(agentId);
    }

    function delegateCapital(uint256 agentIndex, uint256 amount) external {
        if (agents.length == 0) return;
        agentIndex = agentIndex % agents.length;
        amount = bound(amount, 0, 100 ether);
        
        address delegator = address(uint160(delegators.length + 100));
        delegators.push(delegator);
        
        vm.deal(delegator, amount);
        vm.prank(delegator);
        registry.delegateCapital{value: amount}(agents[agentIndex]);
    }

    function getAgents() external view returns (bytes32[] memory) {
        return agents;
    }

    function sumDelegations(bytes32 agentId) external view returns (uint256 total) {
        for (uint i = 0; i < delegators.length; i++) {
            total += registry.getDelegation(agentId, delegators[i]);
        }
    }
}
```

### Fork Testing

```solidity
// test/DeFiIntegration.t.sol
contract DeFiIntegrationTest is Test {
    uint256 mainnetFork;
    
    address constant UNISWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    function setUp() public {
        mainnetFork = vm.createFork(vm.envString("MAINNET_RPC_URL"));
        vm.selectFork(mainnetFork);
    }

    function test_SwapOnMainnet() public {
        address user = makeAddr("user");
        deal(WETH, user, 10 ether);

        vm.startPrank(user);
        
        IERC20(WETH).approve(UNISWAP_ROUTER, 10 ether);
        
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: WETH,
            tokenOut: USDC,
            fee: 3000,
            recipient: user,
            deadline: block.timestamp + 1,
            amountIn: 1 ether,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });

        uint256 amountOut = ISwapRouter(UNISWAP_ROUTER).exactInputSingle(params);
        
        assertGt(amountOut, 0);
        assertGt(IERC20(USDC).balanceOf(user), 0);
        
        vm.stopPrank();
    }

    function test_BlockStateAtSpecificBlock() public {
        // Roll to specific block
        vm.rollFork(18_000_000);
        
        // Test state at that block
        uint256 wethBalance = IERC20(WETH).balanceOf(0x... some address ...);
        // Assert expected state
    }
}
```

## Frontend Testing with Vitest

### Setup

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './test/setup.ts',
    globals: true,
  },
});
```

### Component Testing

```typescript
// test/components/AgentCard.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AgentCard } from '@/components/AgentCard';

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: () => ({ address: '0x123...', isConnected: true }),
  useContractRead: vi.fn(),
  useContractWrite: vi.fn(),
}));

describe('AgentCard', () => {
  const mockAgent = {
    id: '0xabc',
    name: 'Test Agent',
    trustScore: 85,
    totalCapital: '10000000000000000000', // 10 ETH
    status: 'active' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders agent information correctly', () => {
    render(<AgentCard agent={mockAgent} />);

    expect(screen.getByText('Test Agent')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('10 ETH')).toBeInTheDocument();
  });

  it('shows delegate button when connected', () => {
    render(<AgentCard agent={mockAgent} />);
    
    expect(screen.getByRole('button', { name: /delegate/i })).toBeInTheDocument();
  });

  it('opens delegate modal on click', async () => {
    render(<AgentCard agent={mockAgent} />);
    
    fireEvent.click(screen.getByRole('button', { name: /delegate/i }));
    
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
```

### Hook Testing

```typescript
// test/hooks/useAgentData.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { useAgentData } from '@/hooks/useAgentData';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe('useAgentData', () => {
  it('fetches agent data successfully', async () => {
    const mockData = {
      id: '0xabc',
      name: 'Test Agent',
      trustScore: 85,
    };

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response);

    const { result } = renderHook(() => useAgentData('0xabc'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockData);
  });

  it('handles error states', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useAgentData('0xabc'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
```

## E2E Testing with Playwright

### Setup

```bash
npm install -D @playwright/test
npx playwright install
```

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### E2E Test Example

```typescript
// e2e/agent-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Agent Management', () => {
  test.beforeEach(async ({ page }) => {
    // Mock wallet connection
    await page.addInitScript(() => {
      (window as any).ethereum = {
        isMetaMask: true,
        request: async ({ method }: { method: string }) => {
          if (method === 'eth_requestAccounts') {
            return ['0x1234567890123456789012345678901234567890'];
          }
          if (method === 'eth_chainId') {
            return '0x1';
          }
          return null;
        },
      };
    });
  });

  test('should create a new agent', async ({ page }) => {
    await page.goto('/agents/new');

    // Fill form
    await page.fill('[name="name"]', 'Test Agent');
    await page.fill('[name="description"]', 'A test agent for E2E testing');
    await page.selectOption('[name="strategy"]', 'balanced');

    // Submit
    await page.click('button[type="submit"]');

    // Verify redirect and success
    await expect(page).toHaveURL(/\/agents\/0x/);
    await expect(page.locator('h1')).toContainText('Test Agent');
  });

  test('should display agent list', async ({ page }) => {
    await page.goto('/agents');

    // Wait for agents to load
    await page.waitForSelector('[data-testid="agent-card"]');

    const agents = await page.locator('[data-testid="agent-card"]').count();
    expect(agents).toBeGreaterThan(0);
  });

  test('should delegate capital to agent', async ({ page }) => {
    await page.goto('/agents/0xabc123');

    // Click delegate
    await page.click('button:has-text("Delegate")');

    // Fill amount
    await page.fill('[name="amount"]', '1');

    // Confirm transaction
    await page.click('button:has-text("Confirm")');

    // Wait for transaction
    await expect(page.locator('[data-testid="success-toast"]')).toBeVisible();
  });
});
```

## Test Commands

```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:contracts": "forge test",
    "test:contracts:gas": "forge test --gas-report",
    "test:contracts:coverage": "forge coverage"
  }
}
```
