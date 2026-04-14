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
      // Strip query strings (e.g. "?something") that Vite appends to module IDs
      // before checking the extension or resolving relative paths.
      const cleanId = id.split('?')[0];
      if (!cleanId.endsWith('.ts')) {
        return null;
      }

      let changed = false;
      const result = code.replace(
        /templateUrl:\s*['"]([^'"]+)['"]/g,
        (fullMatch, relPath: string) => {
          const htmlPath = resolve(dirname(cleanId), relPath);
          let htmlContent: string;
          try {
            htmlContent = readFileSync(htmlPath, 'utf-8');
          } catch {
            // HTML file not found - leave this occurrence unchanged.
            return fullMatch;
          }

          changed = true;
          // Escape characters that would break a template literal.
          const escaped = htmlContent
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$\{/g, '\\${');
          return `template: \`${escaped}\``;
        },
      );

      return changed ? { code: result } : null;
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
