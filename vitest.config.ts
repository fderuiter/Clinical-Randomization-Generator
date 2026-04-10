import { defineConfig, Plugin } from 'vitest/config';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';

/**
 * Vite transform plugin that inlines Angular `templateUrl` references so that
 * Angular's JIT compiler can process components during vitest/jsdom runs.
 *
 * Without this, Angular's JIT compiler finds bare `templateUrl` strings and
 * throws "Component not resolved: templateUrl" because Vite never fetches the
 * external HTML files.  The Angular CLI (AOT path) inlines templates at build
 * time, but vitest skips that step entirely.
 *
 * The plugin replaces, e.g.:
 *   templateUrl: './foo.component.html'
 * with:
 *   template: `<contents of foo.component.html>`
 * at Vite's transform phase, before the TypeScript source reaches Angular's
 * runtime compiler.
 */
function angularTemplateInliner(): Plugin {
  return {
    name: 'angular-template-inliner',
    transform(code: string, id: string) {
      if (!id.endsWith('.ts')) {
        return null;
      }

      const templateUrlPattern = /templateUrl:\s*['"]([^'"]+)['"]/g;
      let match: RegExpExecArray | null;
      let result = code;
      let offset = 0;

      while ((match = templateUrlPattern.exec(code)) !== null) {
        const [fullMatch, relPath] = match;
        const htmlPath = resolve(dirname(id), relPath);

        let htmlContent: string;
        try {
          htmlContent = readFileSync(htmlPath, 'utf-8');
        } catch {
          // HTML file not found — leave this occurrence unchanged.
          continue;
        }

        // Escape characters that would break a template literal.
        const escaped = htmlContent
          .replace(/\\/g, '\\\\')
          .replace(/`/g, '\\`')
          .replace(/\$\{/g, '\\${');

        const replacement = `template: \`${escaped}\``;
        const start = match.index + offset;
        const end = start + fullMatch.length;
        result = result.slice(0, start) + replacement + result.slice(end);
        offset += replacement.length - fullMatch.length;
      }

      return result === code ? null : { code: result };
    },
  };
}

export default defineConfig({
  plugins: [angularTemplateInliner()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/setup-vitest.ts'],
  },
});
