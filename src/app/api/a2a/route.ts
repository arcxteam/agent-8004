/**
 * A2A (Agent-to-Agent) Server Endpoint
 *
 * JSON-RPC 2.0 endpoint for agent-to-agent communication.
 * Protected by x402 micropayments when PAY_TO_ADDRESS is configured.
 *
 * Methods:
 * - message/send: Send a message and get AI response
 * - tasks/get: Get task status by ID
 * - tasks/cancel: Cancel a running task
 * - agent/info: Get agent identity and capabilities
 * - agent/reputation: Get on-chain reputation summary
 * - trading/quote: Get trade quote from nad.fun
 * - trading/execute: Execute a buy/sell trade
 *
 * Reference: contoh-8004/src/templates/a2a.ts (canonical pattern)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withX402 } from '@x402/next';
import { createX402Server, getRouteConfig } from '@/lib/x402-server';
import { callAI, type ChatMessage } from '@/lib/ai-advisor';
import { getBaseUrl } from '@/lib/get-base-url';
import { ERC8004_REGISTRIES } from '@/config/chains';

// In-memory task storage
const tasks = new Map<string, Task>();
const conversations = new Map<string, ChatMessage[]>();

interface TaskMessage {
  role: 'user' | 'agent';
  parts: Array<{ type: 'text'; text: string }>;
}

interface Task {
  id: string;
  contextId: string;
  status: 'submitted' | 'working' | 'completed' | 'failed' | 'canceled';
  messages: TaskMessage[];
  artifacts: Array<{ name: string; parts: Array<{ type: 'text'; text: string }> }>;
  createdAt: string;
  updatedAt: string;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Generate AI response using shared callAI() with 3-tier fallback.
 * A2A uses higher maxTokens and temperature than the trading advisor.
 */
async function generateResponse(
  messages: ChatMessage[]
): Promise<string> {
  const systemPrompt: ChatMessage = {
    role: 'system',
    content: `You are ANOA, a trustless AI trading agent registered on ERC-8004 on Monad blockchain.
You help users with:
- Market analysis and trading recommendations on nad.fun
- Portfolio management and risk assessment
- On-chain reputation and trust verification
- DeFi yield optimization on Monad
- Agent-to-Agent (A2A) delegation and capital management

You are concise, data-driven, and always mention risk factors.
Provide actionable signals: action, entry/exit targets, risk level, confidence.
Your identity is verifiable on-chain via ERC-8004 Identity Registry.`,
  };

  const fullMessages = [systemPrompt, ...messages];
  const result = await callAI(fullMessages, { maxTokens: 500, temperature: 1.0, timeoutMs: 15000 });
  return result?.content || '[ANOA Agent] All AI providers are currently unavailable. Please try again later or check .env configuration.';
}

/**
 * Handle JSON-RPC 2.0 methods
 */
async function handleJsonRpc(body: Record<string, unknown>) {
  const { jsonrpc, method, params, id } = body as {
    jsonrpc: string;
    method: string;
    params: Record<string, unknown>;
    id: string | number;
  };

  if (jsonrpc !== '2.0') {
    return { jsonrpc: '2.0', error: { code: -32600, message: 'Invalid JSON-RPC version' }, id };
  }

  switch (method) {
    case 'message/send':
      return handleMessageSend(params || {}, id);
    case 'tasks/get':
      return handleTasksGet(params || {}, id);
    case 'tasks/cancel':
      return handleTasksCancel(params || {}, id);
    case 'agent/info':
      return handleAgentInfo(id);
    case 'agent/reputation':
      return handleAgentReputation(params || {}, id);
    case 'trading/quote':
      return handleTradingQuote(params || {}, id);
    case 'trading/execute':
      return handleTradingExecute(params || {}, id);
    case 'trading/propose':
      return handleTradingPropose(params || {}, id);
    case 'trading/proposals':
      return handleTradingProposals(params || {}, id);
    default:
      return { jsonrpc: '2.0', error: { code: -32601, message: `Method not found: ${method}` }, id };
  }
}

async function handleMessageSend(params: Record<string, unknown>, id: string | number) {
  const message = params.message as { parts?: Array<{ type: string; text: string }>; contextId?: string } | undefined;

  if (!message?.parts?.length) {
    return { jsonrpc: '2.0', error: { code: -32602, message: 'Invalid params: message.parts required' }, id };
  }

  const userText = message.parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('\n');

  const contextId = message.contextId || generateId();
  const taskId = generateId();

  const history = conversations.get(contextId) || [];
  history.push({ role: 'user', content: userText });

  const responseText = await generateResponse(history);
  history.push({ role: 'assistant', content: responseText });
  conversations.set(contextId, history);

  const task: Task = {
    id: taskId,
    contextId,
    status: 'completed',
    messages: [
      { role: 'user', parts: [{ type: 'text', text: userText }] },
      { role: 'agent', parts: [{ type: 'text', text: responseText }] },
    ],
    artifacts: [
      { name: 'response', parts: [{ type: 'text', text: responseText }] },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  tasks.set(taskId, task);
  return { jsonrpc: '2.0', result: task, id };
}

async function handleTasksGet(params: Record<string, unknown>, id: string | number) {
  const taskId = params.taskId as string;
  const task = tasks.get(taskId);

  if (!task) {
    return { jsonrpc: '2.0', error: { code: -32602, message: `Task not found: ${taskId}` }, id };
  }
  return { jsonrpc: '2.0', result: task, id };
}

async function handleTasksCancel(params: Record<string, unknown>, id: string | number) {
  const taskId = params.taskId as string;
  const task = tasks.get(taskId);

  if (!task) {
    return { jsonrpc: '2.0', error: { code: -32602, message: `Task not found: ${taskId}` }, id };
  }
  if (task.status !== 'completed' && task.status !== 'canceled') {
    task.status = 'canceled';
    task.updatedAt = new Date().toISOString();
  }
  return { jsonrpc: '2.0', result: task, id };
}

async function handleAgentInfo(id: string | number) {
  const baseUrl = getBaseUrl();
  return {
    jsonrpc: '2.0',
    result: {
      name: 'ANOA Trading Agent',
      description: 'ERC-8004 Trustless AI Trading Agent on Monad',
      version: '1.0.0',
      chain: process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ? 'monad-mainnet' : 'monad-testnet',
      registries: {
        identity: ERC8004_REGISTRIES.IDENTITY_REGISTRY,
        reputation: ERC8004_REGISTRIES.REPUTATION_REGISTRY,
      },
      capabilities: ['trading', 'yield', 'risk-management', 'portfolio', 'a2a', 'mcp', 'x402'],
      trustModels: ['reputation', 'crypto-economic'],
      endpoints: {
        a2a: `${baseUrl}/api/a2a`,
        mcp: `${baseUrl}/api/mcp`,
        trade: `${baseUrl}/api/trade`,
        quote: `${baseUrl}/api/quote`,
        validations: `${baseUrl}/api/validations`,
      },
      x402Enabled: !!process.env.PAY_TO_ADDRESS,
    },
    id,
  };
}

async function handleAgentReputation(params: Record<string, unknown>, id: string | number) {
  const agentId = params.agentId as string;
  if (!agentId) {
    return { jsonrpc: '2.0', error: { code: -32602, message: 'agentId required' }, id };
  }

  try {
    const { getReputationSummary } = await import('@/lib/agent0-service');
    const summary = await getReputationSummary(agentId);
    return { jsonrpc: '2.0', result: summary, id };
  } catch {
    return {
      jsonrpc: '2.0',
      result: { agentId, feedbackCount: 0, averageValue: 0, note: 'Agent may not be registered yet' },
      id,
    };
  }
}

async function handleTradingQuote(params: Record<string, unknown>, id: string | number) {
  const { tokenAddress, amountIn, direction } = params as {
    tokenAddress?: string;
    amountIn?: string;
    direction?: 'buy' | 'sell';
  };

  if (!tokenAddress || !amountIn) {
    return { jsonrpc: '2.0', error: { code: -32602, message: 'tokenAddress and amountIn required' }, id };
  }

  try {
    const baseUrl = getBaseUrl();
    const res = await fetch(
      `${baseUrl}/api/quote?token=${tokenAddress}&amount=${amountIn}&direction=${direction || 'buy'}`
    );
    const data = await res.json();
    return { jsonrpc: '2.0', result: data, id };
  } catch {
    return { jsonrpc: '2.0', error: { code: -32603, message: 'Quote fetch failed' }, id };
  }
}

async function handleTradingExecute(params: Record<string, unknown>, id: string | number) {
  const { tokenAddress, amount, action, agentId, slippageBps } = params as {
    tokenAddress?: string;
    amount?: string;
    action?: 'buy' | 'sell';
    agentId?: string;
    slippageBps?: number;
  };

  if (!tokenAddress || !amount || !action) {
    return {
      jsonrpc: '2.0',
      error: { code: -32602, message: 'tokenAddress, amount, and action (buy/sell) required' },
      id,
    };
  }

  try {
    const baseUrl = getBaseUrl();
    const res = await fetch(`${baseUrl}/api/trade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokenAddress, amount, action, agentId, slippageBps }),
    });
    const data = await res.json();
    return { jsonrpc: '2.0', result: data, id };
  } catch {
    return { jsonrpc: '2.0', error: { code: -32603, message: 'Trade execution failed' }, id };
  }
}

/**
 * trading/propose — Create a trade proposal for human approval (OpenClaw Judgement)
 * Params: { agentId, tokenAddress, amount, action, slippageBps?, proposedBy? }
 */
async function handleTradingPropose(params: Record<string, unknown>, id: string | number) {
  const { agentId, tokenAddress, amount, action, slippageBps, proposedBy } = params as {
    agentId?: string;
    tokenAddress?: string;
    amount?: string;
    action?: 'buy' | 'sell';
    slippageBps?: number;
    proposedBy?: string;
  };

  if (!agentId || !tokenAddress || !amount || !action) {
    return {
      jsonrpc: '2.0',
      error: { code: -32602, message: 'agentId, tokenAddress, amount, and action required' },
      id,
    };
  }

  try {
    const { createTradeProposal } = await import('@/lib/trade-judgement');
    const proposal = await createTradeProposal({
      agentId,
      tokenAddress,
      amount,
      action,
      slippageBps,
      proposedBy: proposedBy || 'a2a-caller',
    });
    return { jsonrpc: '2.0', result: { proposal, note: 'Trade proposal created. Awaiting human approval.' }, id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create proposal';
    return { jsonrpc: '2.0', error: { code: -32603, message: msg }, id };
  }
}

/**
 * trading/proposals — List trade proposals for an agent
 * Params: { agentId?, status?, limit? }
 */
async function handleTradingProposals(params: Record<string, unknown>, id: string | number) {
  const { agentId, status, limit } = params as {
    agentId?: string;
    status?: string;
    limit?: number;
  };

  try {
    const { getTradeProposals } = await import('@/lib/trade-judgement');
    const proposals = await getTradeProposals(agentId, status, limit);
    return { jsonrpc: '2.0', result: proposals, id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to list proposals';
    return { jsonrpc: '2.0', error: { code: -32603, message: msg }, id };
  }
}

// Agent card data for GET requests
const agentCard = {
  name: 'ANOA Trading Agent',
  description: 'ERC-8004 Trustless AI Trading Agent on Monad - Auto trading, yield optimization, risk management',
  url: getBaseUrl(),
  version: '1.0.0',
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  authentication: process.env.PAY_TO_ADDRESS
    ? { schemes: ['x402'], credentials: null }
    : null,
  defaultInputModes: ['text'],
  defaultOutputModes: ['text'],
  skills: [
    {
      id: 'trading',
      name: 'Trading',
      description: 'Execute trades on nad.fun (Monad DEX) with risk management',
      tags: ['trading', 'defi', 'monad', 'nad.fun'],
      examples: ['Buy 10 MON worth of token X', 'What is the best entry point?'],
    },
    {
      id: 'portfolio',
      name: 'Portfolio Management',
      description: 'Track and optimize portfolio across Monad DeFi protocols',
      tags: ['portfolio', 'analytics', 'yield'],
    },
    {
      id: 'reputation',
      name: 'Trust & Reputation',
      description: 'Query on-chain reputation via ERC-8004 Reputation Registry',
      tags: ['trust', 'reputation', 'erc-8004'],
    },
    {
      id: 'market-analysis',
      name: 'Market Analysis',
      description: 'AI-powered market analysis and trade recommendations',
      tags: ['analysis', 'ai', 'market'],
    },
    {
      id: 'yield',
      name: 'Yield Optimization',
      description: 'Deposit/withdraw into earnAUSD (Upshift) and aprMON (aPriori) yield protocols',
      tags: ['yield', 'defi', 'staking', 'rwa'],
    },
    {
      id: 'validation',
      name: 'Validation & Verification',
      description: 'Create and verify trade validation artifacts via ERC-8004 Validation Registry',
      tags: ['validation', 'proof', 'erc-8004'],
    },
    {
      id: 'judgement',
      name: 'Trade Judgement',
      description: 'OpenClaw-inspired human-in-the-loop trade approval. Propose trades for human review before execution.',
      tags: ['judgement', 'approval', 'openclaw', 'human-in-the-loop'],
      examples: ['Propose buying 5 MON of token X for review', 'List pending trade proposals'],
    },
  ],
  protocols: {
    a2a: { endpoint: '/api/a2a', version: '1.0.0' },
    mcp: { endpoint: '/api/mcp', version: '2025-06-18' },
    x402: process.env.PAY_TO_ADDRESS
      ? { enabled: true, price: '$0.001', network: process.env.NEXT_PUBLIC_NETWORK === 'mainnet' ? 'eip155:143' : 'eip155:10143' }
      : { enabled: false },
  },
};

/**
 * POST /api/a2a - JSON-RPC 2.0 endpoint
 * Protected by x402 micropayments when PAY_TO_ADDRESS is configured
 */
async function postHandler(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await handleJsonRpc(body);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: 0 },
      { status: 400 }
    );
  }
}

// Conditionally wrap POST with x402 payment protection
const PAY_TO = process.env.PAY_TO_ADDRESS;
let x402Server: ReturnType<typeof createX402Server> | null = null;
let routeConfig: ReturnType<typeof getRouteConfig> | null = null;

if (PAY_TO) {
  try {
    x402Server = createX402Server();
    routeConfig = getRouteConfig(PAY_TO, '$0.001');
  } catch (err) {
    console.warn('x402 server initialization failed, POST will be unprotected:', err);
  }
}

export const POST = (PAY_TO && x402Server && routeConfig)
  ? withX402(postHandler, routeConfig, x402Server)
  : postHandler;

/**
 * GET /api/a2a - Returns agent card (A2A discovery)
 * Always public (no payment required)
 */
export async function GET() {
  return NextResponse.json(agentCard);
}
