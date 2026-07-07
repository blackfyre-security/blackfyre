/**
 * Pagination utilities for consistent paginated responses across all routes.
 */

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Wraps a list result with pagination metadata.
 * Use in every list/search endpoint for a consistent response shape.
 */
export function paginate<T>(
  items: T[],
  total: number,
  limit: number,
  offset: number,
): PaginatedResponse<T> {
  return { items, total, limit, offset };
}
