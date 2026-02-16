---
name: typescript-advanced
description: Advanced TypeScript patterns including generics, utility types, discriminated unions, type guards, branded types, and functional programming patterns. Use for building type-safe, maintainable applications with excellent developer experience.
---

# Advanced TypeScript Patterns

## Utility Types

```typescript
// Built-in Utility Types
type Partial<T> = { [P in keyof T]?: T[P] };
type Required<T> = { [P in keyof T]-?: T[P] };
type Readonly<T> = { readonly [P in keyof T]: T[P] };
type Pick<T, K extends keyof T> = { [P in K]: T[P] };
type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;
type Record<K extends keyof any, T> = { [P in K]: T };

// Custom Deep Utility Types
type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

type DeepReadonly<T> = T extends object
  ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
  : T;

type DeepRequired<T> = T extends object
  ? { [P in keyof T]-?: DeepRequired<T[P]> }
  : T;

// Nullable and NonNullable
type Nullable<T> = T | null | undefined;
type NonNullableDeep<T> = T extends object
  ? { [P in keyof T]: NonNullableDeep<NonNullable<T[P]>> }
  : NonNullable<T>;
```

## Discriminated Unions

```typescript
// Agent status state machine
type AgentState =
  | { status: 'idle'; lastActive?: Date }
  | { status: 'analyzing'; task: string; progress: number }
  | { status: 'executing'; strategy: Strategy; txHash?: string }
  | { status: 'completed'; result: ExecutionResult }
  | { status: 'error'; error: Error; recoverable: boolean };

// Type-safe state handling
function handleAgentState(state: AgentState) {
  switch (state.status) {
    case 'idle':
      console.log('Agent is idle', state.lastActive);
      break;
    case 'analyzing':
      console.log(`Analyzing: ${state.task} (${state.progress}%)`);
      break;
    case 'executing':
      console.log('Executing strategy', state.strategy.name);
      if (state.txHash) console.log('TX:', state.txHash);
      break;
    case 'completed':
      console.log('Completed with result:', state.result);
      break;
    case 'error':
      console.error('Error:', state.error.message);
      if (state.recoverable) console.log('Attempting recovery...');
      break;
  }
}

// Result type (like Rust)
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function createResult<T>(value: T): Result<T> {
  return { ok: true, value };
}

function createError<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw result.error;
}

// Option type
type Option<T> = { some: true; value: T } | { some: false };

function some<T>(value: T): Option<T> {
  return { some: true, value };
}

function none(): Option<never> {
  return { some: false };
}
```

## Type Guards

```typescript
// Basic type guards
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Custom type guards
interface Agent {
  id: string;
  name: string;
  trustScore: number;
}

interface Strategy {
  id: string;
  type: 'swap' | 'stake' | 'lend';
  params: Record<string, unknown>;
}

function isAgent(value: unknown): value is Agent {
  return (
    isObject(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isNumber(value.trustScore)
  );
}

function isStrategy(value: unknown): value is Strategy {
  return (
    isObject(value) &&
    isString(value.id) &&
    ['swap', 'stake', 'lend'].includes(value.type as string)
  );
}

// Assertion functions
function assertDefined<T>(
  value: T | null | undefined,
  message = 'Value is not defined'
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

function assertNever(value: never, message = 'Unexpected value'): never {
  throw new Error(`${message}: ${JSON.stringify(value)}`);
}
```

## Branded Types

```typescript
// Nominal typing through branding
declare const __brand: unique symbol;
type Brand<T, B> = T & { [__brand]: B };

// Branded primitives
type UserId = Brand<string, 'UserId'>;
type AgentId = Brand<string, 'AgentId'>;
type Address = Brand<`0x${string}`, 'Address'>;
type Wei = Brand<bigint, 'Wei'>;
type Ether = Brand<string, 'Ether'>;

// Constructor functions
function userId(id: string): UserId {
  return id as UserId;
}

function agentId(id: string): AgentId {
  return id as AgentId;
}

function address(addr: string): Address {
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
    throw new Error('Invalid address');
  }
  return addr as Address;
}

function wei(value: bigint): Wei {
  return value as Wei;
}

function ether(value: string): Ether {
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new Error('Invalid ether value');
  }
  return value as Ether;
}

// Type-safe operations
function weiToEther(w: Wei): Ether {
  return (Number(w) / 1e18).toFixed(18) as Ether;
}

function etherToWei(e: Ether): Wei {
  return BigInt(Math.floor(parseFloat(e) * 1e18)) as Wei;
}

// Usage prevents mixing types
function transfer(from: Address, to: Address, amount: Wei): void {
  // from and to are guaranteed to be valid addresses
}

// This would be a type error:
// transfer(userId('123'), address('0x...'), wei(1000n));
```

## Advanced Generics

```typescript
// Conditional types
type Flatten<T> = T extends Array<infer U> ? U : T;
type FlattenDeep<T> = T extends Array<infer U> ? FlattenDeep<U> : T;

// Mapped types with key remapping
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

type Setters<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => void;
};

// Example
interface Agent {
  name: string;
  trustScore: number;
}

type AgentGetters = Getters<Agent>;
// { getName: () => string; getTrustScore: () => number }

type AgentSetters = Setters<Agent>;
// { setName: (value: string) => void; setTrustScore: (value: number) => void }

// Template literal types
type EventName<T extends string> = `on${Capitalize<T>}`;
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
type ApiEndpoint<M extends HttpMethod, P extends string> = `${M} ${P}`;

type Routes = 
  | ApiEndpoint<'GET', '/agents'>
  | ApiEndpoint<'POST', '/agents'>
  | ApiEndpoint<'GET', '/agents/:id'>
  | ApiEndpoint<'PUT', '/agents/:id'>
  | ApiEndpoint<'DELETE', '/agents/:id'>;

// Extract types from template literals
type ExtractParams<T extends string> = 
  T extends `${infer _Start}:${infer Param}/${infer Rest}`
    ? Param | ExtractParams<Rest>
    : T extends `${infer _Start}:${infer Param}`
    ? Param
    : never;

type AgentParams = ExtractParams<'/agents/:id/strategies/:strategyId'>;
// 'id' | 'strategyId'
```

## Builder Pattern

```typescript
class AgentBuilder<T extends Partial<Agent> = {}> {
  private agent: T;

  constructor(agent: T = {} as T) {
    this.agent = agent;
  }

  withId<I extends string>(id: I): AgentBuilder<T & { id: I }> {
    return new AgentBuilder({ ...this.agent, id });
  }

  withName<N extends string>(name: N): AgentBuilder<T & { name: N }> {
    return new AgentBuilder({ ...this.agent, name });
  }

  withTrustScore<S extends number>(score: S): AgentBuilder<T & { trustScore: S }> {
    return new AgentBuilder({ ...this.agent, trustScore: score });
  }

  withStrategy<St extends Strategy>(strategy: St): AgentBuilder<T & { strategy: St }> {
    return new AgentBuilder({ ...this.agent, strategy });
  }

  build(this: AgentBuilder<Required<Agent>>): Agent {
    return this.agent as Agent;
  }
}

// Usage - type-safe building
const agent = new AgentBuilder()
  .withId('agent-1')
  .withName('Trading Bot')
  .withTrustScore(100)
  .build(); // Only works when all required fields are set
```

## Type-Safe Event Emitter

```typescript
type EventMap = {
  'agent:created': { agentId: string; timestamp: Date };
  'agent:started': { agentId: string; strategy: string };
  'agent:completed': { agentId: string; result: unknown };
  'agent:error': { agentId: string; error: Error };
};

type EventCallback<T> = (data: T) => void | Promise<void>;

class TypedEventEmitter<Events extends Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<EventCallback<any>>>();

  on<K extends keyof Events>(event: K, callback: EventCallback<Events[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(data);
      }
    }
  }

  once<K extends keyof Events>(event: K, callback: EventCallback<Events[K]>): () => void {
    const unsubscribe = this.on(event, (data) => {
      unsubscribe();
      callback(data);
    });
    return unsubscribe;
  }
}

// Usage
const emitter = new TypedEventEmitter<EventMap>();

emitter.on('agent:created', ({ agentId, timestamp }) => {
  // agentId is string, timestamp is Date - fully typed!
  console.log(`Agent ${agentId} created at ${timestamp}`);
});

emitter.emit('agent:created', { 
  agentId: 'abc', 
  timestamp: new Date() 
});
```

## Functional Patterns

```typescript
// Pipe function
function pipe<A, B>(fn1: (a: A) => B): (a: A) => B;
function pipe<A, B, C>(fn1: (a: A) => B, fn2: (b: B) => C): (a: A) => C;
function pipe<A, B, C, D>(fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D): (a: A) => D;
function pipe(...fns: Function[]): Function {
  return (arg: unknown) => fns.reduce((acc, fn) => fn(acc), arg);
}

// Compose function (right to left)
function compose<A, B>(fn1: (a: A) => B): (a: A) => B;
function compose<A, B, C>(fn2: (b: B) => C, fn1: (a: A) => B): (a: A) => C;
function compose<A, B, C, D>(fn3: (c: C) => D, fn2: (b: B) => C, fn1: (a: A) => B): (a: A) => D;
function compose(...fns: Function[]): Function {
  return (arg: unknown) => fns.reduceRight((acc, fn) => fn(acc), arg);
}

// Curry function
type Curry<F extends (...args: any[]) => any> = 
  F extends (a: infer A, ...rest: infer Rest) => infer R
    ? Rest extends []
      ? F
      : (a: A) => Curry<(...rest: Rest) => R>
    : never;

function curry<F extends (...args: any[]) => any>(fn: F): Curry<F> {
  return function curried(...args: any[]): any {
    if (args.length >= fn.length) {
      return fn(...args);
    }
    return (...more: any[]) => curried(...args, ...more);
  } as Curry<F>;
}

// Usage
const add = (a: number, b: number, c: number) => a + b + c;
const curriedAdd = curry(add);
const add5 = curriedAdd(5);
const add5and3 = add5(3);
const result = add5and3(2); // 10

// Memoization with proper typing
function memoize<Args extends unknown[], Result>(
  fn: (...args: Args) => Result
): (...args: Args) => Result {
  const cache = new Map<string, Result>();
  
  return (...args: Args): Result => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}
```

## Zod Schema Integration

```typescript
import { z } from 'zod';

// Define schemas
const AgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(3).max(50),
  description: z.string().optional(),
  strategy: z.enum(['conservative', 'balanced', 'aggressive']),
  trustScore: z.number().int().min(0).max(1000),
  status: z.enum(['pending', 'active', 'paused', 'stopped']),
  createdAt: z.date(),
});

// Infer types from schema
type Agent = z.infer<typeof AgentSchema>;

// Create input schema (for creation)
const CreateAgentSchema = AgentSchema.omit({ 
  id: true, 
  trustScore: true, 
  status: true, 
  createdAt: true 
});

type CreateAgentInput = z.infer<typeof CreateAgentSchema>;

// Update schema (all optional)
const UpdateAgentSchema = AgentSchema.partial().omit({ id: true, createdAt: true });

type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>;

// API response schema
const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    timestamp: z.string().datetime(),
  });

const AgentResponseSchema = ApiResponseSchema(AgentSchema);
type AgentResponse = z.infer<typeof AgentResponseSchema>;

// Validation function
function validate<T extends z.ZodType>(
  schema: T,
  data: unknown
): Result<z.infer<T>, z.ZodError> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  return { ok: false, error: result.error };
}
```
