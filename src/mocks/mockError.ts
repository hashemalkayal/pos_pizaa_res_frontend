/** A backend AppError (status, code, message, details). */
export class MockError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: unknown = null
  ) {
    super(message);
  }
}
