/**
 * API Response Models
 * Generic response wrappers for API calls
 */

export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly message?: string;
  readonly errors?: string[];
}

export interface PagedResponse<T> {
  readonly content: T[];
  readonly totalElements: number;
  readonly totalPages: number;
  readonly currentPage: number;
  readonly pageSize: number;
}
