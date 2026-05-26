#!/usr/bin/env node
/**
 * scripts/validate-sas-syntax.mjs
 *
 * Static syntax validator for Equipose-generated SAS scripts.
 *
 * This script does NOT require a licensed SAS installation.  It performs
 * lightweight structural analysis on every .sas file found under
 *   artifacts/code-generation-fixtures/
 *
 * Checks performed (see docs/adr/0001-sas-static-validation-strategy.md):
 *   1. Required header comment fields are present
 *   2. ISO 8601 timestamp is present in the "Generated At" field
 *   3. %let seed = <number>; statement is present
 *   4. Block-comment balance (every /* has a matching *\/)
 *   5. DATA step balance (every data <name>; is closed by run;)
 *   6. PROC step balance (every proc <name> is closed by run; or quit;)
 *   7. %MACRO / %MEND balance
 *
 * Exit code 0 — all files passed.
 * Exit code 1 — one or more files failed; details printed to stdout.
 */

import { readdir, readFile } from 'fs/promises';
import { join, resolve } from 'path';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const FIXTURE_ROOT = resolve(process.cwd(), 'artifacts', 'code-generation-fixtures');

const REQUIRED_HEADER_PATTERNS = [
  { label: 'title comment',        re: /\/\*\s*(Randomization Schema Generation in SAS|Randomization Schema Configuration)\s*\*\//i },
  { label: 'Protocol field',       re: /\/\*\s*Protocol:/i },
  { label: 'App Version field',    re: /\/\*\s*App Version:/i },
  { label: 'Generated At field',   re: /\/\*\s*Generated At:/i },
  { label: 'PRNG\/Algorithm field', re: /\/\*\s*(PRNG Algorithm|Algorithm):/i },
];

const ISO_TIMESTAMP_RE = /Generated At:\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/i;
const SEED_STMT_RE     = /%let\s+seed\s*=\s*-?\d+\s*;/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Remove all block comments (/* … *\/) from source before structural parsing.
 * Returns { stripped, commentCount } where commentCount is the number of
 * comment blocks removed.  Raises an error if comments are unbalanced.
 */
function stripBlockComments(src) {
  let stripped = '';
  let commentDepth = 0;
  let commentCount = 0;
  let i = 0;

  while (i < src.length) {
    if (src[i] === '/' && src[i + 1] === '*') {
      commentDepth++;
      commentCount++;
      i += 2;
      continue;
    }
    if (src[i] === '*' && src[i + 1] === '/') {
      if (commentDepth === 0) {
        throw new Error(`Unexpected comment-close "*/" at position ${i} (no matching "/*")`);
      }
      commentDepth--;
      i += 2;
      continue;
    }
    if (commentDepth === 0) {
      stripped += src[i];
    }
    i++;
  }

  if (commentDepth !== 0) {
    throw new Error(`Unclosed block comment: ${commentDepth} "/*" without matching "*/"`);
  }

  return { stripped, commentCount };
}

/**
 * Tokenise the stripped SAS source into statement tokens (split on `;`).
 * Empty tokens are discarded.
 */
function tokeniseStatements(stripped) {
  const tokens = [];
  let currentToken = '';
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < stripped.length; i++) {
    const char = stripped[i];
    if (inString) {
      currentToken += char;
      if (char === stringChar) {
        // Handle SAS doubled quotes
        if (i + 1 < stripped.length && stripped[i + 1] === stringChar) {
          currentToken += stringChar;
          i++;
        } else {
          inString = false;
        }
      }
    } else {
      if (char === '"' || char === "'") {
        inString = true;
        stringChar = char;
        currentToken += char;
      } else if (char === ';') {
        tokens.push(currentToken.trim());
        currentToken = '';
      } else {
        currentToken += char;
      }
    }
  }

  if (currentToken.trim().length > 0) {
    tokens.push(currentToken.trim());
  }

  return tokens.filter(t => t.length > 0);
}

/**
 * Validate DATA / RUN balance.
 *
 * Rules (simplified for Equipose-generated code):
 *   - `data <name>` opens a DATA step → must be closed by `run`
 *   - `run` closes the innermost open DATA or PROC step
 *   - `quit` closes the innermost open PROC step
 *
 * Returns array of error strings (empty = OK).
 */
function checkStepBalance(tokens) {
  const errors = [];
  const stack = []; // each entry: { type: 'DATA'|'PROC', name: string }

  for (const tok of tokens) {
    const upper = tok.toUpperCase();
    const words = upper.split(/\s+/);
    const first = words[0];

    if (first === 'DATA' && words[1] !== undefined) {
      // "data _null_" is also a DATA step but has special meaning — allow it
      stack.push({ type: 'DATA', name: words[1] });
    } else if (first === 'PROC' && words[1] !== undefined) {
      stack.push({ type: 'PROC', name: words[1] });
    } else if (first === 'RUN') {
      if (stack.length === 0) {
        errors.push(`Unexpected RUN statement with no open DATA/PROC step`);
      } else {
        stack.pop();
      }
    } else if (first === 'QUIT') {
      if (stack.length === 0) {
        errors.push(`Unexpected QUIT statement with no open PROC step`);
      } else {
        const top = stack[stack.length - 1];
        if (top.type !== 'PROC') {
          errors.push(`QUIT used to close a DATA step (${top.name}) — expected RUN`);
        }
        stack.pop();
      }
    }
  }

  for (const unclosed of stack) {
    errors.push(`Unclosed ${unclosed.type} step: ${unclosed.name}`);
  }

  return errors;
}

/**
 * Validate %MACRO / %MEND balance.
 * Returns array of error strings.
 */
function checkMacroBalance(tokens) {
  const errors = [];
  const stack = []; // macro names

  for (const tok of tokens) {
    const upper = tok.toUpperCase();
    const words = upper.split(/\s+/);
    const first = words[0];

    if (first === '%MACRO' && words[1] !== undefined) {
      stack.push(words[1]);
    } else if (first === '%MEND') {
      if (stack.length === 0) {
        errors.push(`Unexpected %MEND with no open %MACRO`);
      } else {
        const opened = stack.pop();
        // %mend may be anonymous ("%mend;") or named ("%mend name;")
        if (words[1] && words[1] !== opened) {
          errors.push(`%MEND name mismatch: opened "%MACRO ${opened}", closed "%MEND ${words[1]}"`);
        }
      }
    }
  }

  for (const unclosed of stack) {
    errors.push(`Unclosed %MACRO: ${unclosed}`);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Per-file validator
// ---------------------------------------------------------------------------

async function validateFile(filePath) {
  const src = await readFile(filePath, 'utf-8');
  const errors = [];

  // 1. Required header fields (checked on raw source, before stripping comments)
  for (const { label, re } of REQUIRED_HEADER_PATTERNS) {
    if (!re.test(src)) {
      errors.push(`Missing required header field: ${label}`);
    }
  }

  // 2. ISO 8601 timestamp
  const tsMatch = src.match(ISO_TIMESTAMP_RE);
  if (!tsMatch) {
    errors.push(`Missing or malformed "Generated At" ISO 8601 timestamp`);
  }

  // 3. Seed statement
  if (!SEED_STMT_RE.test(src)) {
    errors.push(`Missing "%let seed = <number>;" statement`);
  }

  // 4. Comment balance (and strip comments for subsequent checks)
  let stripped;
  try {
    const result = stripBlockComments(src);
    stripped = result.stripped;
    if (result.commentCount === 0) {
      errors.push(`No block comments found — file appears to be missing required header`);
    }
  } catch (err) {
    errors.push(`Comment balance error: ${err.message}`);
    // Can't continue with structural checks if comments are broken
    return errors;
  }

  // 5 & 6. DATA/PROC step balance
  const tokens = tokeniseStatements(stripped);
  const stepErrors = checkStepBalance(tokens);
  errors.push(...stepErrors);

  // 7. %MACRO / %MEND balance
  const macroErrors = checkMacroBalance(tokens);
  errors.push(...macroErrors);

  return errors;
}

// ---------------------------------------------------------------------------
// Directory walker
// ---------------------------------------------------------------------------

async function collectSasFiles(dir) {
  const files = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files; // directory does not exist yet (e.g. first run)
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectSasFiles(full));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.sas')) {
      files.push(full);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('SAS Static Syntax Validator');
  console.log(`  Scanning: ${FIXTURE_ROOT}`);

  const sasFiles = await collectSasFiles(FIXTURE_ROOT);

  if (sasFiles.length === 0) {
    console.error(
      '\nERROR: No .sas files found under artifacts/code-generation-fixtures/\n' +
      '       Run the code_generation_fixtures CI job first, or ensure the\n' +
      '       artifact has been downloaded to that directory.',
    );
    process.exit(1);
  }

  console.log(`  Found ${sasFiles.length} .sas file(s)\n`);

  let totalErrors = 0;
  const results = [];

  for (const file of sasFiles) {
    const relPath = file.replace(process.cwd() + '/', '');
    const errors = await validateFile(file);
    results.push({ file: relPath, errors });
    if (errors.length > 0) {
      totalErrors += errors.length;
    }
  }

  // Report
  for (const { file, errors } of results) {
    if (errors.length === 0) {
      console.log(`  ✓  ${file}`);
    } else {
      console.log(`  ✗  ${file} — ${errors.length} error(s):`);
      for (const err of errors) {
        console.log(`       - ${err}`);
      }
    }
  }

  console.log('');
  if (totalErrors > 0) {
    console.log(`SAS_SYNTAX_CHECK: FAIL — ${totalErrors} error(s) across ${results.filter(r => r.errors.length > 0).length} file(s)`);
    process.exit(1);
  } else {
    console.log(`SAS_SYNTAX_CHECK: PASS — all ${sasFiles.length} file(s) validated`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
