---
name: database-prisma-drizzle
description: Database design and ORM usage with Prisma and Drizzle. Covers schema design, migrations, queries, relations, transactions, and performance optimization for PostgreSQL, MySQL, and SQLite.
---

# Database with Prisma & Drizzle

## Prisma Setup

```bash
npm install prisma @prisma/client
npx prisma init
```

## Prisma Schema

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// User model
model User {
  id            String    @id @default(cuid())
  address       String    @unique
  ensName       String?
  email         String?   @unique
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  agents        Agent[]
  delegations   Delegation[]
  
  @@index([address])
  @@map("users")
}

// AI Agent model
model Agent {
  id            String      @id @default(cuid())
  userId        String
  name          String
  description   String?
  strategy      Strategy    @default(BALANCED)
  status        AgentStatus @default(PENDING)
  trustScore    Int         @default(100)
  totalCapital  Decimal     @default(0) @db.Decimal(78, 18)
  onChainId     String?     @unique
  metadata      Json?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  
  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  executions    Execution[]
  delegations   Delegation[]
  
  @@index([userId])
  @@index([status])
  @@index([trustScore])
  @@map("agents")
}

// Strategy execution
model Execution {
  id            String          @id @default(cuid())
  agentId       String
  type          ExecutionType
  params        Json
  result        Json?
  pnl           Decimal?        @db.Decimal(78, 18)
  gasUsed       BigInt?
  txHash        String?         @unique
  status        ExecutionStatus @default(PENDING)
  executedAt    DateTime        @default(now())
  completedAt   DateTime?
  
  agent         Agent           @relation(fields: [agentId], references: [id], onDelete: Cascade)
  
  @@index([agentId])
  @@index([status])
  @@index([executedAt])
  @@map("executions")
}

// Capital delegation
model Delegation {
  id            String    @id @default(cuid())
  userId        String
  agentId       String
  amount        Decimal   @db.Decimal(78, 18)
  txHash        String    @unique
  createdAt     DateTime  @default(now())
  
  user          User      @relation(fields: [userId], references: [id])
  agent         Agent     @relation(fields: [agentId], references: [id])
  
  @@index([userId])
  @@index([agentId])
  @@map("delegations")
}

// Enums
enum Strategy {
  CONSERVATIVE
  BALANCED
  AGGRESSIVE
}

enum AgentStatus {
  PENDING
  ACTIVE
  PAUSED
  STOPPED
}

enum ExecutionType {
  SWAP
  PROVIDE_LIQUIDITY
  REMOVE_LIQUIDITY
  LEND
  BORROW
  REPAY
}

enum ExecutionStatus {
  PENDING
  EXECUTING
  SUCCESS
  FAILED
}
```

## Prisma Client Usage

```typescript
// lib/db/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Queries
export async function getAgentsByUser(userId: string) {
  return prisma.agent.findMany({
    where: { userId },
    include: {
      executions: {
        take: 10,
        orderBy: { executedAt: 'desc' },
      },
      _count: {
        select: { delegations: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createAgent(data: {
  userId: string;
  name: string;
  description?: string;
  strategy: Strategy;
}) {
  return prisma.agent.create({
    data,
  });
}

export async function updateAgentTrustScore(agentId: string, delta: number) {
  return prisma.agent.update({
    where: { id: agentId },
    data: {
      trustScore: {
        increment: delta,
      },
    },
  });
}

// Transaction example
export async function executeStrategy(
  agentId: string,
  executionData: { type: ExecutionType; params: object }
) {
  return prisma.$transaction(async (tx) => {
    // Create execution record
    const execution = await tx.execution.create({
      data: {
        agentId,
        type: executionData.type,
        params: executionData.params,
      },
    });

    // Update agent stats
    await tx.agent.update({
      where: { id: agentId },
      data: {
        updatedAt: new Date(),
      },
    });

    return execution;
  });
}

// Raw query for complex operations
export async function getAgentLeaderboard() {
  return prisma.$queryRaw`
    SELECT 
      a.id,
      a.name,
      a."trustScore",
      a."totalCapital",
      COUNT(e.id) as "totalExecutions",
      SUM(CASE WHEN e.status = 'SUCCESS' THEN 1 ELSE 0 END) as "successfulExecutions",
      SUM(COALESCE(e.pnl, 0)) as "totalPnl"
    FROM agents a
    LEFT JOIN executions e ON a.id = e."agentId"
    GROUP BY a.id
    ORDER BY a."trustScore" DESC
    LIMIT 100
  `;
}
```

## Drizzle ORM Setup

```bash
npm install drizzle-orm postgres
npm install -D drizzle-kit
```

## Drizzle Schema

```typescript
// lib/db/schema.ts
import { 
  pgTable, 
  uuid, 
  text, 
  timestamp, 
  integer, 
  decimal, 
  bigint,
  jsonb, 
  pgEnum,
  index,
  uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const strategyEnum = pgEnum('strategy', ['conservative', 'balanced', 'aggressive']);
export const agentStatusEnum = pgEnum('agent_status', ['pending', 'active', 'paused', 'stopped']);
export const executionTypeEnum = pgEnum('execution_type', [
  'swap', 'provide_liquidity', 'remove_liquidity', 'lend', 'borrow', 'repay'
]);
export const executionStatusEnum = pgEnum('execution_status', ['pending', 'executing', 'success', 'failed']);

// Tables
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  address: text('address').unique().notNull(),
  ensName: text('ens_name'),
  email: text('email').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  addressIdx: index('users_address_idx').on(table.address),
}));

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  strategy: strategyEnum('strategy').default('balanced').notNull(),
  status: agentStatusEnum('status').default('pending').notNull(),
  trustScore: integer('trust_score').default(100).notNull(),
  totalCapital: decimal('total_capital', { precision: 78, scale: 18 }).default('0'),
  onChainId: text('on_chain_id').unique(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('agents_user_id_idx').on(table.userId),
  statusIdx: index('agents_status_idx').on(table.status),
  trustScoreIdx: index('agents_trust_score_idx').on(table.trustScore),
}));

export const executions = pgTable('executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'cascade' }).notNull(),
  type: executionTypeEnum('type').notNull(),
  params: jsonb('params').notNull(),
  result: jsonb('result'),
  pnl: decimal('pnl', { precision: 78, scale: 18 }),
  gasUsed: bigint('gas_used', { mode: 'bigint' }),
  txHash: text('tx_hash').unique(),
  status: executionStatusEnum('status').default('pending').notNull(),
  executedAt: timestamp('executed_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  agentIdIdx: index('executions_agent_id_idx').on(table.agentId),
  statusIdx: index('executions_status_idx').on(table.status),
}));

export const delegations = pgTable('delegations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  agentId: uuid('agent_id').references(() => agents.id).notNull(),
  amount: decimal('amount', { precision: 78, scale: 18 }).notNull(),
  txHash: text('tx_hash').unique().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('delegations_user_id_idx').on(table.userId),
  agentIdIdx: index('delegations_agent_id_idx').on(table.agentId),
}));

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
  executions: many(executions),
  delegations: many(delegations),
}));

export const executionsRelations = relations(executions, ({ one }) => ({
  agent: one(agents, {
    fields: [executions.agentId],
    references: [agents.id],
  }),
}));

export const delegationsRelations = relations(delegations, ({ one }) => ({
  user: one(users, {
    fields: [delegations.userId],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [delegations.agentId],
    references: [agents.id],
  }),
}));
```

## Drizzle Client & Queries

```typescript
// lib/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client, { schema });

// Queries
import { eq, desc, sql, and, gte, lte } from 'drizzle-orm';

export async function getAgentsByUser(userId: string) {
  return db.query.agents.findMany({
    where: eq(schema.agents.userId, userId),
    with: {
      executions: {
        limit: 10,
        orderBy: [desc(schema.executions.executedAt)],
      },
    },
    orderBy: [desc(schema.agents.createdAt)],
  });
}

export async function createAgent(data: typeof schema.agents.$inferInsert) {
  const [agent] = await db.insert(schema.agents).values(data).returning();
  return agent;
}

export async function updateAgentTrustScore(agentId: string, delta: number) {
  const [updated] = await db
    .update(schema.agents)
    .set({
      trustScore: sql`${schema.agents.trustScore} + ${delta}`,
      updatedAt: new Date(),
    })
    .where(eq(schema.agents.id, agentId))
    .returning();
  return updated;
}

// Transaction
export async function executeStrategy(
  agentId: string,
  executionData: { type: string; params: object }
) {
  return db.transaction(async (tx) => {
    const [execution] = await tx
      .insert(schema.executions)
      .values({
        agentId,
        type: executionData.type as any,
        params: executionData.params,
      })
      .returning();

    await tx
      .update(schema.agents)
      .set({ updatedAt: new Date() })
      .where(eq(schema.agents.id, agentId));

    return execution;
  });
}

// Complex aggregation query
export async function getAgentLeaderboard() {
  return db
    .select({
      id: schema.agents.id,
      name: schema.agents.name,
      trustScore: schema.agents.trustScore,
      totalCapital: schema.agents.totalCapital,
      totalExecutions: sql<number>`count(${schema.executions.id})`,
      successfulExecutions: sql<number>`sum(case when ${schema.executions.status} = 'success' then 1 else 0 end)`,
      totalPnl: sql<string>`sum(coalesce(${schema.executions.pnl}, 0))`,
    })
    .from(schema.agents)
    .leftJoin(schema.executions, eq(schema.agents.id, schema.executions.agentId))
    .groupBy(schema.agents.id)
    .orderBy(desc(schema.agents.trustScore))
    .limit(100);
}

// Date range query
export async function getExecutionsInRange(
  agentId: string,
  startDate: Date,
  endDate: Date
) {
  return db.query.executions.findMany({
    where: and(
      eq(schema.executions.agentId, agentId),
      gte(schema.executions.executedAt, startDate),
      lte(schema.executions.executedAt, endDate)
    ),
    orderBy: [desc(schema.executions.executedAt)],
  });
}
```

## Migrations

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

```bash
# Generate migrations
npx drizzle-kit generate:pg

# Push changes directly (dev)
npx drizzle-kit push:pg

# Run migrations
npx drizzle-kit migrate
```

## Performance Tips

1. **Use indexes** for frequently queried columns
2. **Batch operations** when possible
3. **Use connection pooling** (PgBouncer, Supabase)
4. **Select only needed columns** instead of `select *`
5. **Use pagination** for large result sets
6. **Cache frequently accessed data**
7. **Monitor slow queries** with logging
