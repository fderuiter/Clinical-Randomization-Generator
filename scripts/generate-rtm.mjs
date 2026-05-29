#!/usr/bin/env node
/**
 * generate-rtm.mjs
 *
 * Automated Requirements Traceability Matrix (RTM) generator.
 *
 * This script:
 *  1. Scans Vitest unit-test spec files and Playwright E2E spec files for
 *     requirement tags in the format  // [REQ-XXX-YYY-NNN]
 *  2. Parses the TypeScript AST to correctly associate requirement tags with
 *     blocks, fully supporting dynamic template string tests (e.g., test.each)
 *  3. Reads Vitest JSON reporter output and Playwright JSON report
 *     to enrich each row with a PASS / FAIL / UNKNOWN status using exact lines.
 *  4. Emits Validation_Traceability_Matrix.md, rtm.csv, and rtm.json in the
 *     repository root.
 *
 * Usage (CI):
 *   node scripts/generate-rtm.mjs \
 *     [--vitest-results path/to/vitest-results.json] \
 *     [--playwright-results path/to/playwright-results.json] \
 *     [--out Validation_Traceability_Matrix.md]
 *
 * @regulatory RTM_GENERATION
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve, isAbsolute, dirname } from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';

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
const repoRoot   = join(dirname(__filename), '..');

// ── Regulatory requirements catalogue ─────────────────────────────────────────

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

// ── AST Block Mapping ──────────────────────────────────────────────────────────

function getLine(sourceFile, pos) {
  return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
}

function findOwningNode(node, commentPos) {
  if (commentPos < node.getFullStart() || commentPos >= node.getEnd()) return null;
  // If comment is in the leading trivia, this node owns it (unless it's the root SourceFile container)
  if (commentPos < node.getStart()) {
    if (node.kind !== ts.SyntaxKind.SourceFile) return node;
  }
  let childOwner = null;
  ts.forEachChild(node, child => {
    if (!childOwner) childOwner = findOwningNode(child, commentPos);
  });
  return childOwner;
}

const fileReqBlocks = new Map();

for (const file of allSpecFiles) {
  const sourceText = readFileSync(file, 'utf-8');
  const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);
  const blocks = [];
  
  const FOUR_SEG = '[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+';
  const THREE_SEG = '[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+';
  const TAG_RE = new RegExp(`\\[(${FOUR_SEG}|${THREE_SEG})\\]`, 'g');
  
  let match;
  while ((match = TAG_RE.exec(sourceText)) !== null) {
    const reqId = match[1];
    if (!reqId.startsWith('REQ-')) continue;
    const node = findOwningNode(sourceFile, match.index);
    if (node) {
      blocks.push({
        reqId,
        startLine: getLine(sourceFile, node.getStart()),
        endLine: getLine(sourceFile, node.getEnd())
      });
    } else {
      const line = getLine(sourceFile, match.index);
      blocks.push({ reqId, startLine: line, endLine: line + 1 });
    }
  }
  const rel = relative(repoRoot, file).replace(/\\/g, '/');
  fileReqBlocks.set(rel, blocks);
}

function getReqId(file, line) {
  const blocks = fileReqBlocks.get(file);
  if (!blocks) return null;
  let best = null;
  for (const b of blocks) {
    if (line >= b.startLine && line <= b.endLine) {
      if (!best || (b.endLine - b.startLine < best.endLine - best.startLine)) {
        best = b;
      }
    }
  }
  return best ? best.reqId : null;
}

// ── Static Fallback for missing results ────────────────────────────────────────

function extractStaticTestsFallback(file) {
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  const results = [];
  
  const DESCRIBE_RE = /(?:test\.describe|describe)\s*\(\s*['"`]([^'"`]+)['"`]/;
  const TEST_NAME_RE = /(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]/;
  
  const suiteStack = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const describeMatch = line.match(DESCRIBE_RE);
    if (describeMatch) {
      suiteStack.push(describeMatch[1]);
    }
    if (/^\s*\}\s*\)\s*;?\s*$/.test(line) && suiteStack.length > 0) {
      suiteStack.pop();
    }
    
    const nameMatch = line.match(TEST_NAME_RE);
    if (nameMatch) {
      results.push({
        file: relative(repoRoot, file).replace(/\\/g, '/'),
        line: i + 1,
        suiteName: suiteStack.join(' > '),
        testName: nameMatch[1],
        status: 'UNKNOWN'
      });
    }
  }
  return results;
}

// ── Results Extraction ─────────────────────────────────────────────────────────

const executedTests = [];
let vitestLoaded = false;
let playwrightLoaded = false;

if (vitestResultsPath && existsSync(vitestResultsPath)) {
  try {
    const raw = JSON.parse(readFileSync(vitestResultsPath, 'utf-8'));
    for (const suite of (raw.testResults ?? [])) {
      const relFile = relative(repoRoot, suite.name).replace(/\\/g, '/');
      for (const result of (suite.assertionResults ?? [])) {
        const line = result.location?.line;
        const status = result.status === 'passed' ? 'PASS' : result.status === 'skipped' ? 'SKIP' : 'FAIL';
        const suiteName = result.ancestorTitles.join(' > ');
        const testName = result.title;
        executedTests.push({ file: relFile, line, suiteName, testName, status });
      }
    }
    vitestLoaded = true;
  } catch (e) {
    console.warn('[generate-rtm] Could not parse Vitest results:', e.message);
  }
}

if (playwrightResultsPath && existsSync(playwrightResultsPath)) {
  try {
    const raw = JSON.parse(readFileSync(playwrightResultsPath, 'utf-8'));
    function walkPWSuites(suites, prefix = '', file = '') {
      for (const suite of (suites ?? [])) {
        const title = prefix ? `${prefix} > ${suite.title}` : suite.title;
        const currentFile = suite.file || file;
        for (const spec of (suite.specs ?? [])) {
          const lastResult = spec.tests?.[0]?.results?.slice(-1)?.[0];
          const status = lastResult?.status === 'passed' ? 'PASS' : lastResult?.status === 'skipped' ? 'SKIP' : 'FAIL';
          let relFile = currentFile;
          if (relFile && !relFile.includes('/')) {
            const found = allSpecFiles.find(f => f.endsWith(relFile));
            if (found) relFile = relative(repoRoot, found).replace(/\\/g, '/');
          }
          executedTests.push({ file: relFile, line: spec.line, suiteName: title, testName: spec.title, status });
        }
        walkPWSuites(suite.suites, title, currentFile);
      }
    }
    walkPWSuites(raw.suites);
    playwrightLoaded = true;
  } catch (e) {
    console.warn('[generate-rtm] Could not parse Playwright results:', e.message);
  }
}

if (!vitestLoaded) {
  for (const file of unitSpecFiles) {
    executedTests.push(...extractStaticTestsFallback(file));
  }
}

if (!playwrightLoaded) {
  for (const file of e2eSpecFiles) {
    executedTests.push(...extractStaticTestsFallback(file));
  }
}

// ── Aggregation ────────────────────────────────────────────────────────────────

const byReq = new Map();
for (const reqId of Object.keys(REQUIREMENTS)) {
  byReq.set(reqId, []);
}

for (const t of executedTests) {
  if (!t.line) {
    continue;
  }
  const reqId = getReqId(t.file, t.line);
  if (reqId) {
    byReq.get(reqId).push(t);
  }
}

const sortedReqIds = [...byReq.keys()].sort();
const totalReqs = sortedReqIds.length;
const coveredReqs = sortedReqIds.filter(id => (byReq.get(id) ?? []).length > 0).length;
const totalTests = executedTests.filter(t => t.line && getReqId(t.file, t.line)).length;
const hasResults = vitestLoaded || playwrightLoaded;

// ── Generate Outputs ───────────────────────────────────────────────────────────

let lines = [];
lines.push(`# Validation Traceability Matrix\n`);
lines.push(`> **Generated:** ${new Date().toISOString()}  `);
lines.push(`> **Status:** ${hasResults ? 'Test results loaded' : 'Test results not provided — status shown as UNKNOWN'}  `);
lines.push(`> **Requirements covered:** ${coveredReqs} / ${totalReqs}  `);
lines.push(`> **Tagged test cases:** ${totalTests}  \n`);
lines.push('---');
lines.push('\n## Summary\n');
lines.push('| Metric | Value |');
lines.push('|---|---|');
lines.push(`| Total regulatory requirements | ${totalReqs} |`);
lines.push(`| Requirements with ≥1 test | ${coveredReqs} |`);
lines.push(`| Requirements with no test coverage | ${totalReqs - coveredReqs} |`);
lines.push(`| Total tagged test cases | ${totalTests} |\n`);
lines.push('---');
lines.push('\n## Traceability Matrix\n');
lines.push(`| Requirement ID | Description | Test File | Line | Test Name | Suite | Status |`);
lines.push(`|---|---|---|---|---|---|---|`);

const csvRows = [];
csvRows.push(`Requirement ID,Suite Name,Test Name,Status`);

const jsonExport = [];

for (const reqId of sortedReqIds) {
  const entries = byReq.get(reqId) ?? [];
  const desc = REQUIREMENTS[reqId] ?? '*(undocumented requirement)*';
  if (entries.length === 0) {
    lines.push(`| \`${reqId}\` | ${desc} | — | — | *(no tests tagged)* | — | ⚠️ NO COVERAGE |`);
  } else {
    for (const entry of entries) {
      const statusIcon = entry.status === 'PASS' ? '✅ PASS' : entry.status === 'SKIP' ? '⏭️ SKIP' : entry.status === 'UNKNOWN' ? '⬜ UNKNOWN' : '❌ FAIL';
      const safeTest = entry.testName.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
      const safeSuite = entry.suiteName.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
      lines.push(`| \`${reqId}\` | ${desc} | \`${entry.file}\` | ${entry.line} | ${safeTest} | ${safeSuite} | ${statusIcon} |`);
      
      const escapeCsv = (str) => `"${str.replace(/"/g, '""')}"`;
      csvRows.push(`${reqId},${escapeCsv(entry.suiteName)},${escapeCsv(entry.testName)},${entry.status}`);
      
      jsonExport.push({
        "Requirement ID": reqId,
        "Suite Name": entry.suiteName,
        "Test Name": entry.testName,
        "Status": entry.status
      });
    }
  }
}

lines.push('\n---\n');
lines.push('## Regulatory References\n');
lines.push('| Tag Prefix | Regulatory Source |');
lines.push('|---|---|');
lines.push('| `REQ-ICH-E9` | ICH E9 – Statistical Principles for Clinical Trials |');
lines.push('| `REQ-ICH-E6` | ICH E6(R2) – Good Clinical Practice (GCP) |');
lines.push('| `REQ-21CFR11` | 21 CFR Part 11 – Electronic Records; Electronic Signatures |');
lines.push('| `REQ-ZERO-TRUST` | Equipose Zero-Trust Architecture Requirement |');
lines.push('| `REQ-SBOM` | Supply-Chain Security – Software Bill of Materials |');
lines.push('| `REQ-EXPORT` | Export Artifact Provenance Requirements |\n');
lines.push('---\n');
lines.push('## SAS & Stata Cross-Environment Note\n');
lines.push('Mathematical result validation for SAS and Stata is deferred to the end-user ');
lines.push('environment per the formal Exception Report. See `docs/SAS_Stata_Exception_Report.md`.\n');
lines.push('Static syntax validation of generated SAS scripts is automated in CI via the ');
lines.push('`sas_static_validation` job (`scripts/validate-sas-syntax.mjs`). ');
lines.push('See `docs/adr/0001-sas-static-validation-strategy.md` for the validation strategy ADR.\n');

const resolvedOutputPath = isAbsolute(outputPath) ? outputPath : join(repoRoot, outputPath);
writeFileSync(resolvedOutputPath, lines.join('\n') + '\n', 'utf-8');

const rtmJsonPath = join(dirname(resolvedOutputPath), 'rtm.json');
writeFileSync(rtmJsonPath, JSON.stringify(jsonExport, null, 2), 'utf-8');

const rtmCsvPath = join(dirname(resolvedOutputPath), 'rtm.csv');
writeFileSync(rtmCsvPath, csvRows.join('\n') + '\n', 'utf-8');

console.log(`[generate-rtm] Wrote ${resolvedOutputPath}, rtm.json and rtm.csv`);
