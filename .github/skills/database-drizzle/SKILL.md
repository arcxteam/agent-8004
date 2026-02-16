---
name: database-drizzle
description: Database design and integration using Drizzle ORM with PostgreSQL. Includes schema design, migrations, queries, transactions, and performance optimization for blockchain and AI agent applications.
---

# Database Design with Drizzle ORM

## Installation

```bash
npm install drizzle-orm postgres
npm install -D drizzle-kit
```

## Schema Design

```typescript
// lib/db/schema.ts
import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  integer,
  decimal,
  boolean,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// Enums
export const agentStatusEnum = pgEnum('agent_status', [
  'pending',
  'active',
  'paused',
  'stopped',
  'error',
]);

export const strategyTypeEnum = pgEnum('strategy_type', [
  'swap',
  'stake',
  'lend',
  'arbitrage',
  'yield',
  'custom',
]);

export const transactionStatusEnum = pgEnum('transaction_status', [
  'pending',
  'submitted',
  'confirmed',
  'failed',
  'reverted',
]);

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  address: varchar('address', { length: 42 }).unique().notNull(),
  ensName: varchar('ens_name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  nonce: varchar('nonce', { length: 64 }).notNull(),
  isVerified: boolean('is_verified').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  addressIdx: uniqueIndex('users_address_idx').on(table.address),
}));

// Agents table
export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  status: agentStatusEnum('status').default('pending').notNull(),
  trustScore: integer('trust_score').default(100).notNull(),
  totalCapital: decimal('total_capital', { precision: 78, scale: 18 }).default('0'),
  onChainId: varchar('on_chain_id', { length: 66 }),
  chainId: integer('chain_id').default(1),
  contractAddress: varchar('contract_address', { length: 42 }),
  config: jsonb('config').$type<AgentConfig>(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('agents_user_idx').on(table.userId),
  statusIdx: index('agents_status_idx').on(table.status),
  chainIdx: index('agents_chain_idx').on(table.chainId),
}));

// Strategies table
export const strategies = pgTable('strategies', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'cascade' }).notNull(),
  type: strategyTypeEnum('type').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  params: jsonb('params').$type<StrategyParams>().notNull(),
  isActive: boolean('is_active').default(true),
  executionCount: integer('execution_count').default(0),
  successCount: integer('success_count').default(0),
  totalPnl: decimal('total_pnl', { precision: 78, scale: 18 }).default('0'),
  lastExecutedAt: timestamp('last_executed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  agentIdx: index('strategies_agent_idx').on(table.agentId),
  typeIdx: index('strategies_type_idx').on(table.type),
}));

// Transactions table
export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'cascade' }).notNull(),
  strategyId: uuid('strategy_id').references(() => strategies.id),
  chainId: integer('chain_id').notNull(),
  txHash: varchar('tx_hash', { length: 66 }).unique(),
  fromAddress: varchar('from_address', { length: 42 }).notNull(),
  toAddress: varchar('to_address', { length: 42 }),
  value: decimal('value', { precision: 78, scale: 18 }).default('0'),
  gasUsed: decimal('gas_used', { precision: 78, scale: 0 }),
  gasPrice: decimal('gas_price', { precision: 78, scale: 0 }),
  status: transactionStatusEnum('status').default('pending').notNull(),
  input: text('input'),
  output: jsonb('output'),
  error: text('error'),
  blockNumber: integer('block_number'),
  confirmedAt: timestamp('confirmed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  agentIdx: index('transactions_agent_idx').on(table.agentId),
  txHashIdx: uniqueIndex('transactions_tx_hash_idx').on(table.txHash),
  statusIdx: index('transactions_status_idx').on(table.status),
  createdAtIdx: index('transactions_created_at_idx').on(table.createdAt),
}));

// Delegations table
export const delegations = pgTable('delegations', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'cascade' }).notNull(),
  delegatorId: uuid('delegator_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  amount: decimal('amount', { precision: 78, scale: 18 }).notNull(),
  sharesAmount: decimal('shares_amount', { precision: 78, scale: 18 }).notNull(),
  txHash: varchar('tx_hash', { length: 66 }),
  isWithdrawn: boolean('is_withdrawn').default(false),
  withdrawnAt: timestamp('withdrawn_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  agentIdx: index('delegations_agent_idx').on(table.agentId),
  delegatorIdx: index('delegations_delegator_idx').on(table.delegatorId),
  pk: primaryKey({ columns: [table.agentId, table.delegatorId] }),
}));

// Trust history table
export const trustHistory = pgTable('trust_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'cascade' }).notNull(),
  previousScore: integer('previous_score').notNull(),
  newScore: integer('new_score').notNull(),
  change: integer('change').notNull(),
  reason: varchar('reason', { length: 255 }).notNull(),
  txHash: varchar('tx_hash', { length: 66 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  agentIdx: index('trust_history_agent_idx').on(table.agentId),
  createdAtIdx: index('trust_history_created_at_idx').on(table.createdAt),
}));

// Types
interface AgentConfig {
  maxCapital: string;
  minProfitThreshold: string;
  maxSlippage: number;
  allowedProtocols: string[];
  gasLimitMultiplier: number;
}

interface StrategyParams {
  tokens?: string[];
  targetApy?: number;
  rebalanceThreshold?: number;
  stopLoss?: number;
  takeProfit?: number;
  [key: string]: unknown;
}

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  agents: many(agents),
  delegations: many(delegations),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  user: one(users, {
    fields: [agents.userId],
    references: [users.id],
  }),
  strategies: many(strategies),
  transactions: many(transactions),
  delegations: many(delegations),
  trustHistory: many(trustHistory),
}));

export const strategiesRelations = relations(strategies, ({ one, many }) => ({
  agent: one(agents, {
    fields: [strategies.agentId],
    references: [agents.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  agent: one(agents, {
    fields: [transactions.agentId],
    references: [agents.id],
  }),
  strategy: one(strategies, {
    fields: [transactions.strategyId],
    references: [strategies.id],
  }),
}));

export const delegationsRelations = relations(delegations, ({ one }) => ({
  agent: one(agents, {
    fields: [delegations.agentId],
    references: [agents.id],
  }),
  delegator: one(users, {
    fields: [delegations.delegatorId],
    references: [users.id],
  }),
}));

export const trustHistoryRelations = relations(trustHistory, ({ one }) => ({
  agent: one(agents, {
    fields: [trustHistory.agentId],
    references: [agents.id],
  }),
}));
```

## Database Client

```typescript
// lib/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// For query purposes
const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });

// For migrations
export const migrationClient = postgres(connectionString, { max: 1 });
```

## Query Examples

```typescript
// lib/db/queries/agents.ts
import { db } from '../index';
import { agents, strategies, transactions, trustHistory } from '../schema';
import { eq, and, desc, asc, gte, lte, sql, count, avg, sum } from 'drizzle-orm';

// Get agent with all relations
export async function getAgentWithRelations(agentId: string) {
  return db.query.agents.findFirst({
    where: eq(agents.id, agentId),
    with: {
      user: true,
      strategies: {
        where: eq(strategies.isActive, true),
        orderBy: desc(strategies.createdAt),
      },
      transactions: {
        limit: 10,
        orderBy: desc(transactions.createdAt),
      },
      trustHistory: {
        limit: 20,
        orderBy: desc(trustHistory.createdAt),
      },
      delegations: {
        with: {
          delegator: true,
        },
      },
    },
  });
}

// Get agents with pagination and filters
export async function getAgents(options: {
  userId?: string;
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'trustScore' | 'totalCapital';
  sortOrder?: 'asc' | 'desc';
}) {
  const {
    userId,
    status,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  const conditions = [];
  if (userId) conditions.push(eq(agents.userId, userId));
  if (status) conditions.push(eq(agents.status, status as any));

  const orderByColumn = {
    createdAt: agents.createdAt,
    trustScore: agents.trustScore,
    totalCapital: agents.totalCapital,
  }[sortBy];

  const orderFn = sortOrder === 'asc' ? asc : desc;

  const [data, totalCount] = await Promise.all([
    db.query.agents.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      limit,
      offset: (page - 1) * limit,
      orderBy: orderFn(orderByColumn),
      with: {
        strategies: {
          where: eq(strategies.isActive, true),
          limit: 3,
        },
      },
    }),
    db.select({ count: count() }).from(agents).where(
      conditions.length > 0 ? and(...conditions) : undefined
    ),
  ]);

  return {
    data,
    pagination: {
      page,
      limit,
      total: totalCount[0].count,
      totalPages: Math.ceil(totalCount[0].count / limit),
    },
  };
}

// Get agent statistics
export async function getAgentStats(agentId: string) {
  const [txStats, strategyStats, delegationStats] = await Promise.all([
    // Transaction stats
    db
      .select({
        total: count(),
        successful: count(sql`CASE WHEN status = 'confirmed' THEN 1 END`),
        failed: count(sql`CASE WHEN status = 'failed' THEN 1 END`),
        totalGasUsed: sum(transactions.gasUsed),
      })
      .from(transactions)
      .where(eq(transactions.agentId, agentId)),

    // Strategy stats
    db
      .select({
        total: count(),
        active: count(sql`CASE WHEN is_active = true THEN 1 END`),
        totalPnl: sum(strategies.totalPnl),
        avgSuccessRate: avg(
          sql`CASE WHEN execution_count > 0 
              THEN (success_count::float / execution_count) * 100 
              ELSE 0 END`
        ),
      })
      .from(strategies)
      .where(eq(strategies.agentId, agentId)),

    // Delegation stats
    db
      .select({
        totalDelegators: count(),
        totalDelegated: sum(delegations.amount),
      })
      .from(delegations)
      .where(and(
        eq(delegations.agentId, agentId),
        eq(delegations.isWithdrawn, false)
      )),
  ]);

  return {
    transactions: txStats[0],
    strategies: strategyStats[0],
    delegations: delegationStats[0],
  };
}

// Get trust score history for chart
export async function getTrustHistory(
  agentId: string,
  days: number = 30
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return db
    .select({
      date: sql<string>`DATE(created_at)`,
      score: trustHistory.newScore,
      change: trustHistory.change,
    })
    .from(trustHistory)
    .where(and(
      eq(trustHistory.agentId, agentId),
      gte(trustHistory.createdAt, startDate)
    ))
    .orderBy(asc(trustHistory.createdAt));
}
```

## Transactions and ACID

```typescript
// lib/db/queries/transactions.ts
import { db } from '../index';
import { agents, strategies, transactions, trustHistory } from '../schema';
import { eq, sql } from 'drizzle-orm';

// Execute strategy with transaction
export async function executeStrategy(
  agentId: string,
  strategyId: string,
  txData: {
    txHash: string;
    fromAddress: string;
    toAddress: string;
    value: string;
    chainId: number;
  }
) {
  return db.transaction(async (tx) => {
    // 1. Create transaction record
    const [txRecord] = await tx
      .insert(transactions)
      .values({
        agentId,
        strategyId,
        chainId: txData.chainId,
        txHash: txData.txHash,
        fromAddress: txData.fromAddress,
        toAddress: txData.toAddress,
        value: txData.value,
        status: 'submitted',
      })
      .returning();

    // 2. Update strategy execution count
    await tx
      .update(strategies)
      .set({
        executionCount: sql`${strategies.executionCount} + 1`,
        lastExecutedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(strategies.id, strategyId));

    // 3. Update agent status if needed
    await tx
      .update(agents)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agentId));

    return txRecord;
  });
}

// Complete transaction with result
export async function completeTransaction(
  txId: string,
  result: {
    status: 'confirmed' | 'failed' | 'reverted';
    blockNumber?: number;
    gasUsed?: string;
    output?: unknown;
    error?: string;
    pnl?: string;
  }
) {
  return db.transaction(async (tx) => {
    // 1. Update transaction
    const [txRecord] = await tx
      .update(transactions)
      .set({
        status: result.status,
        blockNumber: result.blockNumber,
        gasUsed: result.gasUsed,
        output: result.output,
        error: result.error,
        confirmedAt: result.status === 'confirmed' ? new Date() : null,
      })
      .where(eq(transactions.id, txId))
      .returning();

    if (!txRecord.strategyId) return txRecord;

    // 2. Update strategy stats
    if (result.status === 'confirmed') {
      await tx
        .update(strategies)
        .set({
          successCount: sql`${strategies.successCount} + 1`,
          totalPnl: result.pnl 
            ? sql`${strategies.totalPnl} + ${result.pnl}` 
            : strategies.totalPnl,
          updatedAt: new Date(),
        })
        .where(eq(strategies.id, txRecord.strategyId));
    }

    // 3. Update trust score based on result
    const trustChange = result.status === 'confirmed' ? 1 : -2;
    const [agent] = await tx
      .select()
      .from(agents)
      .where(eq(agents.id, txRecord.agentId));

    const newScore = Math.max(0, Math.min(1000, agent.trustScore + trustChange));

    await tx
      .update(agents)
      .set({
        trustScore: newScore,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, txRecord.agentId));

    // 4. Record trust history
    await tx.insert(trustHistory).values({
      agentId: txRecord.agentId,
      previousScore: agent.trustScore,
      newScore,
      change: trustChange,
      reason: result.status === 'confirmed' 
        ? 'Successful strategy execution' 
        : `Failed execution: ${result.error || 'Unknown error'}`,
      txHash: txRecord.txHash,
    });

    return txRecord;
  });
}
```

## Migrations

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

```bash
# Generate migration
npx drizzle-kit generate

# Run migrations
npx drizzle-kit migrate

# Push schema (development only)
npx drizzle-kit push

# Open Drizzle Studio
npx drizzle-kit studio
```

## Prepared Statements

```typescript
// lib/db/prepared.ts
import { db } from './index';
import { agents } from './schema';
import { eq } from 'drizzle-orm';

// Prepared statement for frequently used queries
export const getAgentById = db
  .select()
  .from(agents)
  .where(eq(agents.id, sql.placeholder('id')))
  .prepare('get_agent_by_id');

// Usage
const agent = await getAgentById.execute({ id: 'agent-uuid' });
```
