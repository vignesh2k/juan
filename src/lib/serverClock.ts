/** Estimated (server time − local time), learned from API responses. */
let offset = 0;

/** Current time on the server's clock (best estimate). */
export const serverNow = () => Date.now() + offset;

/** Records the offset from a response's `serverNow`, assuming it was stamped at the request midpoint. */
export function setOffsetFromResponse(server: unknown, sentAt: number, receivedAt: number) {
  if (typeof server !== 'number' || !Number.isFinite(server)) return;
  offset = server - (sentAt + receivedAt) / 2;
}
