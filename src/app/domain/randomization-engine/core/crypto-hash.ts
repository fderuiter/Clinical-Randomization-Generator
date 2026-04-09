import { GeneratedSchema, RandomizationConfig, RandomizationResult } from '../../core/models/randomization.model';

/**
 * Recursively sort the keys of a plain object alphabetically so that JSON
 * serialisation is always deterministic regardless of property-insertion order.
 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * Produce a deterministic JSON string for the fields of a
 * {@link RandomizationResult} that must be covered by the audit hash.
 *
 * The `auditHash` field itself is excluded so that the hash can be computed
 * before it is written back into the result object.
 */
export function buildHashPayload(
  config: RandomizationConfig,
  schema: GeneratedSchema[],
  generatedAt: string
): string {
  const payload = {
    config,
    generatedAt,
    schema
  };
  return JSON.stringify(sortKeysDeep(payload));
}

/**
 * Compute a SHA-256 hex digest of the given string using the native
 * Web Crypto API (`crypto.subtle`).  This function is safe to call
 * from both the browser main thread and inside Web Workers.
 *
 * @param data - The UTF-8 string to hash.
 * @returns A 64-character lowercase hexadecimal string.
 */
export async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convenience function: compute the audit hash for a freshly generated
 * {@link RandomizationResult} (before `auditHash` has been written into it).
 */
export async function computeAuditHash(result: RandomizationResult): Promise<string> {
  const payload = buildHashPayload(
    result.metadata.config,
    result.schema,
    result.metadata.generatedAt
  );
  return sha256Hex(payload);
}
