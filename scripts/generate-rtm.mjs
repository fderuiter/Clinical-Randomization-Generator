#!/usr/bin/env node
/**
 * generate-rtm.mjs
 *
 * Automated Requirements Traceability Matrix (RTM) generator.
 *
 * This script:
 *  1. Scans Vitest unit-test spec files and Playwright E2E spec files for
 *     requirement tags in the format  // [REQ-XXX-YYY-NNN]
 *     placed immediately before a `test(` or `it(` call.
 *  2. Optionally reads Vitest JSON reporter output and Playwright JSON report
 *     to enrich each row with a PASS / FAIL / UNKNOWN status.
 *  3. Emits  Validation_Traceability_Matrix.md  in the repository root.
 *
 * Usage (CI):
 *   node scripts/generate-rtm.mjs \
 *     [--vitest-results path/to/vitest-results.json] \
 *     [--playwright-results path/to/playwright-results.json] \
 *     [--out Validation_Traceability_Matrix.md]
 *
 * @regulatory RTM_GENERATION
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, relative, resolve, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync, statSync } from 'fs';

// ── CLI arg parsing ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};

const vitestResultsPath  = getArg('--vitest-results')     ?? null;
const playwrightResultsPath = getArg('--playwright-results') ?? null;
const outputPath         = getArg('--out')                 ?? 'Validation_Traceability_Matrix.md';

const __filename = fileURLToPath(import.meta.url);
const repoRoot   = join(__filename, '..', '..');

// ── Regulatory requirements catalogue ─────────────────────────────────────────

/** Mapping of requirement IDs to their descriptions. */
const REQUIREMENTS = {
  'REQ-ICH-E9-001': 'Randomization algorithm must be deterministic and reproducible from a fixed PRNG seed (ICH E9 §2.3)',
  'REQ-ICH-E9-002': 'Stratification factors must be applied correctly to the randomization schedule (ICH E9 §2.3.3)',
  'REQ-ICH-E9-003': 'Block randomization must respect declared block sizes and produce balanced allocations (ICH E9 §2.3.4)',
  'REQ-ICH-E6-001': 'GCP – Subject IDs must be unique and fully traceable to site and block (ICH E6 §4.9)',
  'REQ-ICH-E6-002': 'Site information must be captured and present in all exported records (ICH E6 §4.1)',
  'REQ-21CFR11-001': '21 CFR Part 11 – All electronic records must embed the application semantic version',
  'REQ-21CFR11-002': '21 CFR Part 11 – Electronic records must carry an ISO 8601 generation timestamp',
  'REQ-21CFR11-003': '21 CFR Part 11 – The unique protocol identifier must appear in every generated artifact',
  'REQ-21CFR11-004': '21 CFR Part 11 – Audit trail must record the exact PRNG seed used for schema generation',
  'REQ-21CFR11-005': '21 CFR Part 11 – PDF/XLSX exports must embed a SHA-256 audit hash for integrity verification',
  'REQ-21CFR11-006': '21 CFR Part 11 – PDF audit artifact must embed version, timestamp, protocol ID and PRNG seed',
  'REQ-ZERO-TRUST-001': 'No subject or schema data may be transmitted to external servers (zero-trust architecture)',
  'REQ-SBOM-001': 'A Software Bill of Materials (SBOM) must be generated for every production build',
  'REQ-EXPORT-001': 'CSV/XLSX export filename must contain an 8-digit date component for per-generation traceability',
  'REQ-EXPORT-002': 'PDF export must trigger a file download containing a properly named randomization artifact',
  'REQ-EXPORT-003': 'Excel export must produce a two-sheet workbook (Schema + Audit & Configuration)',
};

// ── File discovery ─────────────────────────────────────────────────────────────

/**
 * Recursively collects all *.spec.ts files under `dir`.
 * @param {string} dir
 * @returns {string[]}
 */
function findSpecFiles(dir) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      results.push(...findSpecFiles(full));
    } else if (entry.endsWith('.spec.ts')) {
      results.push(full);
    }
  }
  return results;
}

const unitSpecFiles = findSpecFiles(join(repoRoot, 'src'));
const e2eSpecFiles  = findSpecFiles(join(repoRoot, 'tests_e2e'));
const allSpecFiles  = [...unitSpecFiles, ...e2eSpecFiles];

// ── Tag extraction ─────────────────────────────────────────────────────────────

/**
 * @typedef {{ reqId: string; testName: string; file: string; line: number; suite: string }} TagEntry
 */

/** Pattern that matches `// [REQ-ICH-E9-001]` (with optional whitespace).
 *
 * Two alternatives are required because requirement IDs span two formats:
 *
 *  FOUR-segment IDs (category uses a hyphenated sub-prefix):
 *    REQ-ICH-E9-001, REQ-ICH-E6-001, REQ-ZERO-TRUST-001
 *
 *  THREE-segment IDs (category is a single compact token):
 *    REQ-21CFR11-001, REQ-SBOM-001, REQ-EXPORT-001
 *
 * The 4-segment alternative is listed first so the regex engine tries the
 * longer match before falling back to the shorter one, preventing partial
 * matches on the 3-segment prefix of a 4-segment ID.
 */
const FOUR_SEG = '[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+';
const THREE_SEG = '[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+';
const TAG_RE = new RegExp(`\\/\\/\\s*\\[(${FOUR_SEG}|${THREE_SEG})\\]`, 'g');
/** Pattern to capture the immediately following test/it call's description. */
const TEST_NAME_RE = /(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/;
/** Pattern to capture describe block name. */
const DESCRIBE_RE = /(?:test\.describe|describe)\s*\(\s*['"`]([^'"`]+)['"`]/;

/**
 * Parse a spec file and return all tagged entries found.
 * @param {string} filePath
 * @returns {TagEntry[]}
 */
function extractTags(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines   = content.split('\n');
  const rel     = relative(repoRoot, filePath).replace(/\\/g, '/');
  const entries = [];

  // Maintain a stack of active describe block names.
  const suiteStack = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track describe / suite block starts
    const describeMatch = line.match(DESCRIBE_RE);
    if (describeMatch) {
      suiteStack.push(describeMatch[1]);
    }
    // Very simplistic brace tracking to pop suite stack on closing '});'
    // Best-effort: a line that is purely `});` or `})` is treated as the end
    // of the most-recently-opened describe block.
    //
    // Known limitation: this heuristic will also fire on closing braces from
    // other `});` patterns (e.g., arrow-function arguments, object literals).
    // For accurate suite attribution, use a proper AST parser. The current
    // implementation provides reasonable accuracy for standard test files.
    if (/^\s*\}\s*\)\s*;?\s*$/.test(line) && suiteStack.length > 0) {
      suiteStack.pop();
    }

    const currentSuite = suiteStack[suiteStack.length - 1] ?? '';

    // Scan for REQ tags
    let tagMatch;
    const tagRe = new RegExp(TAG_RE.source, 'g');
    while ((tagMatch = tagRe.exec(line)) !== null) {
      const reqId = tagMatch[1];

      // Look ahead for the test name on the same or next few lines
      let testName = '(unnamed test)';
      for (let j = i; j <= Math.min(i + 5, lines.length - 1); j++) {
        const nameMatch = lines[j].match(TEST_NAME_RE);
        if (nameMatch) {
          testName = nameMatch[1];
          break;
        }
      }

      entries.push({
        reqId,
        testName,
        file: rel,
        line: i + 1,
        suite: currentSuite,
      });
    }
  }

  return entries;
}

/** @type {TagEntry[]} */
const allEntries = allSpecFiles.flatMap(extractTags);

// ── Test result enrichment ─────────────────────────────────────────────────────

/** @type {Map<string, 'PASS'|'FAIL'|'SKIP'>} */
const testStatusMap = new Map();

if (vitestResultsPath && existsSync(vitestResultsPath)) {
  try {
    const raw = JSON.parse(readFileSync(vitestResultsPath, 'utf-8'));
    // Vitest JSON output: { testResults: [{ testFilePath, assertionResults: [{ fullName, status }] }] }
    for (const suite of (raw.testResults ?? [])) {
      for (const result of (suite.assertionResults ?? [])) {
        testStatusMap.set(result.fullName, result.status === 'passed' ? 'PASS' : result.status === 'skipped' ? 'SKIP' : 'FAIL');
      }
    }
  } catch (e) {
    console.warn('[generate-rtm] Could not parse Vitest results:', e.message);
  }
}

if (playwrightResultsPath && existsSync(playwrightResultsPath)) {
  try {
    const raw = JSON.parse(readFileSync(playwrightResultsPath, 'utf-8'));
    // Playwright JSON: { suites: [{ specs: [{ title, tests: [{ results: [{ status }] }] }] }] }
    function walkPWSuites(suites, prefix = '') {
      for (const suite of (suites ?? [])) {
        const title = prefix ? `${prefix} > ${suite.title}` : suite.title;
        for (const spec of (suite.specs ?? [])) {
          const lastResult = spec.tests?.[0]?.results?.slice(-1)?.[0];
          const status = lastResult?.status === 'passed' ? 'PASS' : lastResult?.status === 'skipped' ? 'SKIP' : 'FAIL';
          testStatusMap.set(`${title} > ${spec.title}`, status);
          testStatusMap.set(spec.title, status);
        }
        walkPWSuites(suite.suites, title);
      }
    }
    walkPWSuites(raw.suites);
  } catch (e) {
    console.warn('[generate-rtm] Could not parse Playwright results:', e.message);
  }
}

/**
 * Resolve test status for an entry.
 * @param {TagEntry} entry
 * @returns {'✅ PASS'|'❌ FAIL'|'⏭️ SKIP'|'⬜ UNKNOWN'}
 */
function resolveStatus(entry) {
  // Try exact match, then partial
  for (const [key, status] of testStatusMap.entries()) {
    if (key.includes(entry.testName)) {
      return status === 'PASS' ? '✅ PASS' : status === 'SKIP' ? '⏭️ SKIP' : '❌ FAIL';
    }
  }
  return '⬜ UNKNOWN';
}

// ── Markdown generation ────────────────────────────────────────────────────────

const now = new Date().toISOString();
const hasResults = testStatusMap.size > 0;

/** Group entries by requirement ID */
/** @type {Map<string, TagEntry[]>} */
const byReq = new Map();

for (const entry of allEntries) {
  if (!byReq.has(entry.reqId)) byReq.set(entry.reqId, []);
  byReq.get(entry.reqId).push(entry);
}

// Also include requirements from the catalogue that have no tagged tests yet
for (const reqId of Object.keys(REQUIREMENTS)) {
  if (!byReq.has(reqId)) byReq.set(reqId, []);
}

/** Sort requirement IDs: ICH-E9 → ICH-E6 → 21CFR11 → others */
const sortedReqIds = [...byReq.keys()].sort();

// ── Compute coverage summary ───────────────────────────────────────────────────
const totalReqs      = sortedReqIds.length;
const coveredReqs    = sortedReqIds.filter(id => (byReq.get(id) ?? []).length > 0).length;
const totalTests     = allEntries.length;

let lines = [];

lines.push(`# Validation Traceability Matrix`);
lines.push('');
lines.push(`> **Generated:** ${now}  `);
lines.push(`> **Status:** ${hasResults ? 'Test results loaded' : 'Test results not provided — status shown as UNKNOWN'}  `);
lines.push(`> **Requirements covered:** ${coveredReqs} / ${totalReqs}  `);
lines.push(`> **Tagged test cases:** ${totalTests}  `);
lines.push('');
lines.push('---');
lines.push('');
lines.push('## Summary');
lines.push('');
lines.push('| Metric | Value |');
lines.push('|---|---|');
lines.push(`| Total regulatory requirements | ${totalReqs} |`);
lines.push(`| Requirements with ≥1 test | ${coveredReqs} |`);
lines.push(`| Requirements with no test coverage | ${totalReqs - coveredReqs} |`);
lines.push(`| Total tagged test cases | ${totalTests} |`);
lines.push('');
lines.push('---');
lines.push('');
lines.push('## Traceability Matrix');
lines.push('');
lines.push('| Requirement ID | Description | Test File | Line | Test Name | Suite | Status |');
lines.push('|---|---|---|---|---|---|---|');

for (const reqId of sortedReqIds) {
  const entries = byReq.get(reqId) ?? [];
  const desc    = REQUIREMENTS[reqId] ?? '*(undocumented requirement)*';
  if (entries.length === 0) {
    lines.push(`| \`${reqId}\` | ${desc} | — | — | *(no tests tagged)* | — | ⚠️ NO COVERAGE |`);
  } else {
    for (const entry of entries) {
      const status = resolveStatus(entry);
      // Escape backslashes first, then pipe characters so Markdown table cells render correctly.
      const safeTest  = entry.testName.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
      const safeSuite = entry.suite.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
      lines.push(`| \`${reqId}\` | ${desc} | \`${entry.file}\` | ${entry.line} | ${safeTest} | ${safeSuite} | ${status} |`);
    }
  }
}

lines.push('');
lines.push('---');
lines.push('');
lines.push('## Regulatory References');
lines.push('');
lines.push('| Tag Prefix | Regulatory Source |');
lines.push('|---|---|');
lines.push('| `REQ-ICH-E9` | ICH E9 – Statistical Principles for Clinical Trials |');
lines.push('| `REQ-ICH-E6` | ICH E6(R2) – Good Clinical Practice (GCP) |');
lines.push('| `REQ-21CFR11` | 21 CFR Part 11 – Electronic Records; Electronic Signatures |');
lines.push('| `REQ-ZERO-TRUST` | Equipose Zero-Trust Architecture Requirement |');
lines.push('| `REQ-SBOM` | Supply-Chain Security – Software Bill of Materials |');
lines.push('| `REQ-EXPORT` | Export Artifact Provenance Requirements |');
lines.push('');
lines.push('---');
lines.push('');
lines.push('## SAS & Stata Cross-Environment Note');
lines.push('');
lines.push('Mathematical result validation for SAS and Stata is deferred to the end-user ');
lines.push('environment per the formal Exception Report. See `docs/SAS_Stata_Exception_Report.md`.');
lines.push('');
lines.push('Static syntax validation of generated SAS scripts is automated in CI via the ');
lines.push('`sas_static_validation` job (`scripts/validate-sas-syntax.mjs`). ');
lines.push('See `docs/adr/0001-sas-static-validation-strategy.md` for the validation strategy ADR.');
lines.push('');

const markdown = lines.join('\n');
const resolvedOutputPath = isAbsolute(outputPath) ? outputPath : join(repoRoot, outputPath);
writeFileSync(resolvedOutputPath, markdown, 'utf-8');
console.log(`[generate-rtm] Wrote ${resolvedOutputPath} (${coveredReqs}/${totalReqs} requirements covered, ${totalTests} tagged tests)`);
