// @ts-check
const eslint = require('@eslint/js');
const {defineConfig} = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // Phase 2 (Ticket 19.B): Strict Domain Boundary Enforcement
  //
  // Rule 1 – domain/study-builder (UI) must never import from the
  //          randomization-engine internals.  Only the facade is permitted
  //          as the entry point, plus domain/core models.
  // ---------------------------------------------------------------------------
  {
    files: ['src/app/domain/study-builder/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['*/domain/randomization-engine/randomization.service*'],
              message:
                'domain/study-builder must not import RandomizationService directly. ' +
                'Use RandomizationEngineFacade instead.'
            },
            {
              group: ['*/domain/randomization-engine/core/*'],
              message:
                'domain/study-builder must not access the randomization-engine core algorithm. ' +
                'Use RandomizationEngineFacade instead.'
            },
            {
              group: ['*/domain/randomization-engine/worker/*'],
              message:
                'domain/study-builder must not access the randomization-engine worker internals. ' +
                'Use RandomizationEngineFacade instead.'
            }
          ]
        }
      ]
    }
  },

  // Rule 2 – domain/randomization-engine/core (pure algorithm) must remain
  //          free of all Angular dependencies so it is safe to import inside
  //          Web Workers and server-side rendering contexts.
  {
    files: ['src/app/domain/randomization-engine/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@angular/*'],
              message:
                'The randomization-engine core algorithm must be pure TypeScript with no Angular dependencies. ' +
                'It must be usable inside Web Workers and SSR.'
            }
          ]
        }
      ]
    }
  },

  {
    files: ['**/*.html'],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {},
  }
]);
