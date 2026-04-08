/**
 * Subject ID Templating Engine
 *
 * Parses and evaluates parameterized Subject ID masks, replacing dynamic tokens
 * with contextual values.  Supports a modern curly-brace syntax as well as the
 * legacy bracket syntax for backward compatibility.
 *
 * Supported tokens (new syntax):
 *   {SITE}        – replaced with the current site identifier
 *   {STRATUM}     – replaced with the computed stratum code
 *   {SEQ:n}       – replaced with the site-level sequence counter zero-padded
 *                   to n digits (e.g. {SEQ:4} → 0001, 0002 …)
 *   {RND:n}       – replaced with n characters of a cryptographically secure
 *                   random alphanumeric string (A-Z, 0-9)
 *   {CHECKSUM}    – replaced with a single Luhn-10 check digit computed from
 *                   all numeric characters already present in the resolved ID;
 *                   always evaluated last
 *
 * Legacy tokens (automatically normalised before evaluation):
 *   [SiteID]      → {SITE}
 *   [StratumCode] → {STRATUM}
 *   [0…01]        → {SEQ:n}  where n equals the total number of digits
 */

/** Contextual values available when resolving a single subject ID. */
export interface SubjectIdContext {
  /** The current site identifier string. */
  site: string;
  /** The pre-computed stratum code (e.g. "<65-MAL"). */
  stratumCode: string;
  /** The per-site sequential counter (1-based). */
  sequence: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const RND_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Returns a cryptographically secure random alphanumeric string of the
 * requested length using the Web Crypto API.
 */
function generateSecureRandom(length: number): string {
  const values = new Uint32Array(length);
  globalThis.crypto.getRandomValues(values);
  return Array.from(values, v => RND_CHARS[v % RND_CHARS.length]).join('');
}

/**
 * Computes a Luhn-10 check digit from the numeric characters in `id`.
 * Returns "0" when `id` contains no digits.
 */
function luhnCheckDigit(id: string): string {
  const digits = id.replace(/\D/g, '');
  if (digits.length === 0) return '0';

  let sum = 0;
  let doubleNext = true; // rightmost digit (before check) is doubled first
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (doubleNext) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    doubleNext = !doubleNext;
  }
  return String((10 - (sum % 10)) % 10);
}

/**
 * Normalises legacy bracket-style tokens to the canonical curly-brace syntax
 * so that only one code path needs to handle resolution.
 */
function normaliseLegacyTokens(mask: string): string {
  return mask
    .replace(/\[SiteID\]/g, '{SITE}')
    .replace(/\[StratumCode\]/g, '{STRATUM}')
    // [0…01] → {SEQ:n} where n = total digits (e.g. [001] → {SEQ:3})
    .replace(/\[(0*)1\]/g, (_match, zeros: string) => `{SEQ:${zeros.length + 1}}`);
}

/**
 * Performs a single resolution pass over `template`, substituting all tokens.
 * Every call to this function may yield a different `{RND:n}` value.
 */
function resolveTemplate(template: string, ctx: SubjectIdContext): string {
  let result = template;

  result = result.replace(/\{SITE\}/g, ctx.site);
  result = result.replace(/\{STRATUM\}/g, ctx.stratumCode);
  result = result.replace(/\{SEQ:(\d+)\}/g, (_m, n) =>
    ctx.sequence.toString().padStart(parseInt(n, 10), '0')
  );
  result = result.replace(/\{RND:(\d+)\}/g, (_m, n) =>
    generateSecureRandom(parseInt(n, 10))
  );

  // {CHECKSUM} must be resolved last: compute from the rest of the string
  if (result.includes('{CHECKSUM}')) {
    const withoutPlaceholder = result.replace('{CHECKSUM}', '');
    result = result.replace('{CHECKSUM}', luhnCheckDigit(withoutPlaceholder));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Maximum attempts when searching for a unique ID with {RND:n}. */
const MAX_COLLISION_ATTEMPTS = 10_000;

/**
 * Resolves a subject ID mask template into a concrete subject ID, guaranteeing
 * uniqueness within the current generation cycle via the supplied `usedIds` Set.
 *
 * When the mask contains `{RND:n}`, the function will re-roll the random
 * portion until a unique ID is found.  If no unique ID can be found within
 * {@link MAX_COLLISION_ATTEMPTS} attempts, an error is thrown.
 *
 * @param mask     Raw mask template (new or legacy syntax).
 * @param ctx      Contextual values for the current subject.
 * @param usedIds  Mutable Set that tracks all IDs assigned in this cycle.
 *                 Callers must pass the **same** Set for every subject in a
 *                 single generation run.
 * @returns        The resolved, unique subject ID string.
 */
export function resolveSubjectId(
  mask: string,
  ctx: SubjectIdContext,
  usedIds: Set<string>
): string {
  const template = normaliseLegacyTokens(mask);
  const hasRandom = /\{RND:\d+\}/.test(template);

  let id: string;
  let attempts = 0;

  do {
    id = resolveTemplate(template, ctx);
    attempts++;
    if (attempts > MAX_COLLISION_ATTEMPTS) {
      throw new Error(
        `Could not generate a unique Subject ID after ${MAX_COLLISION_ATTEMPTS} attempts. ` +
        'Consider increasing the length of the {RND:n} token.'
      );
    }
  } while (hasRandom && usedIds.has(id));

  usedIds.add(id);
  return id;
}

/**
 * Validates a subject ID mask template.
 *
 * Checks that every `{…}` token in the mask matches a known pattern.
 * Legacy bracket tokens are accepted and do not require validation because
 * they are normalised before evaluation.
 *
 * @returns An error message string when the mask is invalid, or `null` when
 *          the mask is well-formed.
 */
export function validateSubjectIdMask(mask: string): string | null {
  const normalised = normaliseLegacyTokens(mask);
  const tokenPattern = /\{([^}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(normalised)) !== null) {
    const inner = match[1];
    if (!/^(SITE|STRATUM|SEQ:\d+|RND:\d+|CHECKSUM)$/.test(inner)) {
      return `Invalid token: {${inner}}`;
    }
  }
  return null;
}

/**
 * Evaluates a mask against fixed mock data and returns a representative
 * preview string suitable for display in the configuration UI.
 *
 * @param mask  The raw mask template entered by the user.
 * @returns     `{ preview }` on success or `{ error }` on invalid syntax.
 */
export function previewSubjectId(
  mask: string
): { preview?: string; error?: string } {
  if (!mask || mask.trim() === '') {
    return { error: 'Mask is empty.' };
  }

  const validationError = validateSubjectIdMask(mask);
  if (validationError) {
    return { error: validationError };
  }

  try {
    const ctx: SubjectIdContext = {
      site: '101',
      stratumCode: 'STR',
      sequence: 1
    };
    const preview = resolveSubjectId(mask, ctx, new Set<string>());
    return { preview };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
