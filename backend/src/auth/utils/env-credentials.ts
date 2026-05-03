/**
 * Reads credential-like env values from ConfigService merge + raw process.env.
 * Trims whitespace and strips a single pair of surrounding quotes (common copy/paste mistake).
 */
export function normalizeCredential(
  ...sources: (string | undefined)[]
): string | undefined {
  for (const raw of sources) {
    if (raw == null) continue;
    let s = String(raw).trim();
    if (
      (s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'"))
    ) {
      s = s.slice(1, -1).trim();
    }
    if (s.length > 0) return s;
  }
  return undefined;
}
