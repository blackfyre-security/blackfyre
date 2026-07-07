/**
 * Standardized response wrappers for consistent API response shapes.
 *
 * All list endpoints should use `list()` for paginated responses.
 * All single-resource endpoints should use `ok()`.
 * All creation endpoints should use `created()`.
 */

import type { PaginatedResponse } from "./pagination.js";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export function success<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

export function error(code: string, message: string): ApiResponse<never> {
  return { success: false, error: { code, message } };
}

/** Wrap a single resource in a standard envelope. */
export function ok<T>(data: T): { data: T } {
  return { data };
}

/** Wrap a newly-created resource in a standard envelope. */
export function created<T>(data: T): { data: T } {
  return { data };
}

/** Wrap a paginated result in a standard envelope. */
export function list<T>(result: PaginatedResponse<T>): {
  items: T[];
  total: number;
  limit: number;
  offset: number;
} {
  return {
    items: result.items,
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  };
}
