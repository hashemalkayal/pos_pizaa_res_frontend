import { http, unwrap, type ApiEnvelope } from "../http";

/** POST /api/auth/login (backend: src/controller/auth/login.controller.ts). */
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  /** HS256 JWT; claims { userId, email, role, iat, exp }; valid 15 days (D62). */
  accessToken: string;
  /** ISO timestamp equal to the token's `exp`. */
  expiresAt: string;
}

/**
 * Errors: 401 { response: {}, message: "Invalid email or password" }; 422 validator errors;
 * 429 RATE_LIMITED with Retry-After (5 failures per email / 20 per IP per 15 minutes).
 */
export const login = async (body: LoginRequest): Promise<LoginResponse> =>
  unwrap(await http.post<ApiEnvelope<LoginResponse>>("/auth/login", body, { skipSessionExpiry: true }));
