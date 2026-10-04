import type { RequestHandler } from 'express';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';

export interface OperationMeta {
  summary?: string;
  description?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface DetectedOperation {
  method: HttpMethod;
  path: string;
  pathParams: string[];
  source: 'typed' | 'describe' | 'plain';
  meta?: OperationMeta;
}

export interface Logger {
  debug(code: string, ...args: unknown[]): void;
  warn(code: string, ...args: unknown[]): void;
}

// ADR-27c: pinned RouteRegistry contract, copied verbatim.
export interface RegistryEntry {
  readonly id: number; // registration order, for A-3 collision suffixes
  readonly method: HttpMethod;
  readonly localPath: string; // Express syntax, as declared
  readonly source: 'typed' | 'describe';
  readonly meta: OperationMeta;
  readonly validatorFn?: RequestHandler; // typed only
  readonly handlerFn: RequestHandler;
}

export interface RouteRegistry {
  register(entry: Omit<RegistryEntry, 'id'>): RegistryEntry;
  entries(): readonly RegistryEntry[]; // registration order
  findByHandle(fn: unknown): RegistryEntry | undefined; // identity match on validatorFn OR handlerFn
}

// ADR-20 + ADR-43 + ADR-49: versioned Symbol.for identities, BRAND and BRAND_KEY.
export const META: unique symbol = Symbol.for('express-api-contract.v1.meta') as never;
export const MOUNT: unique symbol = Symbol.for('express-api-contract.v1.mount') as never;
export const CHILD: unique symbol = Symbol.for('express-api-contract.v1.child') as never;
export const RECORDER: unique symbol = Symbol.for('express-api-contract.v1.recorder') as never;
export const BRAND: unique symbol = Symbol.for('express-api-contract.v1.brand') as never;
export const BRAND_KEY: unique symbol = Symbol.for('express-api-contract.v1.brandKey') as never;
