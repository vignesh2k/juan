/** The pile's resting tilt for a card, in degrees (-18…17), stable per card id. */
export function tilt(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 17 + ch.charCodeAt(0)) % 997;
  return (h % 36) - 18;
}
