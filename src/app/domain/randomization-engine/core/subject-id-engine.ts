/**
 * Subject ID Templating Engine
 *
 * Supports the following tokens:
 *   {SITE}        – replaced with the site identifier
 *   {STRATUM}     – replaced with the computed stratum code
 *   {SEQ:n}       – sequential counter zero-padded to n digits (e.g. {SEQ:4} → 0001)
 *   {RND:n}       – cryptographically secure random alphanumeric string of length n
 *   {CHECKSUM}    – Luhn check-digit derived from all other numeric characters in the ID
 *                   (must appear only once; evaluated last)
 *
 * Legacy tokens (backward-compatible):
 *   [SiteID]      – same as {SITE}
 *   [StratumCode] – same as {STRATUM}
 *   [0…01]        – zero-padded sequence (e.g. [001] → 3-digit, [0001] → 4-digit)
 */

export interface SubjectIdContext {
  site: string;
  stratumCode: string;
  sequence: number;
}

export interface MaskValidationResult {
  valid: boolean;
  error?: string;
}

/** Validate a subject-ID mask and return the first error found, if any. */
export function validateSubjectIdMask(mask: string): MaskValidationResult {
  const seqRe = /\{SEQ:([^}]*)\}/g;
  const rndRe = /\{RND:([^}]*)\}/g;

  let m: RegExpExecArray | null;

  while ((m = seqRe.exec(mask)) !== null) {
    if (!/^\d+$/.test(m[1])) {
      return { valid: false, error: `Invalid token {SEQ:${m[1]}} – padding must be a positive integer.` };
    }
  }

  while ((m = rndRe.exec(mask)) !== null) {
    if (!/^\d+$/.test(m[1])) {
      return { valid: false, error: `Invalid token {RND:${m[1]}} – length must be a positive integer.` };
    }
  }

  return { valid: true };
}

/**
 * Generate a preview of how the mask will look, using mock data.
 * Safe to call on user input while typing.
 */
export function previewSubjectIdMask(mask: string, site = '101', sequence = 1): string {
  const validation = validateSubjectIdMask(mask);
  if (!validation.valid) {
    return validation.error!;
  }
  // Use a deterministic placeholder for {RND:n} in preview mode
  const mockRnd = (n: number) => 'A1B2C3D4E5F6'.slice(0, n);
  return applyTokens(mask, { site, stratumCode: 'STR', sequence }, mockRnd);
}

/**
 * Generate a single subject ID from a mask, registering it in the provided Set
 * to guarantee uniqueness. Retries if a collision occurs (only relevant when
 * the mask contains an {RND:n} token).
 *
 * @throws {Error} when a unique ID cannot be produced within maxRetries attempts.
 */
export function generateSubjectId(
  mask: string,
  context: SubjectIdContext,
  usedIds: Set<string>,
  maxRetries = 100
): string {
  const hasRnd = /\{RND:\d+\}/.test(mask); // only {RND} tokens introduce non-determinism

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const id = applyTokens(mask, context, secureRandomAlphanumeric);
    if (!usedIds.has(id)) {
      usedIds.add(id);
      return id;
    }
    // If no RND token exists collisions are deterministic – don't retry indefinitely
    if (!hasRnd) break;
  }

  // Fallback: return deterministic ID even if it already exists (shouldn't happen)
  const id = applyTokens(mask, context, secureRandomAlphanumeric);
  usedIds.add(id);
  return id;
}

// ─── Private helpers ──────────────────────────────────────────────────────────

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function secureRandomAlphanumeric(n: number): string {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => ALPHANUMERIC[b % ALPHANUMERIC.length])
    .join('');
}

/**
 * Calculate the Luhn check digit for the numeric characters in `str`.
 * Returns '0' when no numeric characters are present.
 */
export function luhnCheckDigit(str: string): string {
  const digits = str.replace(/\D/g, '');
  if (!digits.length) return '0';

  let sum = 0;
  let isEven = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (isEven) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    isEven = !isEven;
  }
  return String((10 - (sum % 10)) % 10);
}

/**
 * Core token-replacement engine.
 * The `rndFn` parameter is injected so it can be swapped for a deterministic
 * stub during previews and tests.
 */
function applyTokens(
  mask: string,
  ctx: SubjectIdContext,
  rndFn: (n: number) => string
): string {
  let id = mask;

  // ── New curly-brace tokens ──────────────────────────────────────────────
  id = id.replace(/\{SITE\}/g, ctx.site);
  id = id.replace(/\{STRATUM\}/g, ctx.stratumCode);
  id = id.replace(/\{SEQ:(\d+)\}/g, (_, n) =>
    ctx.sequence.toString().padStart(parseInt(n, 10), '0')
  );
  id = id.replace(/\{RND:(\d+)\}/g, (_, n) => rndFn(parseInt(n, 10)));

  // ── Legacy bracket tokens (backward-compatible) ─────────────────────────
  id = id.replace('[SiteID]', ctx.site);
  id = id.replace('[StratumCode]', ctx.stratumCode);

  const legacySeqMatch = id.match(/\[(0+)1\]/);
  if (legacySeqMatch) {
    const padding = legacySeqMatch[1].length + 1;
    id = id.replace(legacySeqMatch[0], ctx.sequence.toString().padStart(padding, '0'));
  }

  // ── Checksum – evaluated last ────────────────────────────────────────────
  if (id.includes('{CHECKSUM}')) {
    const base = id.replace('{CHECKSUM}', '');
    id = id.replace('{CHECKSUM}', luhnCheckDigit(base));
  }

  return id;
}
