/**
 * E2E API Client Utilities
 *
 * Helper functions for making API requests in E2E tests
 */

import { APIRequestContext, expect } from '@playwright/test';

/**
 * API Response interface
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string; code: string }>;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    duration?: number;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * API Client wrapper for E2E tests
 */
export class ApiClient {
  private readonly request: APIRequestContext;
  private readonly baseUrl: string;
  private authToken?: string;
  private apiKey?: string;

  constructor(request: APIRequestContext, baseUrl = '/api/v1') {
    this.request = request;
    this.baseUrl = baseUrl;
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Set API key
   */
  setApiKey(key: string): void {
    this.apiKey = key;
  }

  /**
   * Clear authentication
   */
  clearAuth(): void {
    this.authToken = undefined;
    this.apiKey = undefined;
  }

  /**
   * Get default headers
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    return headers;
  }

  /**
   * Make GET request
   */
  async get<T>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    const url = new URL(`${this.baseUrl}${path}`, 'http://localhost');
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await this.request.get(`${this.baseUrl}${path}${url.search}`, {
      headers: this.getHeaders(),
    });

    return response.json();
  }

  /**
   * Make POST request
   */
  async post<T>(path: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.request.post(`${this.baseUrl}${path}`, {
      headers: this.getHeaders(),
      data,
    });

    return response.json();
  }

  /**
   * Make PUT request
   */
  async put<T>(path: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.request.put(`${this.baseUrl}${path}`, {
      headers: this.getHeaders(),
      data,
    });

    return response.json();
  }

  /**
   * Make PATCH request
   */
  async patch<T>(path: string, data?: unknown): Promise<ApiResponse<T>> {
    const response = await this.request.patch(`${this.baseUrl}${path}`, {
      headers: this.getHeaders(),
      data,
    });

    return response.json();
  }

  /**
   * Make DELETE request
   */
  async delete<T>(path: string): Promise<ApiResponse<T>> {
    const response = await this.request.delete(`${this.baseUrl}${path}`, {
      headers: this.getHeaders(),
    });

    return response.json();
  }

  /**
   * Get raw response for status code checks
   */
  async getRaw(path: string, params?: Record<string, string>) {
    const url = new URL(`${this.baseUrl}${path}`, 'http://localhost');
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    return this.request.get(`${this.baseUrl}${path}${url.search}`, {
      headers: this.getHeaders(),
    });
  }

  /**
   * Post raw response for status code checks
   */
  async postRaw(path: string, data?: unknown) {
    return this.request.post(`${this.baseUrl}${path}`, {
      headers: this.getHeaders(),
      data,
    });
  }
}

/**
 * Assert successful API response
 */
export function assertSuccess<T>(response: ApiResponse<T>): asserts response is ApiResponse<T> & { success: true; data: T } {
  expect(response.success).toBe(true);
  expect(response.data).toBeDefined();
  expect(response.error).toBeUndefined();
}

/**
 * Assert failed API response
 */
export function assertError(response: ApiResponse, expectedCode?: string): void {
  expect(response.success).toBe(false);
  expect(response.error).toBeDefined();
  if (expectedCode) {
    expect(response.error?.code).toBe(expectedCode);
  }
}

/**
 * Assert response has pagination
 */
export function assertPaginated<T>(response: ApiResponse<T[]>): void {
  expect(response.meta?.pagination).toBeDefined();
  expect(response.meta?.pagination?.page).toBeGreaterThanOrEqual(1);
  expect(response.meta?.pagination?.limit).toBeGreaterThan(0);
  expect(response.meta?.pagination?.total).toBeGreaterThanOrEqual(0);
}

/**
 * Wait for condition with timeout
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout = 10000,
  interval = 100
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Condition not met within ${timeout}ms`);
}
