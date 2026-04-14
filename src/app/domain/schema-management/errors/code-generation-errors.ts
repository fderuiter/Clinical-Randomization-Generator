import { RandomizationConfig } from '../../core/models/randomization.model';

/** Base error for all code-generation pipeline failures. */
export class CodeGenerationError extends Error {
  readonly context: Partial<RandomizationConfig> | null;

  constructor(message: string, context: Partial<RandomizationConfig> | null = null) {
    super(message);
    this.name = 'CodeGenerationError';
    this.context = context;
    // Restore prototype chain so `instanceof` checks work after TypeScript transpilation.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when the target-language template string assembly fails. */
export class TemplateCompilationError extends CodeGenerationError {
  constructor(language: string, cause: unknown, context: Partial<RandomizationConfig> | null = null) {
    super(
      `Failed to compile ${language} template. ${cause instanceof Error ? cause.message : String(cause)}`,
      context
    );
    this.name = 'TemplateCompilationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when the strata or stratumCaps matrices are malformed or missing expected properties. */
export class StrataParsingError extends CodeGenerationError {
  constructor(language: string, cause: unknown, context: Partial<RandomizationConfig> | null = null) {
    super(
      `Failed to parse strata levels for ${language} output. Ensure all stratification factors have valid alphanumeric IDs. ${cause instanceof Error ? cause.message : String(cause)}`,
      context
    );
    this.name = 'StrataParsingError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when an unrecognised language value is passed into the generator. */
export class UnsupportedLanguageError extends CodeGenerationError {
  constructor(language: string, context: Partial<RandomizationConfig> | null = null) {
    super(`Unsupported output language: "${language}". Expected R, SAS, Python, or STATA.`, context);
    this.name = 'UnsupportedLanguageError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when reproducible code generation is attempted without a PRNG seed. */
export class MissingSeedError extends CodeGenerationError {
  constructor(language: string, context: Partial<RandomizationConfig> | null = null) {
    super(`Missing valid PRNG seed for ${language} compilation. Configure a seed value to generate reproducible scripts.`, context);
    this.name = 'MissingSeedError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when the RandomizationConfig object fails pre-flight validation. */
export class ConfigurationValidationError extends CodeGenerationError {
  constructor(detail: string, context: Partial<RandomizationConfig> | null = null) {
    super(`Configuration validation failed: ${detail}`, context);
    this.name = 'ConfigurationValidationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
