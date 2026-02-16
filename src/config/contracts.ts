// ANOA Protocol Contract ABIs for Monad

export const lensAbi = [
  {
    type: 'function',
    name: 'getAmountOut',
    inputs: [
      { name: '_token', type: 'address', internalType: 'address' },
      { name: '_amountIn', type: 'uint256', internalType: 'uint256' },
      { name: '_isBuy', type: 'bool', internalType: 'bool' },
    ],
    outputs: [
      { name: 'router', type: 'address', internalType: 'address' },
      { name: 'amountOut', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAmountIn',
    inputs: [
      { name: '_token', type: 'address', internalType: 'address' },
      { name: '_amountOut', type: 'uint256', internalType: 'uint256' },
      { name: '_isBuy', type: 'bool', internalType: 'bool' },
    ],
    outputs: [
      { name: 'router', type: 'address', internalType: 'address' },
      { name: 'amountIn', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getProgress',
    inputs: [{ name: '_token', type: 'address', internalType: 'address' }],
    outputs: [{ name: 'progress', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isGraduated',
    inputs: [{ name: 'token', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isLocked',
    inputs: [{ name: 'token', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getInitialBuyAmountOut',
    inputs: [{ name: 'amountIn', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'availableBuyTokens',
    inputs: [{ name: 'token', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'availableBuyToken', type: 'uint256', internalType: 'uint256' },
      { name: 'requiredMonAmount', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const;

export const curveAbi = [
  {
    type: 'function',
    name: 'curves',
    inputs: [{ name: 'token', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'realMonReserve', type: 'uint256', internalType: 'uint256' },
      { name: 'realTokenReserve', type: 'uint256', internalType: 'uint256' },
      { name: 'virtualMonReserve', type: 'uint256', internalType: 'uint256' },
      { name: 'virtualTokenReserve', type: 'uint256', internalType: 'uint256' },
      { name: 'k', type: 'uint256', internalType: 'uint256' },
      { name: 'targetTokenAmount', type: 'uint256', internalType: 'uint256' },
      { name: 'initVirtualMonReserve', type: 'uint256', internalType: 'uint256' },
      { name: 'initVirtualTokenReserve', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isGraduated',
    inputs: [{ name: 'token', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isLocked',
    inputs: [{ name: 'token', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'CurveCreate',
    inputs: [
      { name: 'creator', type: 'address', indexed: true, internalType: 'address' },
      { name: 'token', type: 'address', indexed: true, internalType: 'address' },
      { name: 'pool', type: 'address', indexed: true, internalType: 'address' },
      { name: 'name', type: 'string', indexed: false, internalType: 'string' },
      { name: 'symbol', type: 'string', indexed: false, internalType: 'string' },
      { name: 'tokenURI', type: 'string', indexed: false, internalType: 'string' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'CurveBuy',
    inputs: [
      { name: 'sender', type: 'address', indexed: true, internalType: 'address' },
      { name: 'token', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amountIn', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'amountOut', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'CurveSell',
    inputs: [
      { name: 'sender', type: 'address', indexed: true, internalType: 'address' },
      { name: 'token', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amountIn', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'amountOut', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'CurveGraduate',
    inputs: [
      { name: 'token', type: 'address', indexed: true, internalType: 'address' },
      { name: 'pool', type: 'address', indexed: true, internalType: 'address' },
    ],
    anonymous: false,
  },
] as const;

export const routerAbi = [
  {
    type: 'function',
    name: 'buy',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IRouter.BuyParams',
        components: [
          { name: 'amountOutMin', type: 'uint256', internalType: 'uint256' },
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'to', type: 'address', internalType: 'address' },
          { name: 'deadline', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'sell',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IRouter.SellParams',
        components: [
          { name: 'amountIn', type: 'uint256', internalType: 'uint256' },
          { name: 'amountOutMin', type: 'uint256', internalType: 'uint256' },
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'to', type: 'address', internalType: 'address' },
          { name: 'deadline', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'sellPermit',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IRouter.SellPermitParams',
        components: [
          { name: 'amountIn', type: 'uint256', internalType: 'uint256' },
          { name: 'amountOutMin', type: 'uint256', internalType: 'uint256' },
          { name: 'amountAllowance', type: 'uint256', internalType: 'uint256' },
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'to', type: 'address', internalType: 'address' },
          { name: 'deadline', type: 'uint256', internalType: 'uint256' },
          { name: 'v', type: 'uint8', internalType: 'uint8' },
          { name: 'r', type: 'bytes32', internalType: 'bytes32' },
          { name: 's', type: 'bytes32', internalType: 'bytes32' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
] as const;

export const bondingCurveRouterAbi = [
  {
    type: 'function',
    name: 'create',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IBondingCurveRouter.TokenCreationParams',
        components: [
          { name: 'name', type: 'string', internalType: 'string' },
          { name: 'symbol', type: 'string', internalType: 'string' },
          { name: 'tokenURI', type: 'string', internalType: 'string' },
          { name: 'amountOut', type: 'uint256', internalType: 'uint256' },
          { name: 'salt', type: 'bytes32', internalType: 'bytes32' },
          { name: 'actionId', type: 'uint8', internalType: 'uint8' },
        ],
      },
    ],
    outputs: [
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'pool', type: 'address', internalType: 'address' },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'buy',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IBondingCurveRouter.BuyParams',
        components: [
          { name: 'amountOutMin', type: 'uint256', internalType: 'uint256' },
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'to', type: 'address', internalType: 'address' },
          { name: 'deadline', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'sell',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IBondingCurveRouter.SellParams',
        components: [
          { name: 'amountIn', type: 'uint256', internalType: 'uint256' },
          { name: 'amountOutMin', type: 'uint256', internalType: 'uint256' },
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'to', type: 'address', internalType: 'address' },
          { name: 'deadline', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'sellPermit',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IBondingCurveRouter.SellPermitParams',
        components: [
          { name: 'amountIn', type: 'uint256', internalType: 'uint256' },
          { name: 'amountOutMin', type: 'uint256', internalType: 'uint256' },
          { name: 'amountAllowance', type: 'uint256', internalType: 'uint256' },
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'to', type: 'address', internalType: 'address' },
          { name: 'deadline', type: 'uint256', internalType: 'uint256' },
          { name: 'v', type: 'uint8', internalType: 'uint8' },
          { name: 'r', type: 'bytes32', internalType: 'bytes32' },
          { name: 's', type: 'bytes32', internalType: 'bytes32' },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getAmountOutWithFee',
    inputs: [
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'amountIn', type: 'uint256', internalType: 'uint256' },
      { name: 'isBuy', type: 'bool', internalType: 'bool' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAmountInWithFee',
    inputs: [
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'amountOut', type: 'uint256', internalType: 'uint256' },
      { name: 'isBuy', type: 'bool', internalType: 'bool' },
    ],
    outputs: [{ name: 'amountIn', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'availableBuyTokens',
    inputs: [{ name: 'token', type: 'address', internalType: 'address' }],
    outputs: [
      { name: 'availableBuyToken', type: 'uint256', internalType: 'uint256' },
      { name: 'requiredMonAmount', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'curve',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'wMon',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
] as const;

// DEX Router ABI — for graduated tokens (Uniswap V3-style trading)
export const dexRouterAbi = [
  {
    type: 'function',
    name: 'buy',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IDexRouter.BuyParams',
        components: [
          { name: 'amountOutMin', type: 'uint256', internalType: 'uint256' },
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'to', type: 'address', internalType: 'address' },
          { name: 'deadline', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'sell',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IDexRouter.SellParams',
        components: [
          { name: 'amountIn', type: 'uint256', internalType: 'uint256' },
          { name: 'amountOutMin', type: 'uint256', internalType: 'uint256' },
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'to', type: 'address', internalType: 'address' },
          { name: 'deadline', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'sellPermit',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IDexRouter.SellPermitParams',
        components: [
          { name: 'amountIn', type: 'uint256', internalType: 'uint256' },
          { name: 'amountOutMin', type: 'uint256', internalType: 'uint256' },
          { name: 'amountAllowance', type: 'uint256', internalType: 'uint256' },
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'to', type: 'address', internalType: 'address' },
          { name: 'deadline', type: 'uint256', internalType: 'uint256' },
          { name: 'v', type: 'uint8', internalType: 'uint8' },
          { name: 'r', type: 'bytes32', internalType: 'bytes32' },
          { name: 's', type: 'bytes32', internalType: 'bytes32' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'exactOutBuy',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IDexRouter.ExactOutBuyParams',
        components: [
          { name: 'amountInMax', type: 'uint256', internalType: 'uint256' },
          { name: 'amountOut', type: 'uint256', internalType: 'uint256' },
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'to', type: 'address', internalType: 'address' },
          { name: 'deadline', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: 'amountIn', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'exactOutSell',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IDexRouter.ExactOutSellParams',
        components: [
          { name: 'amountInMax', type: 'uint256', internalType: 'uint256' },
          { name: 'amountOut', type: 'uint256', internalType: 'uint256' },
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'to', type: 'address', internalType: 'address' },
          { name: 'deadline', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: 'amountIn', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'exactOutSellPermit',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct IDexRouter.ExactOutSellPermitParams',
        components: [
          { name: 'amountInMax', type: 'uint256', internalType: 'uint256' },
          { name: 'amountOut', type: 'uint256', internalType: 'uint256' },
          { name: 'amountAllowance', type: 'uint256', internalType: 'uint256' },
          { name: 'token', type: 'address', internalType: 'address' },
          { name: 'to', type: 'address', internalType: 'address' },
          { name: 'deadline', type: 'uint256', internalType: 'uint256' },
          { name: 'v', type: 'uint8', internalType: 'uint8' },
          { name: 'r', type: 'bytes32', internalType: 'bytes32' },
          { name: 's', type: 'bytes32', internalType: 'bytes32' },
        ],
      },
    ],
    outputs: [{ name: 'amountIn', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'splitAmountAndFee',
    inputs: [
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'isBuy', type: 'bool', internalType: 'bool' },
    ],
    outputs: [
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'fee', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAmountOut',
    inputs: [
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'amountIn', type: 'uint256', internalType: 'uint256' },
      { name: 'isBuy', type: 'bool', internalType: 'bool' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAmountIn',
    inputs: [
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'amountOut', type: 'uint256', internalType: 'uint256' },
      { name: 'isBuy', type: 'bool', internalType: 'bool' },
    ],
    outputs: [{ name: 'amountIn', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'calculateFeeAmount',
    inputs: [{ name: 'amount', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: 'feeAmount', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'DexRouterBuy',
    inputs: [
      { name: 'sender', type: 'address', indexed: true, internalType: 'address' },
      { name: 'token', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amountIn', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'amountOut', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'DexRouterSell',
    inputs: [
      { name: 'sender', type: 'address', indexed: true, internalType: 'address' },
      { name: 'token', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amountIn', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'amountOut', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
] as const;

export const erc20Abi = [
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address', internalType: 'address' },
      { name: 'spender', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'symbol',
    inputs: [],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8', internalType: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nonces',
    inputs: [{ name: 'owner', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'permit',
    inputs: [
      { name: 'owner', type: 'address', internalType: 'address' },
      { name: 'spender', type: 'address', internalType: 'address' },
      { name: 'value', type: 'uint256', internalType: 'uint256' },
      { name: 'deadline', type: 'uint256', internalType: 'uint256' },
      { name: 'v', type: 'uint8', internalType: 'uint8' },
      { name: 'r', type: 'bytes32', internalType: 'bytes32' },
      { name: 's', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

// ERC-8004 Identity Registry ABI (from official Monad deployment)
// Contract: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
export const identityRegistryAbi = [
  // Registration functions (3 overloads)
  {
    type: 'function',
    name: 'register',
    inputs: [],
    outputs: [{ name: 'agentId', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'register',
    inputs: [{ name: 'tokenURI', type: 'string', internalType: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'register',
    inputs: [
      { name: 'tokenURI', type: 'string', internalType: 'string' },
      {
        name: 'metadata',
        type: 'tuple[]',
        internalType: 'struct IIdentityRegistry.MetadataEntry[]',
        components: [
          { name: 'key', type: 'string', internalType: 'string' },
          { name: 'value', type: 'bytes', internalType: 'bytes' },
        ],
      },
    ],
    outputs: [{ name: 'agentId', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  // URI management
  {
    type: 'function',
    name: 'setAgentURI',
    inputs: [
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
      { name: 'newURI', type: 'string', internalType: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'tokenURI',
    inputs: [{ name: 'tokenId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
  // Wallet management (EIP-712 signature required)
  {
    type: 'function',
    name: 'setAgentWallet',
    inputs: [
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
      { name: 'newWallet', type: 'address', internalType: 'address' },
      { name: 'deadline', type: 'uint256', internalType: 'uint256' },
      { name: 'signature', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getAgentWallet',
    inputs: [{ name: 'agentId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  // Metadata management
  {
    type: 'function',
    name: 'setMetadata',
    inputs: [
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
      { name: 'metadataKey', type: 'string', internalType: 'string' },
      { name: 'metadataValue', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getMetadata',
    inputs: [
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
      { name: 'metadataKey', type: 'string', internalType: 'string' },
    ],
    outputs: [{ name: '', type: 'bytes', internalType: 'bytes' }],
    stateMutability: 'view',
  },
  // Ownership & Authorization
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isAuthorizedOrOwner',
    inputs: [
      { name: 'spender', type: 'address', internalType: 'address' },
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  // Events
  {
    type: 'event',
    name: 'Registered',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'owner', type: 'address', indexed: true, internalType: 'address' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'URIUpdated',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'newURI', type: 'string', indexed: false, internalType: 'string' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'MetadataSet',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'key', type: 'string', indexed: false, internalType: 'string' },
      { name: 'value', type: 'bytes', indexed: false, internalType: 'bytes' },
    ],
    anonymous: false,
  },
] as const;

// ERC-8004 Reputation Registry ABI (from official Monad deployment)
// Contract: 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
export const reputationRegistryAbi = [
  // Submit feedback with signed value
  {
    type: 'function',
    name: 'giveFeedback',
    inputs: [
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
      { name: 'value', type: 'int128', internalType: 'int128' },
      { name: 'valueDecimals', type: 'uint8', internalType: 'uint8' },
      { name: 'tag1', type: 'bytes32', internalType: 'bytes32' },
      { name: 'tag2', type: 'bytes32', internalType: 'bytes32' },
      { name: 'endpoint', type: 'string', internalType: 'string' },
      { name: 'feedbackURI', type: 'string', internalType: 'string' },
      { name: 'feedbackHash', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [{ name: 'feedbackIndex', type: 'uint64', internalType: 'uint64' }],
    stateMutability: 'nonpayable',
  },
  // Get reputation summary
  {
    type: 'function',
    name: 'getSummary',
    inputs: [
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
      { name: 'clientAddresses', type: 'address[]', internalType: 'address[]' },
      { name: 'tag1', type: 'bytes32', internalType: 'bytes32' },
      { name: 'tag2', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [
      { name: 'count', type: 'uint64', internalType: 'uint64' },
      { name: 'summaryValue', type: 'int128', internalType: 'int128' },
      { name: 'summaryValueDecimals', type: 'uint8', internalType: 'uint8' },
    ],
    stateMutability: 'view',
  },
  // Read single feedback
  {
    type: 'function',
    name: 'readFeedback',
    inputs: [
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
      { name: 'clientAddress', type: 'address', internalType: 'address' },
      { name: 'feedbackIndex', type: 'uint64', internalType: 'uint64' },
    ],
    outputs: [
      {
        name: 'feedback',
        type: 'tuple',
        internalType: 'struct IReputationRegistry.Feedback',
        components: [
          { name: 'value', type: 'int128', internalType: 'int128' },
          { name: 'valueDecimals', type: 'uint8', internalType: 'uint8' },
          { name: 'tag1', type: 'bytes32', internalType: 'bytes32' },
          { name: 'tag2', type: 'bytes32', internalType: 'bytes32' },
          { name: 'endpoint', type: 'string', internalType: 'string' },
          { name: 'feedbackURI', type: 'string', internalType: 'string' },
          { name: 'feedbackHash', type: 'bytes32', internalType: 'bytes32' },
          { name: 'responseURI', type: 'string', internalType: 'string' },
          { name: 'responseHash', type: 'bytes32', internalType: 'bytes32' },
          { name: 'revoked', type: 'bool', internalType: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  // Read all feedback
  {
    type: 'function',
    name: 'readAllFeedback',
    inputs: [
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
      { name: 'clientAddresses', type: 'address[]', internalType: 'address[]' },
      { name: 'tag1', type: 'bytes32', internalType: 'bytes32' },
      { name: 'tag2', type: 'bytes32', internalType: 'bytes32' },
      { name: 'includeRevoked', type: 'bool', internalType: 'bool' },
    ],
    outputs: [
      {
        name: 'feedbacks',
        type: 'tuple[]',
        internalType: 'struct IReputationRegistry.Feedback[]',
        components: [
          { name: 'value', type: 'int128', internalType: 'int128' },
          { name: 'valueDecimals', type: 'uint8', internalType: 'uint8' },
          { name: 'tag1', type: 'bytes32', internalType: 'bytes32' },
          { name: 'tag2', type: 'bytes32', internalType: 'bytes32' },
          { name: 'endpoint', type: 'string', internalType: 'string' },
          { name: 'feedbackURI', type: 'string', internalType: 'string' },
          { name: 'feedbackHash', type: 'bytes32', internalType: 'bytes32' },
          { name: 'responseURI', type: 'string', internalType: 'string' },
          { name: 'responseHash', type: 'bytes32', internalType: 'bytes32' },
          { name: 'revoked', type: 'bool', internalType: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  // Revoke feedback
  {
    type: 'function',
    name: 'revokeFeedback',
    inputs: [
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
      { name: 'feedbackIndex', type: 'uint64', internalType: 'uint64' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Append response to feedback
  {
    type: 'function',
    name: 'appendResponse',
    inputs: [
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
      { name: 'clientAddress', type: 'address', internalType: 'address' },
      { name: 'feedbackIndex', type: 'uint64', internalType: 'uint64' },
      { name: 'responseURI', type: 'string', internalType: 'string' },
      { name: 'responseHash', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Get clients who gave feedback
  {
    type: 'function',
    name: 'getClients',
    inputs: [{ name: 'agentId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'address[]', internalType: 'address[]' }],
    stateMutability: 'view',
  },
  // Get last feedback index
  {
    type: 'function',
    name: 'getLastIndex',
    inputs: [
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
      { name: 'clientAddress', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'uint64', internalType: 'uint64' }],
    stateMutability: 'view',
  },
  // Events
  {
    type: 'event',
    name: 'NewFeedback',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'client', type: 'address', indexed: true, internalType: 'address' },
      { name: 'feedbackIndex', type: 'uint64', indexed: false, internalType: 'uint64' },
      { name: 'value', type: 'int128', indexed: false, internalType: 'int128' },
      { name: 'valueDecimals', type: 'uint8', indexed: false, internalType: 'uint8' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'FeedbackRevoked',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'client', type: 'address', indexed: true, internalType: 'address' },
      { name: 'feedbackIndex', type: 'uint64', indexed: false, internalType: 'uint64' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ResponseAppended',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'client', type: 'address', indexed: true, internalType: 'address' },
      { name: 'feedbackIndex', type: 'uint64', indexed: false, internalType: 'uint64' },
    ],
    anonymous: false,
  },
] as const;

// ERC-8004 Validation Registry ABI
export const validationRegistryAbi = [
  {
    type: 'function',
    name: 'validationRequest',
    inputs: [
      { name: 'validatorAddress', type: 'address', internalType: 'address' },
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
      { name: 'requestUri', type: 'string', internalType: 'string' },
      { name: 'requestHash', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'validationResponse',
    inputs: [
      { name: 'requestHash', type: 'bytes32', internalType: 'bytes32' },
      { name: 'response', type: 'uint8', internalType: 'uint8' },
      { name: 'responseUri', type: 'string', internalType: 'string' },
      { name: 'responseHash', type: 'bytes32', internalType: 'bytes32' },
      { name: 'tag', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

// ==========================================
// YIELD PROTOCOL ABIs (Mainnet - Be Careful!)
// ==========================================

// aprMON - aPriori Liquid Staking (ERC-4626 Vault)
// Contract: 0x0c65A0BC65a5D819235B71F554D210D3F80E0852
// Decimals: 18
export const aprMonAbi = [
  // Deposit native MON (payable)
  {
    type: 'function',
    name: 'deposit',
    inputs: [
      { name: 'assets', type: 'uint256', internalType: 'uint256' },
      { name: 'receiver', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'payable',
  },
  // Request withdrawal (returns requestId)
  {
    type: 'function',
    name: 'requestRedeem',
    inputs: [
      { name: 'shares', type: 'uint256', internalType: 'uint256' },
      { name: 'controller', type: 'address', internalType: 'address' },
      { name: 'owner', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: 'requestId', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  // Claim after unlock (redeem multiple requests at once)
  {
    type: 'function',
    name: 'redeem',
    inputs: [
      { name: 'requestIDs', type: 'uint256[]', internalType: 'uint256[]' },
      { name: 'receiver', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: 'assets', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  // View exchange rate: aprMON → MON
  {
    type: 'function',
    name: 'convertToAssets',
    inputs: [{ name: 'shares', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: 'assets', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  // View exchange rate: MON → aprMON
  {
    type: 'function',
    name: 'convertToShares',
    inputs: [{ name: 'assets', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: 'shares', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  // Get aprMON balance
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  // View withdrawal request status
  {
    type: 'function',
    name: 'viewRedeemRequest',
    inputs: [{ name: 'requestId', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      { name: 'id', type: 'uint256', internalType: 'uint256' },
      { name: 'claimed', type: 'bool', internalType: 'bool' },
      { name: 'claimable', type: 'bool', internalType: 'bool' },
      { name: 'shares', type: 'uint256', internalType: 'uint256' },
      { name: 'assets', type: 'uint256', internalType: 'uint256' },
      { name: 'timestamp', type: 'uint256', internalType: 'uint256' },
      { name: 'unlockEpoch', type: 'uint64', internalType: 'uint64' },
    ],
    stateMutability: 'view',
  },
  // Get user's withdrawal requests (paginated)
  {
    type: 'function',
    name: 'getUserRequestData',
    inputs: [
      { name: 'user', type: 'address', internalType: 'address' },
      { name: 'startIndex', type: 'uint256', internalType: 'uint256' },
      { name: 'pageSize', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [
      {
        name: 'requestData',
        type: 'tuple[]',
        internalType: 'struct RequestData[]',
        components: [
          { name: 'id', type: 'uint256', internalType: 'uint256' },
          { name: 'claimed', type: 'bool', internalType: 'bool' },
          { name: 'claimable', type: 'bool', internalType: 'bool' },
          { name: 'shares', type: 'uint256', internalType: 'uint256' },
          { name: 'assets', type: 'uint256', internalType: 'uint256' },
          { name: 'timestamp', type: 'uint256', internalType: 'uint256' },
          { name: 'unlockEpoch', type: 'uint64', internalType: 'uint64' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  // Total assets in vault
  {
    type: 'function',
    name: 'totalAssets',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  // Approval for transfers
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'nonpayable',
  },
  // Events
  {
    type: 'event',
    name: 'Deposit',
    inputs: [
      { name: 'sender', type: 'address', indexed: true, internalType: 'address' },
      { name: 'owner', type: 'address', indexed: true, internalType: 'address' },
      { name: 'assets', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'shares', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'RedeemRequest',
    inputs: [
      { name: 'controller', type: 'address', indexed: true, internalType: 'address' },
      { name: 'owner', type: 'address', indexed: true, internalType: 'address' },
      { name: 'requestId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'sender', type: 'address', indexed: false, internalType: 'address' },
      { name: 'shares', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'assets', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Redeem',
    inputs: [
      { name: 'controller', type: 'address', indexed: true, internalType: 'address' },
      { name: 'receiver', type: 'address', indexed: true, internalType: 'address' },
      { name: 'requestId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'shares', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'assets', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'fee', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
] as const;

// Upshift Vault - earnAUSD (Real Yield from RWA)
// Vault: 0x36eDbF0C834591BFdfCaC0Ef9605528c75c406aA
// Receipt Token: 0x103222f020e98Bba0AD9809A011FDF8e6F067496
// Decimals: 6 (both aUSD and earnAUSD)
export const upshiftVaultAbi = [
  // Deposit aUSD into vault (requires prior ERC20 approval)
  {
    type: 'function',
    name: 'deposit',
    inputs: [
      { name: 'assetIn', type: 'address', internalType: 'address' },
      { name: 'amountIn', type: 'uint256', internalType: 'uint256' },
      { name: 'receiverAddr', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  // Instant redemption with 0.2% fee
  {
    type: 'function',
    name: 'instantRedeem',
    inputs: [
      { name: 'lpAmountIn', type: 'uint256', internalType: 'uint256' },
      { name: 'stableOutIdx', type: 'uint256', internalType: 'uint256' },
      { name: 'minAmountOut', type: 'uint256', internalType: 'uint256' },
      { name: 'receiver', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  // Request delayed redemption (no fee, 3-day wait)
  {
    type: 'function',
    name: 'requestRedeem',
    inputs: [
      { name: 'lpAmountIn', type: 'uint256', internalType: 'uint256' },
      { name: 'receiver', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: 'requestId', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  // Claim after 3-day waiting period
  {
    type: 'function',
    name: 'claim',
    inputs: [
      { name: 'requestId', type: 'uint256', internalType: 'uint256' },
      { name: 'stableOutIdx', type: 'uint256', internalType: 'uint256' },
      { name: 'minAmountOut', type: 'uint256', internalType: 'uint256' },
      { name: 'receiver', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  // View supported stablecoins
  {
    type: 'function',
    name: 'supportedStables',
    inputs: [{ name: 'index', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: 'token', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  // Get LP token (earnAUSD) balance
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address', internalType: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  // Convert LP to underlying value
  {
    type: 'function',
    name: 'convertToAssets',
    inputs: [{ name: 'shares', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: 'assets', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  // Total value locked
  {
    type: 'function',
    name: 'totalAssets',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// Contract Addresses for Monad Mainnet
// NOTE: These are MAINNET ONLY addresses. Yield protocols (aPriori, Upshift) are
// currently only deployed on Monad mainnet (chain 143). Testnet yield is not supported.
export const YIELD_CONTRACTS = {
  // aPriori - Liquid Staking
  APRMON: '0x0c65A0BC65a5D819235B71F554D210D3F80E0852' as const,
  
  // Upshift - Real Yield
  UPSHIFT_VAULT: '0x36eDbF0C834591BFdfCaC0Ef9605528c75c406aA' as const,
  EARNAUSD_RECEIPT: '0x103222f020e98Bba0AD9809A011FDF8e6F067496' as const,
  
  // Stablecoins (6 decimals)
  AUSD: '0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a' as const,
  USDC: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603' as const,
  
  // LiFi Router (for MON → aUSD swaps)
  LIFI_ROUTER: '0x026F252016A7C47CDEf1F05a3Fc9E20C92a49C37' as const,
} as const;

// LiFi DEX Aggregator Router — Monad Mainnet
// Used for multi-token swaps across DEXes (not just nad.fun bonding curve)
export const LIFI_ROUTER_ADDRESS = '0x026F252016A7C47CDEf1F05a3Fc9E20C92a49C37' as `0x${string}`;

// Token Decimals
export const YIELD_DECIMALS = {
  MON: 18,
  APRMON: 18,
  AUSD: 6,
  USDC: 6,
  EARNAUSD: 6,
} as const;

// ==========================================
// ANOA PROTOCOL CONTRACTS ABIs
// Our custom contracts for trading agents
// To be deployed on Monad
// ==========================================

// ANOA Agent Identity Contract ABI
// Extended ERC-721 with handle, capabilities, operator delegation
export const anoaAgentIdentityAbi = [
  // Registration with fee
  {
    type: 'function',
    name: 'register',
    inputs: [
      { name: 'agentWallet', type: 'address', internalType: 'address' },
      { name: 'handle', type: 'string', internalType: 'string' },
      { name: 'metadataUri', type: 'string', internalType: 'string' },
      { name: 'capabilities', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'payable',
  },
  // Metadata management
  {
    type: 'function',
    name: 'setMetadata',
    inputs: [
      { name: 'tokenId', type: 'uint256', internalType: 'uint256' },
      { name: 'newMetadataUri', type: 'string', internalType: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setCapabilities',
    inputs: [
      { name: 'tokenId', type: 'uint256', internalType: 'uint256' },
      { name: 'capabilities', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setOperator',
    inputs: [
      { name: 'tokenId', type: 'uint256', internalType: 'uint256' },
      { name: 'operator', type: 'address', internalType: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Lifecycle
  {
    type: 'function',
    name: 'deactivate',
    inputs: [{ name: 'tokenId', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'reactivate',
    inputs: [{ name: 'tokenId', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // View functions
  {
    type: 'function',
    name: 'getMetadata',
    inputs: [{ name: 'tokenId', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct AnoaAgentIdentity.AgentInfo',
        components: [
          { name: 'walletAddress', type: 'address', internalType: 'address' },
          { name: 'metadataUri', type: 'string', internalType: 'string' },
          { name: 'registeredAt', type: 'uint256', internalType: 'uint256' },
          { name: 'isActive', type: 'bool', internalType: 'bool' },
          { name: 'operator', type: 'address', internalType: 'address' },
          { name: 'capabilities', type: 'uint256', internalType: 'uint256' },
          { name: 'version', type: 'uint8', internalType: 'uint8' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isAgentActive',
    inputs: [{ name: 'tokenId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getGlobalId',
    inputs: [{ name: 'tokenId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAgentByWallet',
    inputs: [{ name: 'wallet', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalAgents',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'registrationFee',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tokenURI',
    inputs: [{ name: 'tokenId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'string', internalType: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  // Events
  {
    type: 'event',
    name: 'AgentRegistered',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'walletAddress', type: 'address', indexed: true, internalType: 'address' },
      { name: 'owner', type: 'address', indexed: true, internalType: 'address' },
      { name: 'handle', type: 'string', indexed: false, internalType: 'string' },
      { name: 'metadataUri', type: 'string', indexed: false, internalType: 'string' },
      { name: 'timestamp', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AgentUpdated',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'metadataUri', type: 'string', indexed: false, internalType: 'string' },
      { name: 'timestamp', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'AgentDeactivated',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'timestamp', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
] as const;

// ANOA Agent Reputation Contract ABI
// Feedback with 0-100 score, validator weights
export const anoaAgentReputationAbi = [
  // Feedback functions
  {
    type: 'function',
    name: 'giveFeedback',
    inputs: [
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
      { name: 'score', type: 'uint8', internalType: 'uint8' },
      { name: 'tag1', type: 'bytes32', internalType: 'bytes32' },
      { name: 'tag2', type: 'bytes32', internalType: 'bytes32' },
      { name: 'proofHash', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'giveValidatorFeedback',
    inputs: [
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
      { name: 'score', type: 'uint8', internalType: 'uint8' },
      { name: 'proofHash', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // View functions
  {
    type: 'function',
    name: 'getSummary',
    inputs: [{ name: 'agentId', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      { name: 'totalFeedbacks', type: 'uint256', internalType: 'uint256' },
      { name: 'averageScore', type: 'uint256', internalType: 'uint256' },
      { name: 'lastFeedbackAt', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getFullSummary',
    inputs: [{ name: 'agentId', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct AnoaAgentReputation.ReputationSummary',
        components: [
          { name: 'totalFeedbacks', type: 'uint256', internalType: 'uint256' },
          { name: 'averageScore', type: 'uint256', internalType: 'uint256' },
          { name: 'lastFeedbackAt', type: 'uint256', internalType: 'uint256' },
          { name: 'totalValidatorFeedbacks', type: 'uint256', internalType: 'uint256' },
          { name: 'validatorScoreSum', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTrustScore',
    inputs: [{ name: 'agentId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hasMinimumReputation',
    inputs: [
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
      { name: 'minScore', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getFeedbacks',
    inputs: [{ name: 'agentId', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        internalType: 'struct AnoaAgentReputation.Feedback[]',
        components: [
          { name: 'clientAddress', type: 'address', internalType: 'address' },
          { name: 'score', type: 'uint8', internalType: 'uint8' },
          { name: 'tag1', type: 'bytes32', internalType: 'bytes32' },
          { name: 'tag2', type: 'bytes32', internalType: 'bytes32' },
          { name: 'proofHash', type: 'bytes32', internalType: 'bytes32' },
          { name: 'timestamp', type: 'uint256', internalType: 'uint256' },
          { name: 'validatorWeight', type: 'uint256', internalType: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getFeedbackCount',
    inputs: [{ name: 'agentId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTagCount',
    inputs: [
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
      { name: 'tag', type: 'bytes32', internalType: 'bytes32' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  // Events
  {
    type: 'event',
    name: 'FeedbackGiven',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'clientAddress', type: 'address', indexed: true, internalType: 'address' },
      { name: 'score', type: 'uint8', indexed: false, internalType: 'uint8' },
      { name: 'tag1', type: 'bytes32', indexed: false, internalType: 'bytes32' },
      { name: 'tag2', type: 'bytes32', indexed: false, internalType: 'bytes32' },
      { name: 'proofHash', type: 'bytes32', indexed: false, internalType: 'bytes32' },
      { name: 'timestamp', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ValidatorFeedbackGiven',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'validatorAddress', type: 'address', indexed: true, internalType: 'address' },
      { name: 'score', type: 'uint8', indexed: false, internalType: 'uint8' },
      { name: 'weight', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'proofHash', type: 'bytes32', indexed: false, internalType: 'bytes32' },
      { name: 'timestamp', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
] as const;

// ANOA Protocol Contract Addresses (to be deployed)
// TODO: Update addresses after deployment
export const ANOA_PROTOCOL_CONTRACTS = {
  testnet: {
    AGENT_IDENTITY: null as `0x${string}` | null,
    AGENT_REPUTATION: null as `0x${string}` | null,
    AGENT_VALIDATOR: null as `0x${string}` | null,
    TRUSTLESS_CORE: null as `0x${string}` | null,
    CAPITAL_VAULT: null as `0x${string}` | null,
  },
  mainnet: {
    AGENT_IDENTITY: null as `0x${string}` | null,
    AGENT_REPUTATION: null as `0x${string}` | null,
    AGENT_VALIDATOR: null as `0x${string}` | null,
    TRUSTLESS_CORE: null as `0x${string}` | null,
    CAPITAL_VAULT: null as `0x${string}` | null,
  },
} as const;

// AnoaCapitalVault ABI - Capital delegation, fee collection, and withdrawals
export const capitalVaultAbi = [
  // Read Functions
  {
    type: 'function',
    name: 'feeConfig',
    inputs: [],
    outputs: [
      { name: 'registrationFee', type: 'uint256', internalType: 'uint256' },
      { name: 'tradingFeeBps', type: 'uint256', internalType: 'uint256' },
      { name: 'withdrawalFeeBps', type: 'uint256', internalType: 'uint256' },
      { name: 'minCapital', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'delegations',
    inputs: [{ name: 'delegationId', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      { name: 'delegator', type: 'address', internalType: 'address' },
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'depositedAt', type: 'uint256', internalType: 'uint256' },
      { name: 'lockupEndsAt', type: 'uint256', internalType: 'uint256' },
      { name: 'isActive', type: 'bool', internalType: 'bool' },
      { name: 'accumulatedPnl', type: 'int256', internalType: 'int256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'agentCapital',
    inputs: [{ name: 'agentId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'totalDelegatedCapital',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'agentTokenCapital',
    inputs: [
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
      { name: 'token', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'accumulatedFees',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getDelegatorDelegations',
    inputs: [{ name: 'delegator', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256[]', internalType: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAgentDelegations',
    inputs: [{ name: 'agentId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint256[]', internalType: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'calculateWithdrawalFee',
    inputs: [{ name: 'amount', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      { name: 'amountAfterFee', type: 'uint256', internalType: 'uint256' },
      { name: 'fee', type: 'uint256', internalType: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'defaultLockupPeriod',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  // Write Functions
  {
    type: 'function',
    name: 'delegateCapital',
    inputs: [{ name: 'agentId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: 'delegationId', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'delegateCapitalWithLockup',
    inputs: [
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
      { name: 'lockupPeriod', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: 'delegationId', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'withdrawCapital',
    inputs: [
      { name: 'delegationId', type: 'uint256', internalType: 'uint256' },
      { name: 'recipient', type: 'address', internalType: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'payRegistrationFee',
    inputs: [{ name: 'agentId', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'payable',
  },
  // Events
  {
    type: 'event',
    name: 'CapitalDelegated',
    inputs: [
      { name: 'delegationId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'delegator', type: 'address', indexed: true, internalType: 'address' },
      { name: 'agentId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'lockupEndsAt', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'CapitalWithdrawn',
    inputs: [
      { name: 'delegationId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'delegator', type: 'address', indexed: true, internalType: 'address' },
      { name: 'recipient', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'fee', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'RegistrationFeePaid',
    inputs: [
      { name: 'payer', type: 'address', indexed: true, internalType: 'address' },
      { name: 'agentId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  // ============================================
  // PNL RECORDING & PERFORMANCE FEE
  // ============================================
  {
    type: 'function',
    name: 'recordDelegationPnl',
    inputs: [
      { name: 'delegationId', type: 'uint256', internalType: 'uint256' },
      { name: 'pnlAmount', type: 'int256', internalType: 'int256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'batchRecordPnl',
    inputs: [
      { name: 'delegationIds', type: 'uint256[]', internalType: 'uint256[]' },
      { name: 'pnlAmounts', type: 'int256[]', internalType: 'int256[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'depositProfits',
    inputs: [{ name: 'agentId', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'getDelegationPnl',
    inputs: [{ name: 'delegationId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'int256', internalType: 'int256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setAgentPerformanceFee',
    inputs: [
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
      { name: 'feeBps', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getPerformanceFee',
    inputs: [{ name: 'agentId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: 'feeBps', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'PnLRecorded',
    inputs: [
      { name: 'delegationId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'agentId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'delegator', type: 'address', indexed: true, internalType: 'address' },
      { name: 'pnlAmount', type: 'int256', indexed: false, internalType: 'int256' },
      { name: 'totalAccumulatedPnl', type: 'int256', indexed: false, internalType: 'int256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ProfitsDeposited',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'depositor', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PerformanceFeeUpdated',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'feeBps', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  // ============================================
  // TRADING FEE RECORDING
  // ============================================
  {
    type: 'function',
    name: 'recordTradingFee',
    inputs: [
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'tradeAmount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdrawFees',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdrawTokenFees',
    inputs: [{ name: 'token', type: 'address', internalType: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // ============================================
  // OPERATOR & ADMIN
  // ============================================
  {
    type: 'function',
    name: 'setOperator',
    inputs: [
      { name: 'operator', type: 'address', internalType: 'address' },
      { name: 'status', type: 'bool', internalType: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'authorizedOperators',
    inputs: [{ name: 'operator', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getDelegation',
    inputs: [{ name: 'delegationId', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct AnoaCapitalVault.Delegation',
        components: [
          { name: 'delegator', type: 'address', internalType: 'address' },
          { name: 'agentId', type: 'uint256', internalType: 'uint256' },
          { name: 'amount', type: 'uint256', internalType: 'uint256' },
          { name: 'depositedAt', type: 'uint256', internalType: 'uint256' },
          { name: 'lockupEndsAt', type: 'uint256', internalType: 'uint256' },
          { name: 'isActive', type: 'bool', internalType: 'bool' },
          { name: 'accumulatedPnl', type: 'int256', internalType: 'int256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'OperatorUpdated',
    inputs: [
      { name: 'operator', type: 'address', indexed: true, internalType: 'address' },
      { name: 'status', type: 'bool', indexed: false, internalType: 'bool' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TradingFeePaid',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'token', type: 'address', indexed: true, internalType: 'address' },
      { name: 'fee', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  // ============================================
  // CAPITAL FLOW TO AGENT
  // ============================================
  {
    type: 'function',
    name: 'setAgentWallet',
    inputs: [
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
      { name: 'wallet', type: 'address', internalType: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'releaseFundsToAgent',
    inputs: [
      { name: 'agentId', type: 'uint256', internalType: 'uint256' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'returnFundsFromAgent',
    inputs: [{ name: 'agentId', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'getAgentWallet',
    inputs: [{ name: 'agentId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getReleasableCapital',
    inputs: [{ name: 'agentId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: 'available', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAgentCapitalStatus',
    inputs: [{ name: 'agentId', type: 'uint256', internalType: 'uint256' }],
    outputs: [
      { name: 'totalDelegated', type: 'uint256', internalType: 'uint256' },
      { name: 'released', type: 'uint256', internalType: 'uint256' },
      { name: 'inVault', type: 'uint256', internalType: 'uint256' },
      { name: 'wallet', type: 'address', internalType: 'address' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'releasedCapital',
    inputs: [{ name: 'agentId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'agentWallets',
    inputs: [{ name: 'agentId', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'address', internalType: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'setDefaultPerformanceFeeBps',
    inputs: [{ name: 'feeBps', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'defaultPerformanceFeeBps',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'AgentWalletSet',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'wallet', type: 'address', indexed: true, internalType: 'address' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'FundsReleasedToAgent',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'agentWallet', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'FundsReturnedFromAgent',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'sender', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PerformanceFeeCharged',
    inputs: [
      { name: 'delegationId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'agentId', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'feeAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
    ],
    anonymous: false,
  },
] as const;
