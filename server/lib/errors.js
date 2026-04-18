export class HttpError extends Error {
  constructor(status, message, code = "HTTP_ERROR") {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

export class DatabaseUnavailableError extends HttpError {
  constructor(message = "PostgreSQL is unavailable.") {
    super(503, message, "DATABASE_UNAVAILABLE");
    this.name = "DatabaseUnavailableError";
  }
}
