/**
 * MCP (Model Context Protocol) Server
 *
 * HTTP JSON endpoint implementing MCP for AI agent tool discovery and execution.
 * No SDK dependency — implements the protocol directly over HTTP.
 *
 * GET  /api/mcp — Return MCP manifest (tools, name, version)
 * POST /api/mcp — Handle tools/list and tools/call
 *
 * Tools:
 * - get_quote: Get trade quote from nad.fun Lens contract
 * - execute_trade: Execute buy/sell trade
 * - get_agent_reputation: Query on-chain reputation
 * - chat: Send message to ANOA AI agent
 * - get_market_data: Get token market data from nad.fun API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/get-base-url';

const MCP_VERSION = '2025-06-18';
const SERVER_NAME = 'anoa-trading-agent';
const SERVER_VERSION = '1.0.0';

interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
}

const TOOLS: McpTool[] = [
  {
    name: 'get_quote',
    description: 'Get a trade quote for buying or selling tokens on nad.fun (Monad DEX). Returns estimated output amount, price impact, and router address.',
    inputSchema: {
      type: 'object',
      properties: {
        tokenAddress: { type: 'string', description: 'Token contract address (0x...)' },
        amount: { type: 'string', description: 'Amount in MON (for buy) or tokens (for sell)' },
        action: { type: 'string', description: 'Trade direction', enum: ['buy', 'sell'] },
      },
      required: ['tokenAddress', 'amount', 'action'],
    },
  },
  {
    name: 'execute_trade',
    description: 'Execute a buy or sell trade on nad.fun bonding curve. Requires AGENT_PRIVATE_KEY to be configured on the server.',
    inputSchema: {
      type: 'object',
      properties: {
        tokenAddress: { type: 'string', description: 'Token contract address (0x...)' },
        amount: { type: 'string', description: 'Amount in MON (for buy) or tokens (for sell)' },
        action: { type: 'string', description: 'Trade direction', enum: ['buy', 'sell'] },
        agentId: { type: 'string', description: 'Agent ID for tracking (optional)' },
        slippageBps: { type: 'string', description: 'Slippage tolerance in basis points (default: 100 = 1%)' },
      },
      required: ['tokenAddress', 'amount', 'action'],
    },
  },
  {
    name: 'get_agent_reputation',
    description: 'Query on-chain reputation for an agent registered on ERC-8004 Reputation Registry on Monad.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Agent ID in format "chainId:tokenId" (e.g., "10143:42")' },
      },
      required: ['agentId'],
    },
  },
  {
    name: 'chat',
    description: 'Send a message to the ANOA AI trading agent and get a response. Supports market analysis, trading recommendations, and portfolio advice.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message to send to the agent' },
        contextId: { type: 'string', description: 'Conversation context ID for multi-turn chat (optional)' },
      },
      required: ['message'],
    },
  },
  {
    name: 'get_market_data',
    description: 'Get market data for a token on nad.fun including price, volume, holders, and market cap.',
    inputSchema: {
      type: 'object',
      properties: {
        tokenAddress: { type: 'string', description: 'Token contract address (0x...)' },
      },
      required: ['tokenAddress'],
    },
  },
];

/**
 * GET /api/mcp — MCP manifest
 */
export async function GET() {
  return NextResponse.json({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    protocolVersion: MCP_VERSION,
    description: 'ANOA ERC-8004 Trustless AI Trading Agent on Monad — trade execution, market analysis, reputation queries',
    capabilities: {
      tools: { listChanged: false },
    },
    tools: TOOLS,
  });
}

/**
 * POST /api/mcp — Handle MCP requests (tools/list, tools/call)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { method, params, id } = body as {
      jsonrpc?: string;
      method: string;
      params?: Record<string, unknown>;
      id?: string | number;
    };

    switch (method) {
      case 'initialize':
        return NextResponse.json({
          jsonrpc: '2.0',
          result: {
            protocolVersion: MCP_VERSION,
            serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
            capabilities: { tools: { listChanged: false } },
          },
          id,
        });

      case 'tools/list':
        return NextResponse.json({
          jsonrpc: '2.0',
          result: { tools: TOOLS },
          id,
        });

      case 'tools/call':
        return handleToolCall(params || {}, id);

      default:
        return NextResponse.json({
          jsonrpc: '2.0',
          error: { code: -32601, message: `Method not found: ${method}` },
          id,
        });
    }
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null },
      { status: 400 }
    );
  }
}

async function handleToolCall(params: Record<string, unknown>, id?: string | number) {
  const toolName = params.name as string;
  const args = (params.arguments || {}) as Record<string, string>;

  try {
    let result: unknown;

    switch (toolName) {
      case 'get_quote':
        result = await callGetQuote(args);
        break;
      case 'execute_trade':
        result = await callExecuteTrade(args);
        break;
      case 'get_agent_reputation':
        result = await callGetReputation(args);
        break;
      case 'chat':
        result = await callChat(args);
        break;
      case 'get_market_data':
        result = await callGetMarketData(args);
        break;
      default:
        return NextResponse.json({
          jsonrpc: '2.0',
          error: { code: -32602, message: `Unknown tool: ${toolName}` },
          id,
        });
    }

    return NextResponse.json({
      jsonrpc: '2.0',
      result: {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      },
      id,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Tool execution failed';
    return NextResponse.json({
      jsonrpc: '2.0',
      result: {
        content: [{ type: 'text', text: JSON.stringify({ error: msg }) }],
        isError: true,
      },
      id,
    });
  }
}

// ============================================================================
// Tool Implementations — call our internal APIs
// ============================================================================

async function callGetQuote(args: Record<string, string>) {
  const { tokenAddress, amount, action } = args;
  const baseUrl = getBaseUrl();
  const res = await fetch(
    `${baseUrl}/api/quote?token=${tokenAddress}&amount=${amount}&action=${action || 'buy'}`,
    { signal: AbortSignal.timeout(10000) }
  );
  return res.json();
}

async function callExecuteTrade(args: Record<string, string>) {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/api/trade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tokenAddress: args.tokenAddress,
      amount: args.amount,
      action: args.action,
      agentId: args.agentId,
      slippageBps: args.slippageBps ? parseInt(args.slippageBps) : 100,
    }),
    signal: AbortSignal.timeout(30000),
  });
  return res.json();
}

async function callGetReputation(args: Record<string, string>) {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/api/a2a`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'agent/reputation',
      params: { agentId: args.agentId },
      id: 'mcp-rep',
    }),
    signal: AbortSignal.timeout(10000),
  });
  return res.json();
}

async function callChat(args: Record<string, string>) {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/api/a2a`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'message/send',
      params: {
        message: {
          parts: [{ type: 'text', text: args.message }],
          contextId: args.contextId,
        },
      },
      id: 'mcp-chat',
    }),
    signal: AbortSignal.timeout(30000),
  });
  return res.json();
}

async function callGetMarketData(args: Record<string, string>) {
  try {
    const { getMarketData, getTokenInfo } = await import('@/lib/nadfun-api');
    const [market, token] = await Promise.allSettled([
      getMarketData(args.tokenAddress),
      getTokenInfo(args.tokenAddress),
    ]);

    return {
      market: market.status === 'fulfilled' ? market.value : null,
      token: token.status === 'fulfilled' ? token.value : null,
    };
  } catch {
    // Fallback: try quote API for basic price data
    const baseUrl = getBaseUrl();
    const res = await fetch(
      `${baseUrl}/api/quote?token=${args.tokenAddress}&amount=1&action=buy`,
      { signal: AbortSignal.timeout(10000) }
    );
    return res.json();
  }
}
