import { AxiosError } from "axios";

export type ApiErrorKind =
  | "network"
  | "timeout"
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "notFound"
  | "conflict"
  | "rateLimited"
  | "server"
  | "unknown";

export interface FieldError {
  field: string;
  message: string;
}

/**
 * A failed backend call, normalised from the backend's error bodies:
 *   • API errors:           { message, statusCode, code, error: { code, details } }
 *   • request validators:   { message: "Unprocessable Entity", errors: [{ field, message }] }  (login)
 *   • envelope errors:      { response: {}, message }                                            (login 401)
 *   • admin check:          { message }                                                          (403)
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  /** Stable backend code, e.g. TOKEN_EXPIRED, ORDER_VERSION_CONFLICT. */
  readonly code: string | null;
  readonly details: unknown;
  readonly fieldErrors: FieldError[];
  /** From `Retry-After` or `details.retryAfterSeconds` (429). */
  readonly retryAfterSeconds: number | null;
  /** `details.requestId` of a 5xx, for support. */
  readonly requestId: string | null;

  constructor(init: {
    kind: ApiErrorKind;
    message: string;
    status?: number | null;
    code?: string | null;
    details?: unknown;
    fieldErrors?: FieldError[];
    retryAfterSeconds?: number | null;
    requestId?: string | null;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.kind = init.kind;
    this.status = init.status ?? null;
    this.code = init.code ?? null;
    this.details = init.details ?? null;
    this.fieldErrors = init.fieldErrors ?? [];
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
    this.requestId = init.requestId ?? null;
  }
}

const kindForStatus = (status: number): ApiErrorKind => {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 409) return "conflict";
  if (status === 429) return "rateLimited";
  if (status === 400 || status === 413 || status === 415 || status === 422) return "validation";
  if (status >= 500) return "server";
  return "unknown";
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const toFieldErrors = (value: unknown): FieldError[] =>
  Array.isArray(value)
    ? value.filter(isRecord).map((entry) => ({ field: String(entry.field ?? ""), message: String(entry.message ?? "") }))
    : [];

const positiveNumber = (value: unknown): number | null => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

export const toApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error;
  if (!(error instanceof AxiosError)) {
    return new ApiError({ kind: "unknown", message: error instanceof Error ? error.message : "Unknown error" });
  }
  if (!error.response) {
    const timedOut = error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT;
    return new ApiError({ kind: timedOut ? "timeout" : "network", message: error.message });
  }

  const { status, data, headers } = error.response;
  const body = isRecord(data) ? data : {};
  const nested = isRecord(body.error) ? body.error : {};
  const code = typeof body.code === "string" ? body.code : typeof nested.code === "string" ? nested.code : null;
  const details = nested.details ?? null;
  const detailRecord = isRecord(details) ? details : {};
  const fieldErrors = toFieldErrors(detailRecord.errors).concat(toFieldErrors(body.errors));

  return new ApiError({
    kind: kindForStatus(status),
    status,
    code,
    details,
    message: typeof body.message === "string" ? body.message : error.message,
    fieldErrors,
    retryAfterSeconds: positiveNumber(headers?.["retry-after"]) ?? positiveNumber(detailRecord.retryAfterSeconds),
    requestId: typeof detailRecord.requestId === "string" ? detailRecord.requestId : null,
  });
};

/** i18n key of the user-facing message for an error kind (see locales: errors.*). */
export const errorMessageKey = (error: ApiError): string => {
  switch (error.kind) {
    case "unauthorized":
      return "auth.session.invalid";
    default:
      return `errors.${error.kind}`;
  }
};
