/**
 * Thrown when request parameters are not well-formed. Handlers catch this
 * and turn it into a 400 Bad Request response.
 */
export class ValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
