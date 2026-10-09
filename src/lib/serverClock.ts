/** Estimated (server time − local time), learned from API responses. */
let offset = 0;
/** Round-trip time of the sample `offset` came from; the fastest sample is the most accurate. */
let bestRtt = Infinity;

/** Current time on the server's clock (best estimate). */
export const serverNow = () => Date.now() + offset;

/**
 * Records the offset from a response's `serverNow`, assuming it was stamped at the request midpoint.
 * Keeps the sample with the smallest round trip (its midpoint guess has the least error), so a slow
 * response never makes the estimate worse. Slow samples (> 1500ms) only count when there's nothing else.
 */
export function setOffsetFromResponse(server: unknown, sentAt: number, receivedAt: number) {
  if (typeof server !== 'number' || !Number.isFinite(server)) return;
  const rtt = receivedAt - sentAt;
  if (rtt < 0 || rtt > bestRtt || (rtt > 1500 && bestRtt !== Infinity)) return;
  bestRtt = rtt;
  offset = server - (sentAt + receivedAt) / 2;
}
