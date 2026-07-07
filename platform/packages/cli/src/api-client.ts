export class ApiClient {
  constructor(
    private baseUrl: string,
    private token?: string,
  ) {}

  setToken(token: string): void {
    this.token = token;
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ error: { message: res.statusText } }));
      throw new Error(
        (err as { error?: { message?: string } }).error?.message ||
          `HTTP ${res.status}`,
      );
    }

    return res.json() as Promise<T>;
  }

  get<T = unknown>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  delete<T = unknown>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}
