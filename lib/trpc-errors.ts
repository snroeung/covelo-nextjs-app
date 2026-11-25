/**
 * True only for failures that mean an upstream provider / service is unreachable —
 * a network error (no HTTP response) or a 5xx from our own API (which includes a
 * rethrown Duffel outage or a timeout, surfaced as INTERNAL_SERVER_ERROR). Returns
 * false for 4xx client/validation errors (BAD_REQUEST, NOT_FOUND incl. a flag being
 * off, UNAUTHORIZED, …) so those don't raise the "trouble reaching our providers" alarm.
 *
 * Structural (not `instanceof TRPCClientError`) so it's trivially testable: a tRPC
 * client error carries `error.data.httpStatus`; a raw fetch failure is an Error with none.
 */
export function isProviderOutage(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const httpStatus = (error as { data?: { httpStatus?: number } }).data?.httpStatus;
  // No httpStatus → the request never got a response: treat a real Error as an outage.
  if (httpStatus == null) return error instanceof Error;
  return httpStatus >= 500;
}
