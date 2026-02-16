---
name: defi-protocols
description: Integrate with DeFi protocols including Uniswap, Aave, Compound, Curve, and other major protocols. Includes swap execution, liquidity provision, lending/borrowing, yield farming strategies, and protocol aggregation.
---

# DeFi Protocol Integration

## Protocol Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    DeFi Integration Layer                    │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐│
│  │  Uniswap  │  │   Aave    │  │  Curve    │  │ Compound  ││
│  │   V3/V4   │  │   V3      │  │   Fi      │  │   V3      ││
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘│
│        │              │              │              │       │
│        ▼              ▼              ▼              ▼       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Protocol Abstraction Layer              │   │
│  │  • Unified Interface  • Price Aggregation           │   │
│  │  • Route Optimization • Gas Estimation              │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  AI Agent Executor                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Uniswap V3 Integration

```typescript
// lib/defi/uniswap.ts
import { ethers } from 'ethers';
import { Token, CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core';
import { Pool, Route, Trade, SwapRouter, SwapQuoter } from '@uniswap/v3-sdk';
import { 
  SWAP_ROUTER_02_ADDRESSES,
  QUOTER_ADDRESSES 
} from '@uniswap/smart-order-router';

const UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const POOL_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function fee() view returns (uint24)',
  'function liquidity() view returns (uint128)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
];

export class UniswapV3Client {
  private provider: ethers.Provider;
  private chainId: number;

  constructor(provider: ethers.Provider, chainId: number = 1) {
    this.provider = provider;
    this.chainId = chainId;
  }

  async getPool(tokenA: Token, tokenB: Token, fee: number): Promise<Pool> {
    const factoryContract = new ethers.Contract(
      UNISWAP_V3_FACTORY,
      ['function getPool(address,address,uint24) view returns (address)'],
      this.provider
    );

    const poolAddress = await factoryContract.getPool(tokenA.address, tokenB.address, fee);
    
    if (poolAddress === ethers.ZeroAddress) {
      throw new Error('Pool does not exist');
    }

    const poolContract = new ethers.Contract(poolAddress, POOL_ABI, this.provider);
    
    const [token0, token1, poolFee, liquidity, slot0] = await Promise.all([
      poolContract.token0(),
      poolContract.token1(),
      poolContract.fee(),
      poolContract.liquidity(),
      poolContract.slot0(),
    ]);

    const [sqrtPriceX96, tick] = slot0;

    return new Pool(
      tokenA.address.toLowerCase() < tokenB.address.toLowerCase() ? tokenA : tokenB,
      tokenA.address.toLowerCase() < tokenB.address.toLowerCase() ? tokenB : tokenA,
      poolFee,
      sqrtPriceX96.toString(),
      liquidity.toString(),
      tick
    );
  }

  async getQuote(
    tokenIn: Token,
    tokenOut: Token,
    amountIn: bigint,
    fee: number = 3000
  ): Promise<{
    amountOut: bigint;
    priceImpact: number;
    route: string;
  }> {
    const quoterContract = new ethers.Contract(
      QUOTER_ADDRESSES[this.chainId],
      [
        'function quoteExactInputSingle(tuple(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)',
      ],
      this.provider
    );

    const [amountOut, sqrtPriceAfter, ticksCrossed, gasEstimate] = 
      await quoterContract.quoteExactInputSingle.staticCall({
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        amountIn,
        fee,
        sqrtPriceLimitX96: 0n,
      });

    // Calculate price impact
    const pool = await this.getPool(tokenIn, tokenOut, fee);
    const priceImpact = this.calculatePriceImpact(pool, amountIn, amountOut);

    return {
      amountOut,
      priceImpact,
      route: `${tokenIn.symbol} -> ${tokenOut.symbol} (${fee / 10000}%)`,
    };
  }

  private calculatePriceImpact(pool: Pool, amountIn: bigint, amountOut: bigint): number {
    // Simplified price impact calculation
    const inputValue = Number(amountIn) / 10 ** pool.token0.decimals;
    const outputValue = Number(amountOut) / 10 ** pool.token1.decimals;
    const spotPrice = Number(pool.token0Price.toFixed(18));
    const executionPrice = outputValue / inputValue;
    return Math.abs((executionPrice - spotPrice) / spotPrice) * 100;
  }

  buildSwapTransaction(
    tokenIn: Token,
    tokenOut: Token,
    amountIn: bigint,
    amountOutMin: bigint,
    recipient: string,
    deadline: number,
    fee: number = 3000
  ): { to: string; data: string; value: bigint } {
    const swapRouter = new ethers.Interface([
      'function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountOut)',
    ]);

    const data = swapRouter.encodeFunctionData('exactInputSingle', [{
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      fee,
      recipient,
      amountIn,
      amountOutMinimum: amountOutMin,
      sqrtPriceLimitX96: 0n,
    }]);

    return {
      to: SWAP_ROUTER_02_ADDRESSES[this.chainId],
      data,
      value: tokenIn.isNative ? amountIn : 0n,
    };
  }
}
```

## Aave V3 Integration

```typescript
// lib/defi/aave.ts
import { ethers } from 'ethers';

const AAVE_POOL_ADDRESS = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2'; // Mainnet
const AAVE_POOL_ABI = [
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
  'function withdraw(address asset, uint256 amount, address to) returns (uint256)',
  'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)',
  'function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) returns (uint256)',
  'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
  'function getReserveData(address asset) view returns (tuple(uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))',
];

const AAVE_ORACLE_ADDRESS = '0x54586bE62E3c3580375aE3723C145253060Ca0C2';
const AAVE_ORACLE_ABI = [
  'function getAssetPrice(address asset) view returns (uint256)',
  'function getAssetsPrices(address[] assets) view returns (uint256[])',
];

export class AaveV3Client {
  private provider: ethers.Provider;
  private pool: ethers.Contract;
  private oracle: ethers.Contract;

  constructor(provider: ethers.Provider) {
    this.provider = provider;
    this.pool = new ethers.Contract(AAVE_POOL_ADDRESS, AAVE_POOL_ABI, provider);
    this.oracle = new ethers.Contract(AAVE_ORACLE_ADDRESS, AAVE_ORACLE_ABI, provider);
  }

  async getUserAccountData(userAddress: string) {
    const [
      totalCollateralBase,
      totalDebtBase,
      availableBorrowsBase,
      currentLiquidationThreshold,
      ltv,
      healthFactor,
    ] = await this.pool.getUserAccountData(userAddress);

    return {
      totalCollateralUSD: Number(totalCollateralBase) / 1e8,
      totalDebtUSD: Number(totalDebtBase) / 1e8,
      availableBorrowsUSD: Number(availableBorrowsBase) / 1e8,
      liquidationThreshold: Number(currentLiquidationThreshold) / 100,
      ltv: Number(ltv) / 100,
      healthFactor: Number(healthFactor) / 1e18,
    };
  }

  async getReserveData(assetAddress: string) {
    const data = await this.pool.getReserveData(assetAddress);
    
    return {
      liquidityRate: Number(data.currentLiquidityRate) / 1e27 * 100, // APY
      variableBorrowRate: Number(data.currentVariableBorrowRate) / 1e27 * 100,
      stableBorrowRate: Number(data.currentStableBorrowRate) / 1e27 * 100,
      aTokenAddress: data.aTokenAddress,
    };
  }

  async getAssetPrice(assetAddress: string): Promise<number> {
    const price = await this.oracle.getAssetPrice(assetAddress);
    return Number(price) / 1e8; // USD with 8 decimals
  }

  buildSupplyTransaction(
    asset: string,
    amount: bigint,
    onBehalfOf: string
  ): { to: string; data: string } {
    const data = this.pool.interface.encodeFunctionData('supply', [
      asset,
      amount,
      onBehalfOf,
      0, // referral code
    ]);

    return { to: AAVE_POOL_ADDRESS, data };
  }

  buildBorrowTransaction(
    asset: string,
    amount: bigint,
    interestRateMode: 1 | 2, // 1 = stable, 2 = variable
    onBehalfOf: string
  ): { to: string; data: string } {
    const data = this.pool.interface.encodeFunctionData('borrow', [
      asset,
      amount,
      interestRateMode,
      0,
      onBehalfOf,
    ]);

    return { to: AAVE_POOL_ADDRESS, data };
  }

  buildRepayTransaction(
    asset: string,
    amount: bigint,
    interestRateMode: 1 | 2,
    onBehalfOf: string
  ): { to: string; data: string } {
    const data = this.pool.interface.encodeFunctionData('repay', [
      asset,
      amount,
      interestRateMode,
      onBehalfOf,
    ]);

    return { to: AAVE_POOL_ADDRESS, data };
  }
}
```

## DeFi Aggregator

```typescript
// lib/defi/aggregator.ts
import { UniswapV3Client } from './uniswap';
import { AaveV3Client } from './aave';
import { ethers } from 'ethers';

interface SwapQuote {
  protocol: string;
  amountOut: bigint;
  priceImpact: number;
  gasEstimate: bigint;
  route: string;
}

interface YieldOpportunity {
  protocol: string;
  asset: string;
  apy: number;
  tvl: number;
  risk: 'low' | 'medium' | 'high';
}

export class DeFiAggregator {
  private uniswap: UniswapV3Client;
  private aave: AaveV3Client;
  private provider: ethers.Provider;

  constructor(provider: ethers.Provider, chainId: number = 1) {
    this.provider = provider;
    this.uniswap = new UniswapV3Client(provider, chainId);
    this.aave = new AaveV3Client(provider);
  }

  async getBestSwapQuote(
    tokenInAddress: string,
    tokenOutAddress: string,
    amountIn: bigint,
    tokenInDecimals: number = 18,
    tokenOutDecimals: number = 18
  ): Promise<SwapQuote[]> {
    const quotes: SwapQuote[] = [];

    // Try different fee tiers on Uniswap
    const feeTiers = [500, 3000, 10000]; // 0.05%, 0.3%, 1%

    for (const fee of feeTiers) {
      try {
        const tokenIn = new Token(1, tokenInAddress, tokenInDecimals);
        const tokenOut = new Token(1, tokenOutAddress, tokenOutDecimals);
        
        const quote = await this.uniswap.getQuote(tokenIn, tokenOut, amountIn, fee);
        
        quotes.push({
          protocol: `Uniswap V3 (${fee / 10000}%)`,
          amountOut: quote.amountOut,
          priceImpact: quote.priceImpact,
          gasEstimate: 150000n,
          route: quote.route,
        });
      } catch {
        // Pool doesn't exist for this fee tier
      }
    }

    // Sort by best output
    return quotes.sort((a, b) => Number(b.amountOut - a.amountOut));
  }

  async getYieldOpportunities(assets: string[]): Promise<YieldOpportunity[]> {
    const opportunities: YieldOpportunity[] = [];

    // Aave lending rates
    for (const asset of assets) {
      try {
        const reserveData = await this.aave.getReserveData(asset);
        opportunities.push({
          protocol: 'Aave V3',
          asset,
          apy: reserveData.liquidityRate,
          tvl: 0, // Would fetch from subgraph
          risk: 'low',
        });
      } catch {
        // Asset not supported
      }
    }

    // Could add Compound, Curve, etc.

    return opportunities.sort((a, b) => b.apy - a.apy);
  }

  async simulateStrategy(
    strategy: 'yield' | 'arbitrage' | 'leverage',
    params: Record<string, any>
  ): Promise<{
    estimatedReturn: number;
    gasEstimate: bigint;
    transactions: Array<{ to: string; data: string; value: bigint }>;
  }> {
    switch (strategy) {
      case 'yield':
        return this.simulateYieldStrategy(params);
      case 'arbitrage':
        return this.simulateArbitrageStrategy(params);
      case 'leverage':
        return this.simulateLeverageStrategy(params);
      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }
  }

  private async simulateYieldStrategy(params: {
    asset: string;
    amount: bigint;
    duration: number; // days
  }) {
    const reserveData = await this.aave.getReserveData(params.asset);
    const dailyRate = reserveData.liquidityRate / 365;
    const estimatedReturn = Number(params.amount) * (dailyRate / 100) * params.duration;

    const supplyTx = this.aave.buildSupplyTransaction(
      params.asset,
      params.amount,
      '0x' // Would be user address
    );

    return {
      estimatedReturn,
      gasEstimate: 200000n,
      transactions: [{ ...supplyTx, value: 0n }],
    };
  }

  private async simulateArbitrageStrategy(params: {
    tokenA: string;
    tokenB: string;
    amount: bigint;
  }) {
    // Simplified arbitrage simulation
    return {
      estimatedReturn: 0,
      gasEstimate: 400000n,
      transactions: [],
    };
  }

  private async simulateLeverageStrategy(params: {
    collateralAsset: string;
    borrowAsset: string;
    collateralAmount: bigint;
    leverage: number; // e.g., 2x
  }) {
    const userData = await this.aave.getUserAccountData('0x');
    
    return {
      estimatedReturn: 0,
      gasEstimate: 500000n,
      transactions: [],
    };
  }
}
```

## Protocol Constants

```typescript
// lib/defi/constants.ts

export const TOKENS = {
  mainnet: {
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EesddF81Ad47',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    LINK: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
  },
  polygon: {
    WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  },
  arbitrum: {
    WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548',
  },
};

export const PROTOCOLS = {
  uniswapV3: {
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  },
  aaveV3: {
    pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    oracle: '0x54586bE62E3c3580375aE3723C145253060Ca0C2',
    poolDataProvider: '0x7B4EB56E7CD4b454BA8ff71E4518426369a138a3',
  },
  compound: {
    comptroller: '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B',
    cETH: '0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5',
  },
};

export const SUBGRAPHS = {
  uniswapV3: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
  aaveV3: 'https://api.thegraph.com/subgraphs/name/aave/protocol-v3',
};
```

## Flash Loan Integration

```typescript
// lib/defi/flashloan.ts
import { ethers } from 'ethers';

const AAVE_POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';

export class FlashLoanExecutor {
  async executeFlashLoan(
    assets: string[],
    amounts: bigint[],
    modes: number[], // 0 = no debt, 1 = stable, 2 = variable
    receiverContract: string,
    params: string
  ): Promise<{ to: string; data: string }> {
    const poolInterface = new ethers.Interface([
      'function flashLoan(address receiverAddress, address[] calldata assets, uint256[] calldata amounts, uint256[] calldata interestRateModes, address onBehalfOf, bytes calldata params, uint16 referralCode)',
    ]);

    const data = poolInterface.encodeFunctionData('flashLoan', [
      receiverContract,
      assets,
      amounts,
      modes,
      receiverContract,
      params,
      0,
    ]);

    return { to: AAVE_POOL, data };
  }
}

// Example Flash Loan Receiver Contract
/*
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FlashLoanSimpleReceiverBase} from "@aave/v3-core/contracts/flashloan/FlashLoanSimpleReceiverBase.sol";
import {IPoolAddressesProvider} from "@aave/v3-core/contracts/interfaces/IPoolAddressesProvider.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FlashLoanReceiver is FlashLoanSimpleReceiverBase {
    constructor(IPoolAddressesProvider provider) FlashLoanSimpleReceiverBase(provider) {}

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        // Your arbitrage/liquidation logic here
        
        // Approve repayment
        uint256 amountOwed = amount + premium;
        IERC20(asset).approve(address(POOL), amountOwed);
        
        return true;
    }
}
*/
```
