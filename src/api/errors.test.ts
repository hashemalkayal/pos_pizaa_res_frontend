import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import { describe, expect, it } from "vitest";
import { ApiError, errorMessageKey, toApiError } from "./errors";

const responseError = (status: number, data: unknown, headers: Record<string, string> = {}) => {
  const config = { headers: new AxiosHeaders() };
  const response = { status, data, headers, config, statusText: "" } as AxiosResponse;
  return new AxiosError("Request failed", "ERR_BAD_RESPONSE", config, {}, response);
};

describe("toApiError — backend error bodies", () => {
  it("API error body: code, details and field errors", () => {
    const error = toApiError(
      responseError(422, {
        message: "The request is invalid.",
        statusCode: 422,
        code: "VALIDATION_ERROR",
        error: { code: "VALIDATION_ERROR", details: { errors: [{ field: "items[0].quantity", message: "must be ≥ 1" }] } },
      })
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: "validation", status: 422, code: "VALIDATION_ERROR", message: "The request is invalid." });
    expect(error.fieldErrors).toEqual([{ field: "items[0].quantity", message: "must be ≥ 1" }]);
  });

  it("login validator body { message, errors }", () => {
    const error = toApiError(responseError(422, { message: "Unprocessable Entity", errors: [{ field: "email", message: "Invalid email" }] }));
    expect(error.kind).toBe("validation");
    expect(error.fieldErrors).toEqual([{ field: "email", message: "Invalid email" }]);
  });

  it("login 401 envelope { response: {}, message }", () => {
    const error = toApiError(responseError(401, { response: {}, message: "Invalid email or password" }));
    expect(error).toMatchObject({ kind: "unauthorized", code: null, message: "Invalid email or password" });
  });

  it("auth 401 codes (D66)", () => {
    for (const code of ["TOKEN_MISSING", "INVALID_TOKEN", "TOKEN_EXPIRED", "USER_NOT_FOUND"]) {
      const error = toApiError(responseError(401, { message: "unauthorized", statusCode: 401, code, error: { code, details: null } }));
      expect(error).toMatchObject({ kind: "unauthorized", code });
      expect(errorMessageKey(error)).toBe("auth.session.invalid");
    }
  });

  it("429 reads Retry-After (header first, then details)", () => {
    const body = { message: "Too many", statusCode: 429, code: "RATE_LIMITED", error: { code: "RATE_LIMITED", details: { retryAfterSeconds: 120 } } };
    expect(toApiError(responseError(429, body, { "retry-after": "900" })).retryAfterSeconds).toBe(900);
    expect(toApiError(responseError(429, body)).retryAfterSeconds).toBe(120);
  });

  it("503s are server errors", () => {
    expect(toApiError(responseError(503, {})).kind).toBe("server");
    expect(errorMessageKey(toApiError(responseError(503, {})))).toBe("errors.server");
  });

  it("409, 403, 404 and 5xx with request id", () => {
    expect(toApiError(responseError(409, { code: "ORDER_VERSION_CONFLICT" })).kind).toBe("conflict");
    expect(toApiError(responseError(403, { message: "forbidden admin only" })).kind).toBe("forbidden");
    expect(toApiError(responseError(404, { code: "ORDER_NOT_FOUND" })).kind).toBe("notFound");
    const server = toApiError(
      responseError(500, { message: "internal server error", statusCode: 500, code: "INTERNAL_ERROR", error: { code: "INTERNAL_ERROR", details: { requestId: "req-1" } } })
    );
    expect(server).toMatchObject({ kind: "server", requestId: "req-1" });
  });

  it("network failure and timeout (no response)", () => {
    expect(toApiError(new AxiosError("Network Error", "ERR_NETWORK")).kind).toBe("network");
    expect(toApiError(new AxiosError("timeout", AxiosError.ECONNABORTED)).kind).toBe("timeout");
  });
});
