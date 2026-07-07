export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function badRequest(code: string, message: string, details?: Record<string, unknown>) {
  return new ApiError(400, code, message, details);
}

export function unauthorized(message = "Authentication required") {
  return new ApiError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "Insufficient permissions") {
  return new ApiError(403, "FORBIDDEN", message);
}

export function notFound(resource: string) {
  return new ApiError(404, "NOT_FOUND", `${resource} not found`);
}

export function conflict(code: string, message: string) {
  return new ApiError(409, code, message);
}
