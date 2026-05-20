import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('R generated-script CI wiring', () => {
  it('downloads the code-generation fixture artifact before the R verification step', () => {
    const workflow = readFileSync(resolve(repoRoot, '.github/workflows/ci.yml'), 'utf-8');

    expect(workflow).toContain('needs: [build_and_test, code_generation_fixtures]');
    expect(workflow).toContain('- name: Download code-generation fixture scripts');
    expect(workflow).toContain('name: code-generation-fixtures');
    expect(workflow).toContain('path: artifacts/code-generation-fixtures/');
    expect(workflow).toContain('Rscript scripts/cross-env/verify_r_schema.R artifacts/code-generation-fixtures');
  });

  it('bridges the R verifier to the exported UI fixture directory', () => {
    const verifier = readFileSync(resolve(repoRoot, 'scripts/cross-env/verify_r_schema.R'), 'utf-8');

    expect(verifier).toContain('artifacts", "code-generation-fixtures"');
    expect(verifier).toContain('verify_generated_scripts');
    expect(verifier).toContain('sys.source(script_path, envir = env)');
  });
});
