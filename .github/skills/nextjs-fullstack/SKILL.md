---
name: nextjs-fullstack
description: Advanced Next.js 14+ development with App Router, Server Components, Server Actions, API routes, authentication, middleware, and full-stack patterns. Use for building production-ready, performant web applications.
---

# Next.js Fullstack Development

## Project Structure

```
app/
├── (auth)/
│   ├── login/page.tsx
│   ├── register/page.tsx
│   └── layout.tsx
├── (dashboard)/
│   ├── dashboard/page.tsx
│   ├── agents/
│   │   ├── page.tsx
│   │   ├── [id]/page.tsx
│   │   └── create/page.tsx
│   └── layout.tsx
├── api/
│   ├── agents/
│   │   ├── route.ts
│   │   └── [id]/route.ts
│   ├── auth/
│   │   └── [...nextauth]/route.ts
│   └── webhooks/
│       └── blockchain/route.ts
├── globals.css
├── layout.tsx
├── page.tsx
└── providers.tsx
components/
├── ui/
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   └── ...
├── agents/
│   ├── agent-card.tsx
│   ├── agent-list.tsx
│   └── create-agent-form.tsx
└── layout/
    ├── header.tsx
    ├── sidebar.tsx
    └── footer.tsx
lib/
├── actions/
│   ├── agents.ts
│   └── auth.ts
├── db/
│   ├── schema.ts
│   └── index.ts
├── utils/
│   └── helpers.ts
└── validations/
    └── agent.ts
```

## App Configuration

```typescript
// app/layout.tsx
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata = {
  title: {
    default: 'AI Agent Platform',
    template: '%s | AI Agent Platform',
  },
  description: 'Build AI agents with on-chain trust using ERC-8004',
  keywords: ['AI', 'blockchain', 'ERC-8004', 'agents', 'DeFi'],
  authors: [{ name: 'Your Name' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://your-domain.com',
    siteName: 'AI Agent Platform',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@yourhandle',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-dark-bg text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

```typescript
// app/providers.tsx
'use client';

import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { Web3Provider } from '@/components/providers/web3-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <Web3Provider>
          {children}
          <Toaster 
            position="bottom-right"
            theme="dark"
            toastOptions={{
              style: {
                background: '#1a1a24',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
              },
            }}
          />
        </Web3Provider>
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

## Server Components

```typescript
// app/(dashboard)/agents/page.tsx
import { Suspense } from 'react';
import { AgentList } from '@/components/agents/agent-list';
import { AgentListSkeleton } from '@/components/agents/agent-list-skeleton';
import { getAgents } from '@/lib/actions/agents';

export const metadata = {
  title: 'My Agents',
};

export default async function AgentsPage() {
  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Agents</h1>
          <p className="text-gray-400 mt-1">
            Manage your AI agents and monitor their performance
          </p>
        </div>
        <a
          href="/agents/create"
          className="px-6 py-3 bg-primary-600 hover:bg-primary-500 rounded-xl font-semibold transition-colors"
        >
          Create Agent
        </a>
      </div>

      <Suspense fallback={<AgentListSkeleton />}>
        <AgentListWrapper />
      </Suspense>
    </div>
  );
}

async function AgentListWrapper() {
  const agents = await getAgents();
  return <AgentList agents={agents} />;
}
```

## Server Actions

```typescript
// lib/actions/agents.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { agents } from '@/lib/db/schema';
import { auth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

const createAgentSchema = z.object({
  name: z.string().min(3).max(50),
  description: z.string().min(10).max(500),
  strategy: z.enum(['conservative', 'balanced', 'aggressive']),
  maxCapital: z.number().positive(),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;

export async function createAgent(input: CreateAgentInput) {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const validated = createAgentSchema.parse(input);

  const [agent] = await db.insert(agents).values({
    ...validated,
    userId: session.user.id,
    status: 'pending',
    trustScore: 100,
    createdAt: new Date(),
  }).returning();

  revalidatePath('/agents');
  redirect(`/agents/${agent.id}`);
}

export async function getAgents() {
  const session = await auth();
  if (!session?.user) {
    return [];
  }

  return db.query.agents.findMany({
    where: eq(agents.userId, session.user.id),
    orderBy: (agents, { desc }) => [desc(agents.createdAt)],
    with: {
      strategies: {
        limit: 5,
        orderBy: (strategies, { desc }) => [desc(strategies.executedAt)],
      },
    },
  });
}

export async function deleteAgent(agentId: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  await db.delete(agents).where(
    and(
      eq(agents.id, agentId),
      eq(agents.userId, session.user.id)
    )
  );

  revalidatePath('/agents');
}

export async function updateAgentStatus(
  agentId: string, 
  status: 'active' | 'paused' | 'stopped'
) {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  const [updated] = await db
    .update(agents)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(agents.id, agentId),
        eq(agents.userId, session.user.id)
      )
    )
    .returning();

  revalidatePath('/agents');
  revalidatePath(`/agents/${agentId}`);
  
  return updated;
}
```

## API Routes

```typescript
// app/api/agents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { agents } from '@/lib/db/schema';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '10');
    const status = searchParams.get('status');

    const result = await db.query.agents.findMany({
      where: (agents, { eq, and }) => {
        const conditions = [eq(agents.userId, session.user.id)];
        if (status) {
          conditions.push(eq(agents.status, status));
        }
        return and(...conditions);
      },
      limit,
      offset: (page - 1) * limit,
      orderBy: (agents, { desc }) => [desc(agents.createdAt)],
    });

    return NextResponse.json({
      data: result,
      pagination: { page, limit },
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    
    const schema = z.object({
      name: z.string().min(3),
      description: z.string(),
      strategy: z.enum(['conservative', 'balanced', 'aggressive']),
    });

    const validated = schema.parse(body);

    const [agent] = await db.insert(agents).values({
      ...validated,
      userId: session.user.id,
      status: 'pending',
      trustScore: 100,
    }).returning();

    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation Error', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
```

## Middleware

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

const publicPaths = ['/', '/login', '/register', '/api/webhooks'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check authentication
  const session = await auth();
  
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Add user info to headers for API routes
  const response = NextResponse.next();
  response.headers.set('x-user-id', session.user.id);
  
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
```

## Database Schema (Drizzle)

```typescript
// lib/db/schema.ts
import { pgTable, uuid, text, timestamp, integer, decimal, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const agentStatusEnum = pgEnum('agent_status', ['pending', 'active', 'paused', 'stopped']);
export const strategyTypeEnum = pgEnum('strategy_type', ['conservative', 'balanced', 'aggressive']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  address: text('address').unique().notNull(),
  ensName: text('ens_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  strategy: strategyTypeEnum('strategy').notNull(),
  status: agentStatusEnum('status').default('pending').notNull(),
  trustScore: integer('trust_score').default(100).notNull(),
  totalCapital: decimal('total_capital', { precision: 78, scale: 18 }).default('0'),
  onChainId: text('on_chain_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const strategies = pgTable('strategies', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => agents.id).notNull(),
  type: text('type').notNull(),
  params: jsonb('params'),
  result: jsonb('result'),
  pnl: decimal('pnl', { precision: 78, scale: 18 }),
  gasUsed: decimal('gas_used', { precision: 78, scale: 0 }),
  txHash: text('tx_hash'),
  executedAt: timestamp('executed_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  agents: many(agents),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  user: one(users, {
    fields: [agents.userId],
    references: [users.id],
  }),
  strategies: many(strategies),
}));

export const strategiesRelations = relations(strategies, ({ one }) => ({
  agent: one(agents, {
    fields: [strategies.agentId],
    references: [agents.id],
  }),
}));
```

## Form Handling

```typescript
// components/agents/create-agent-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTransition } from 'react';
import { createAgent } from '@/lib/actions/agents';
import { toast } from 'sonner';

const schema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  strategy: z.enum(['conservative', 'balanced', 'aggressive']),
  maxCapital: z.coerce.number().positive('Must be a positive number'),
});

type FormData = z.infer<typeof schema>;

export function CreateAgentForm() {
  const [isPending, startTransition] = useTransition();
  
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      strategy: 'balanced',
    },
  });

  const onSubmit = (data: FormData) => {
    startTransition(async () => {
      try {
        await createAgent(data);
        toast.success('Agent created successfully!');
      } catch (error) {
        toast.error('Failed to create agent');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-2">Agent Name</label>
        <input
          {...register('name')}
          className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
          placeholder="My Trading Agent"
        />
        {errors.name && (
          <p className="text-red-400 text-sm mt-1">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Description</label>
        <textarea
          {...register('description')}
          rows={4}
          className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors resize-none"
          placeholder="Describe what your agent does..."
        />
        {errors.description && (
          <p className="text-red-400 text-sm mt-1">{errors.description.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Strategy</label>
        <select
          {...register('strategy')}
          className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
        >
          <option value="conservative">Conservative - Lower risk, stable returns</option>
          <option value="balanced">Balanced - Moderate risk and returns</option>
          <option value="aggressive">Aggressive - Higher risk, higher potential</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Max Capital (ETH)</label>
        <input
          {...register('maxCapital')}
          type="number"
          step="0.01"
          className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-xl focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none transition-colors"
          placeholder="10.0"
        />
        {errors.maxCapital && (
          <p className="text-red-400 text-sm mt-1">{errors.maxCapital.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-4 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? 'Creating...' : 'Create Agent'}
      </button>
    </form>
  );
}
```

## Error Handling

```typescript
// app/error.tsx
'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
        <p className="text-gray-400 mb-6">{error.message}</p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-primary-600 hover:bg-primary-500 rounded-xl font-semibold transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
```

## Loading States

```typescript
// app/(dashboard)/agents/loading.tsx
export default function Loading() {
  return (
    <div className="container py-8">
      <div className="h-10 w-48 bg-dark-elevated rounded-lg animate-pulse mb-8" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-64 bg-dark-card rounded-2xl border border-dark-border animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
```
