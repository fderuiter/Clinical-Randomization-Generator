#!/usr/bin/env node
/**
 * scripts/generate-script-validation-report.mjs
 *
 * Generates a Markdown summary report of generated-script validation results
 * for all four code-generation languages (Python, R, SAS, Stata).
 *
 * Intended to run as the final step in the `script_validation_report` CI job
 * after all per-language execution/validation jobs have completed.
 *
 * Usage (CI):
 *   node scripts/generate-script-validation-report.mjs \
 *     --python-result  <success|failure|cancelled|skipped> \
 *     --r-result       <success|failure|cancelled|skipped> \
 *     --sas-result     <success|failure|cancelled|skipped> \
 *     [--fixture-root  artifacts/code-generation-fixtures] \
 *     [--out           script-validation-report.md]
 *
 * Exit code 0 always – this script is a reporter, not a gate.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

// ── CLI arg parsing ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] ?? null : null;
};

const pythonResult  = getArg('--python-result') ?? 'skipped';
const rResult       = getArg('--r-result')      ?? 'skipped';
const sasResult     = getArg('--sas-result')    ?? 'skipped';
const stataResult   = getArg('--stata-result')  ?? 'skipped';

const __filename    = fileURLToPath(import.meta.url);
const repoRoot      = resolve(__filename, '..', '..');
const fixtureRoot   = resolve(repoRoot, getArg('--fixture-root') ?? 'artifacts/code-generation-fixtures');
const outputPath    = resolve(repoRoot, getArg('--out') ?? 'script-validation-report.md');

// ── Language catalogue ─────────────────────────────────────────────────────────

/**
 * Language descriptors.
 * - ext:        file extension (without leading dot)
 * - ciJobKey:   which --*-result flag covers this language
 * - checkKind:  short description of the check performed
 * - note:       optional caveats / exceptions
 */
const LANGUAGES = [
  {
    name:     'Python',
    ext:      'py',
    ciResult: pythonResult,
    ciJobName: 'python_script_execution_check',
    checkKind: 'Execution (python3)',
    note:     null,
  },
  {
    name:     'R',
    ext:      'R',
    ciResult: rResult,
    ciJobName: 'cross_env_equivalence',
    checkKind: 'Execution (Rscript) + cross-environment equivalence',
    note:     null,
  },
  {
    name:     'SAS',
    ext:      'sas',
    ciResult: sasResult,
    ciJobName: 'sas_static_validation',
    checkKind: 'Static syntax validation (no SAS runtime required)',
    note:     'Full execution deferred to end-user environment — see `docs/SAS_Stata_Exception_Report.md`.',
  },
  {
    name:     'Stata',
    ext:      'do',
    ciResult: stataResult,
    ciJobName: 'stata_static_validation',
    checkKind: 'Static syntax validation (no Stata runtime required)',
    note:     'Full execution deferred to end-user environment — see `docs/SAS_Stata_Exception_Report.md`.',
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Recursively collect files matching a given extension under `dir`.
 * @param {string} dir
 * @param {string} ext  lower-case extension without leading dot
 * @returns {string[]}
 */
function collectFiles(dir, ext) {
  if (!existsSync(dir)) return [];
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full, ext));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
      results.push(full);
    }
  }
  return results.sort();
}

/**
 * Return a Markdown status badge string for a CI job result.
 * @param {string} result
 * @returns {string}
 */
function statusBadge(result) {
  switch (result) {
    case 'success':     return '✅ PASS';
    case 'failure':     return '❌ FAIL';
    case 'cancelled':   return '⚠️ CANCELLED';
    case 'skipped':     return '⏭️ SKIPPED';
    case 'not-checked': return '➖ NOT CHECKED';
    default:            return `❓ ${result}`;
  }
}

/**
 * Collect manifest.json files to list scenario IDs.
 * @returns {string[]}
 */
function collectScenarios() {
  if (!existsSync(fixtureRoot)) return [];
  const scenarios = [];
  for (const entry of readdirSync(fixtureRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const manifestPath = join(fixtureRoot, entry.name, 'manifest.json');
      if (existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
          scenarios.push(manifest.scenario ?? entry.name);
        } catch {
          scenarios.push(entry.name);
        }
      } else {
        scenarios.push(entry.name);
      }
    }
  }
  return scenarios.sort();
}

// ── Report generation ──────────────────────────────────────────────────────────

const now = new Date().toISOString();
const scenarios = collectScenarios();
const fixtureRootExists = existsSync(fixtureRoot);

const lines = [];

lines.push('# Generated Script Validation Report');
lines.push('');
lines.push(`**Generated:** ${now}`);
lines.push(`**Fixture root:** \`${fixtureRoot}\``);
lines.push('');

// ── Summary table ──────────────────────────────────────────────────────────────

lines.push('## Summary');
lines.push('');
lines.push('| Language | Check type | Scripts found | Status |');
lines.push('|----------|------------|:-------------:|--------|');

const languageDetails = [];
const warnings = [];

for (const lang of LANGUAGES) {
  const files = collectFiles(fixtureRoot, lang.ext);
  const count = files.length;

  languageDetails.push({ ...lang, files, count });

  lines.push(`| ${lang.name} | ${lang.checkKind} | ${count} | ${statusBadge(lang.ciResult)} |`);

  if (lang.ciResult === 'failure') {
    warnings.push(`**${lang.name}** script check reported a failure. Review the \`${lang.ciJobName}\` job log for details.`);
  }
  if (lang.ciResult === 'cancelled') {
    warnings.push(`**${lang.name}** script check was cancelled before completing.`);
  }
  if (count === 0 && lang.ciResult !== 'not-checked' && lang.ciResult !== 'skipped') {
    warnings.push(`No **${lang.name}** scripts found in the fixture directory. The fixture export step may have failed.`);
  }
}

if (!fixtureRootExists) {
  warnings.push(`Fixture root directory not found (\`${fixtureRoot}\`). The \`code_generation_fixtures\` artifact may not have been downloaded.`);
}

const totalScripts = languageDetails.reduce((sum, l) => sum + l.count, 0);
const checkedLanguages = LANGUAGES.filter(l => l.ciResult !== 'not-checked' && l.ciResult !== 'skipped');
const passCount = checkedLanguages.filter(l => l.ciResult === 'success').length;
const failCount = checkedLanguages.filter(l => l.ciResult === 'failure').length;

lines.push('');
lines.push(`**Total scripts found:** ${totalScripts} across ${scenarios.length} scenario(s)`);
lines.push(`**Checks run:** ${checkedLanguages.length} language(s) — ${passCount} passed, ${failCount} failed`);
lines.push('');

// ── Scenarios ─────────────────────────────────────────────────────────────────

if (scenarios.length > 0) {
  lines.push('## Scenarios');
  lines.push('');
  for (const id of scenarios) {
    lines.push(`- \`${id}\``);
  }
  lines.push('');
}

// ── Per-language details ───────────────────────────────────────────────────────

lines.push('## Per-Language Details');
lines.push('');

for (const lang of languageDetails) {
  lines.push(`### ${lang.name}`);
  lines.push('');
  lines.push(`- **Check type:** ${lang.checkKind}`);
  lines.push(`- **CI job result:** ${statusBadge(lang.ciResult)}`);
  lines.push(`- **Scripts found:** ${lang.count}`);
  if (lang.note) {
    lines.push(`- **Note:** ${lang.note}`);
  }
  if (lang.files.length > 0) {
    lines.push('- **Files:**');
    for (const f of lang.files) {
      const rel = f.replace(repoRoot + '/', '').replace(repoRoot + '\\', '');
      lines.push(`  - \`${rel}\``);
    }
  }
  lines.push('');
}

// ── Warnings ──────────────────────────────────────────────────────────────────

if (warnings.length > 0) {
  lines.push('## ⚠️ Warnings');
  lines.push('');
  for (const w of warnings) {
    lines.push(`- ${w}`);
  }
  lines.push('');
}

// ── Footer ────────────────────────────────────────────────────────────────────

lines.push('---');
lines.push('');
lines.push('> **Regulatory note:** SAS and Stata execution validation is deferred to the');
lines.push('> end-user environment per the formal Exception Report.');
lines.push('> See `docs/SAS_Stata_Exception_Report.md` for details.');
lines.push('');

const markdown = lines.join('\n');

writeFileSync(outputPath, markdown, 'utf-8');
console.log(`Script validation report written to: ${outputPath}`);
console.log(`  Total scripts : ${totalScripts}`);
console.log(`  Scenarios     : ${scenarios.length}`);
console.log(`  Checks        : ${passCount}/${checkedLanguages.length} passed`);
if (warnings.length > 0) {
  console.log(`  Warnings      : ${warnings.length}`);
  for (const w of warnings) {
    console.log(`    - ${w}`);
  }
}
