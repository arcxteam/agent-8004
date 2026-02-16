---
name: ai-agent-builder
description: Build autonomous AI agents using LangChain, LangGraph, OpenAI, Anthropic, and custom agent frameworks. Use for creating intelligent agents that can reason, plan, use tools, and execute complex multi-step tasks.
---

# AI Agent Builder

## Agent Architecture

```
┌─────────────────────────────────────────────────────┐
│                    AI Agent System                   │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Planner   │  │  Executor   │  │  Evaluator  │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
│         │                │                │        │
│         ▼                ▼                ▼        │
│  ┌─────────────────────────────────────────────┐   │
│  │              Tool Registry                   │   │
│  │  • Blockchain Tools  • DeFi Tools           │   │
│  │  • Data Analysis     • Web Search           │   │
│  │  • Code Execution    • API Calls            │   │
│  └─────────────────────────────────────────────┘   │
│         │                │                │        │
│         ▼                ▼                ▼        │
│  ┌─────────────────────────────────────────────┐   │
│  │              Memory System                   │   │
│  │  • Short-term (Context)                     │   │
│  │  • Long-term (Vector Store)                 │   │
│  │  • Episodic (Task History)                  │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## LangChain Agent Setup

```typescript
// lib/agents/base-agent.ts
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { pull } from 'langchain/hub';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export async function createBaseAgent(tools: DynamicStructuredTool[]) {
  const llm = new ChatOpenAI({
    modelName: 'gpt-4-turbo-preview',
    temperature: 0,
  });

  const prompt = await pull<ChatPromptTemplate>('hwchase17/openai-functions-agent');

  const agent = await createOpenAIFunctionsAgent({
    llm,
    tools,
    prompt,
  });

  return new AgentExecutor({
    agent,
    tools,
    verbose: true,
    maxIterations: 10,
  });
}
```

## Blockchain Tools

```typescript
// lib/agents/tools/blockchain-tools.ts
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { createPublicClient, http, formatEther, parseEther } from 'viem';
import { mainnet } from 'viem/chains';

const client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.RPC_URL),
});

export const getBalanceTool = new DynamicStructuredTool({
  name: 'get_eth_balance',
  description: 'Get the ETH balance of an Ethereum address',
  schema: z.object({
    address: z.string().describe('The Ethereum address to check'),
  }),
  func: async ({ address }) => {
    const balance = await client.getBalance({ address: address as `0x${string}` });
    return `Balance: ${formatEther(balance)} ETH`;
  },
});

export const getTokenBalanceTool = new DynamicStructuredTool({
  name: 'get_token_balance',
  description: 'Get the ERC20 token balance of an address',
  schema: z.object({
    tokenAddress: z.string().describe('The token contract address'),
    walletAddress: z.string().describe('The wallet address to check'),
  }),
  func: async ({ tokenAddress, walletAddress }) => {
    const balance = await client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: [
        {
          name: 'balanceOf',
          type: 'function',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        },
        {
          name: 'decimals',
          type: 'function',
          inputs: [],
          outputs: [{ name: '', type: 'uint8' }],
        },
        {
          name: 'symbol',
          type: 'function',
          inputs: [],
          outputs: [{ name: '', type: 'string' }],
        },
      ],
      functionName: 'balanceOf',
      args: [walletAddress as `0x${string}`],
    });

    const decimals = await client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: [{ name: 'decimals', type: 'function', inputs: [], outputs: [{ name: '', type: 'uint8' }] }],
      functionName: 'decimals',
    });

    const symbol = await client.readContract({
      address: tokenAddress as `0x${string}`,
      abi: [{ name: 'symbol', type: 'function', inputs: [], outputs: [{ name: '', type: 'string' }] }],
      functionName: 'symbol',
    });

    return `Balance: ${Number(balance) / 10 ** Number(decimals)} ${symbol}`;
  },
});

export const getGasPriceTool = new DynamicStructuredTool({
  name: 'get_gas_price',
  description: 'Get the current gas price on Ethereum mainnet',
  schema: z.object({}),
  func: async () => {
    const gasPrice = await client.getGasPrice();
    return `Current gas price: ${Number(gasPrice) / 1e9} Gwei`;
  },
});

export const getTransactionTool = new DynamicStructuredTool({
  name: 'get_transaction',
  description: 'Get details of a transaction by hash',
  schema: z.object({
    hash: z.string().describe('The transaction hash'),
  }),
  func: async ({ hash }) => {
    const tx = await client.getTransaction({ hash: hash as `0x${string}` });
    return JSON.stringify({
      from: tx.from,
      to: tx.to,
      value: formatEther(tx.value),
      gasPrice: tx.gasPrice ? `${Number(tx.gasPrice) / 1e9} Gwei` : null,
      blockNumber: tx.blockNumber?.toString(),
    }, null, 2);
  },
});
```

## DeFi Analysis Tools

```typescript
// lib/agents/tools/defi-tools.ts
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export const getTokenPriceTool = new DynamicStructuredTool({
  name: 'get_token_price',
  description: 'Get the current price of a token in USD using CoinGecko',
  schema: z.object({
    tokenId: z.string().describe('The CoinGecko token ID (e.g., "ethereum", "bitcoin")'),
  }),
  func: async ({ tokenId }) => {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd&include_24hr_change=true`
    );
    const data = await response.json();
    
    if (!data[tokenId]) {
      return `Token ${tokenId} not found`;
    }
    
    return `${tokenId.toUpperCase()}: $${data[tokenId].usd} (24h: ${data[tokenId].usd_24h_change?.toFixed(2)}%)`;
  },
});

export const getPoolDataTool = new DynamicStructuredTool({
  name: 'get_uniswap_pool',
  description: 'Get Uniswap V3 pool data for a token pair',
  schema: z.object({
    token0: z.string().describe('First token address'),
    token1: z.string().describe('Second token address'),
    fee: z.number().describe('Pool fee tier (500, 3000, or 10000)'),
  }),
  func: async ({ token0, token1, fee }) => {
    // Query Uniswap subgraph
    const query = `
      query {
        pools(where: {
          token0: "${token0.toLowerCase()}"
          token1: "${token1.toLowerCase()}"
          feeTier: "${fee}"
        }) {
          id
          token0Price
          token1Price
          volumeUSD
          txCount
          totalValueLockedUSD
        }
      }
    `;

    const response = await fetch(
      'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      }
    );

    const { data } = await response.json();
    return JSON.stringify(data.pools[0] || 'Pool not found', null, 2);
  },
});

export const analyzeDeFiOpportunityTool = new DynamicStructuredTool({
  name: 'analyze_defi_opportunity',
  description: 'Analyze a DeFi yield farming or liquidity opportunity',
  schema: z.object({
    protocol: z.string().describe('Protocol name (e.g., "aave", "compound", "uniswap")'),
    asset: z.string().describe('Asset to analyze'),
    amount: z.number().describe('Amount in USD to simulate'),
  }),
  func: async ({ protocol, asset, amount }) => {
    // This would integrate with DeFiLlama or similar APIs
    const response = await fetch(`https://yields.llama.fi/pools`);
    const { data } = await response.json();
    
    const relevantPools = data
      .filter((pool: any) => 
        pool.project.toLowerCase().includes(protocol.toLowerCase()) &&
        pool.symbol.toLowerCase().includes(asset.toLowerCase())
      )
      .slice(0, 5);

    return JSON.stringify({
      protocol,
      asset,
      simulatedAmount: amount,
      opportunities: relevantPools.map((pool: any) => ({
        pool: pool.symbol,
        apy: `${pool.apy?.toFixed(2)}%`,
        tvl: `$${(pool.tvlUsd / 1e6).toFixed(2)}M`,
        estimatedYearlyReturn: `$${((pool.apy / 100) * amount).toFixed(2)}`,
      })),
    }, null, 2);
  },
});
```

## LangGraph Agent

```typescript
// lib/agents/langgraph-agent.ts
import { StateGraph, END } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { ToolNode } from '@langchain/langgraph/prebuilt';

interface AgentState {
  messages: BaseMessage[];
  currentStep: string;
  plan: string[];
  results: Record<string, any>;
  iterations: number;
}

export function createTradingAgent(tools: any[]) {
  const llm = new ChatOpenAI({
    modelName: 'gpt-4-turbo-preview',
    temperature: 0,
  }).bindTools(tools);

  const toolNode = new ToolNode(tools);

  // Define the planning node
  async function planNode(state: AgentState): Promise<Partial<AgentState>> {
    const planPrompt = `Based on the user's request, create a step-by-step plan to accomplish the task.
    
User request: ${state.messages[state.messages.length - 1].content}

Create a numbered list of steps. Be specific about what data to gather and what analysis to perform.`;

    const response = await llm.invoke([new HumanMessage(planPrompt)]);
    const plan = (response.content as string).split('\n').filter(line => line.trim());

    return {
      plan,
      currentStep: 'execute',
    };
  }

  // Define the execution node
  async function executeNode(state: AgentState): Promise<Partial<AgentState>> {
    const currentPlanStep = state.plan[state.iterations];
    
    if (!currentPlanStep) {
      return { currentStep: 'summarize' };
    }

    const executePrompt = `Execute this step of the plan: ${currentPlanStep}

Available results from previous steps:
${JSON.stringify(state.results, null, 2)}

Use the appropriate tools to complete this step.`;

    const response = await llm.invoke([
      ...state.messages,
      new HumanMessage(executePrompt),
    ]);

    return {
      messages: [...state.messages, response],
      iterations: state.iterations + 1,
    };
  }

  // Define the summarize node
  async function summarizeNode(state: AgentState): Promise<Partial<AgentState>> {
    const summaryPrompt = `Summarize the results of the analysis:

Plan executed:
${state.plan.join('\n')}

Results:
${JSON.stringify(state.results, null, 2)}

Provide a clear, actionable summary with recommendations.`;

    const response = await llm.invoke([new HumanMessage(summaryPrompt)]);

    return {
      messages: [...state.messages, response],
      currentStep: 'end',
    };
  }

  // Define routing logic
  function routeAfterPlan(state: AgentState): string {
    if (state.currentStep === 'execute') return 'execute';
    if (state.currentStep === 'summarize') return 'summarize';
    return END;
  }

  function routeAfterExecute(state: AgentState): string {
    if (state.iterations < state.plan.length) return 'execute';
    return 'summarize';
  }

  // Build the graph
  const workflow = new StateGraph<AgentState>({
    channels: {
      messages: { value: (a, b) => [...a, ...b], default: () => [] },
      currentStep: { value: (_, b) => b, default: () => 'plan' },
      plan: { value: (_, b) => b, default: () => [] },
      results: { value: (a, b) => ({ ...a, ...b }), default: () => ({}) },
      iterations: { value: (_, b) => b, default: () => 0 },
    },
  })
    .addNode('plan', planNode)
    .addNode('execute', executeNode)
    .addNode('tools', toolNode)
    .addNode('summarize', summarizeNode)
    .addEdge('__start__', 'plan')
    .addConditionalEdges('plan', routeAfterPlan)
    .addConditionalEdges('execute', (state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage.additional_kwargs?.tool_calls) {
        return 'tools';
      }
      return routeAfterExecute(state);
    })
    .addEdge('tools', 'execute')
    .addEdge('summarize', END);

  return workflow.compile();
}
```

## Agent Memory System

```typescript
// lib/agents/memory/vector-memory.ts
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from '@langchain/core/documents';

export class AgentMemory {
  private vectorStore: MemoryVectorStore;
  private shortTermMemory: Map<string, any> = new Map();
  private episodicMemory: Array<{
    timestamp: Date;
    action: string;
    result: any;
    context: string;
  }> = [];

  constructor() {
    this.vectorStore = new MemoryVectorStore(new OpenAIEmbeddings());
  }

  async addToLongTermMemory(content: string, metadata: Record<string, any> = {}) {
    const doc = new Document({
      pageContent: content,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    });
    await this.vectorStore.addDocuments([doc]);
  }

  async searchLongTermMemory(query: string, k: number = 5) {
    return this.vectorStore.similaritySearch(query, k);
  }

  setShortTermMemory(key: string, value: any) {
    this.shortTermMemory.set(key, value);
  }

  getShortTermMemory(key: string) {
    return this.shortTermMemory.get(key);
  }

  addEpisode(action: string, result: any, context: string) {
    this.episodicMemory.push({
      timestamp: new Date(),
      action,
      result,
      context,
    });

    // Keep only last 100 episodes
    if (this.episodicMemory.length > 100) {
      this.episodicMemory = this.episodicMemory.slice(-100);
    }
  }

  getRecentEpisodes(n: number = 10) {
    return this.episodicMemory.slice(-n);
  }

  async getRelevantContext(query: string): Promise<string> {
    const longTermResults = await this.searchLongTermMemory(query, 3);
    const recentEpisodes = this.getRecentEpisodes(5);

    return `
## Relevant Long-term Memory:
${longTermResults.map(doc => doc.pageContent).join('\n\n')}

## Recent Actions:
${recentEpisodes.map(ep => `- ${ep.action}: ${JSON.stringify(ep.result)}`).join('\n')}
    `.trim();
  }
}
```

## Agent API Endpoint

```typescript
// app/api/agents/[id]/execute/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createTradingAgent } from '@/lib/agents/langgraph-agent';
import { 
  getBalanceTool, 
  getTokenBalanceTool,
  getGasPriceTool 
} from '@/lib/agents/tools/blockchain-tools';
import {
  getTokenPriceTool,
  analyzeDeFiOpportunityTool,
} from '@/lib/agents/tools/defi-tools';
import { HumanMessage } from '@langchain/core/messages';

const tools = [
  getBalanceTool,
  getTokenBalanceTool,
  getGasPriceTool,
  getTokenPriceTool,
  analyzeDeFiOpportunityTool,
];

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { prompt } = await request.json();
    
    const agent = createTradingAgent(tools);
    
    const result = await agent.invoke({
      messages: [new HumanMessage(prompt)],
    });

    const lastMessage = result.messages[result.messages.length - 1];

    return NextResponse.json({
      agentId: params.id,
      response: lastMessage.content,
      steps: result.plan,
      iterations: result.iterations,
    });
  } catch (error) {
    console.error('Agent execution error:', error);
    return NextResponse.json(
      { error: 'Agent execution failed' },
      { status: 500 }
    );
  }
}
```

## Streaming Agent Response

```typescript
// app/api/agents/[id]/stream/route.ts
import { NextRequest } from 'next/server';
import { StreamingTextResponse, LangChainStream } from 'ai';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';

export async function POST(request: NextRequest) {
  const { prompt } = await request.json();

  const { stream, handlers } = LangChainStream();

  const llm = new ChatOpenAI({
    modelName: 'gpt-4-turbo-preview',
    streaming: true,
  });

  llm.invoke([new HumanMessage(prompt)], {
    callbacks: [handlers],
  });

  return new StreamingTextResponse(stream);
}
```

## Best Practices

1. **Use structured tools** - Always define clear schemas with Zod
2. **Implement rate limiting** - Protect against API abuse
3. **Add retry logic** - Handle transient failures gracefully
4. **Log agent steps** - Track reasoning for debugging
5. **Set iteration limits** - Prevent infinite loops
6. **Validate outputs** - Ensure agent responses are safe
7. **Cache expensive calls** - Reduce API costs
8. **Use streaming** - Better UX for long-running tasks
