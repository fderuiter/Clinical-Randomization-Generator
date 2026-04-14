import { Injectable } from '@angular/core';
import { RandomizationConfig } from '../../core/models/randomization.model';

/**
 * Generates a formal, human-readable "Randomization Plan & Specifications"
 * narrative from a {@link RandomizationConfig}.  The narrative is language-
 * agnostic; helper methods provide formatted versions suitable for embedding
 * in CSV comments, JSON metadata, PDF documents, and R/Python/SAS scripts.
 */
@Injectable({ providedIn: 'root' })
export class MethodologySpecificationService {

  // ---------------------------------------------------------------------------
  // Narrative generation
  // ---------------------------------------------------------------------------

  /**
   * Builds the full methodology narrative as a plain string with paragraphs
   * separated by a single blank line (`\n\n`).
   */
  generateNarrative(config: RandomizationConfig): string {
    const paragraphs: string[] = [];

    // 1. Core algorithm description
    const hasStrata = (config.strata || []).length > 0;
    if (hasStrata) {
      paragraphs.push(
        'This clinical trial randomization schema employs stratified block ' +
        'randomization utilizing a seeded pseudo-random number generator (PRNG) ' +
        'to ensure reproducibility. A Fisher-Yates shuffle algorithm is applied ' +
        'within each block to produce an unpredictable treatment allocation sequence.'
      );
    } else {
      paragraphs.push(
        'This clinical trial randomization schema employs block randomization ' +
        'utilizing a seeded pseudo-random number generator (PRNG) to ensure ' +
        'reproducibility. A Fisher-Yates shuffle algorithm is applied within each ' +
        'block to produce an unpredictable treatment allocation sequence.'
      );
    }

    // 2. Block size strategy
    paragraphs.push(this.buildBlockNarrative(config));

    // 3. Stratification factors
    paragraphs.push(this.buildStratificationNarrative(config));

    // 4. Cap strategy
    paragraphs.push(this.buildCapStrategyNarrative(config));

    // 5. Reproducibility / seed
    paragraphs.push(
      `Reproducibility: The PRNG seed "${config.seed || ''}" is used to initialize ` +
      'the random number generator. Executing the provided analysis scripts with this ' +
      'identical seed value will reproduce this exact randomization schema.'
    );

    return paragraphs.join('\n\n');
  }

  // ---------------------------------------------------------------------------
  // Format helpers
  // ---------------------------------------------------------------------------

  /**
   * Wraps the narrative in a labelled section and prefixes every line with
   * the given single-character line-comment marker (e.g. `#` for R/Python).
   * The result is ready to embed directly in an R or Python source file.
   */
  formatAsLineComments(narrative: string, prefix = '#'): string {
    const divider = `${prefix} ${'─'.repeat(65)}`;
    const header  = `${prefix} RANDOMIZATION PLAN & SPECIFICATIONS`;
    const lines   = narrative
      .split('\n')
      .map(line => (line.trim() === '' ? prefix : `${prefix} ${line}`));
    return [divider, header, divider, ...lines, divider].join('\n');
  }

  /**
   * Wraps the narrative in a slash-star block comment suitable for SAS.
   * Each line is wrapped individually to keep line lengths manageable.
   */
  formatAsSasComment(narrative: string): string {
    const divider = '/* ' + '─'.repeat(63) + ' */';
    const header  = '/* RANDOMIZATION PLAN & SPECIFICATIONS */';
    const lines   = narrative
      .split('\n')
      .map(line => (line.trim() === '' ? '/*' + ' */'.padStart(65) : `/* ${line} */`));
    return [divider, header, divider, ...lines, divider].join('\n');
  }

  /**
   * Prefixes every line (and paragraph) of the narrative with `# ` so it can
   * be embedded as commented-out rows at the top of a CSV file.
   * A labelled section header is prepended.
   */
  formatForCsv(narrative: string): string {
    const lines = [
      '# --- RANDOMIZATION PLAN & SPECIFICATIONS ---',
      ...narrative.split('\n').map(line => (line.trim() === '' ? '#' : `# ${line}`)),
      '# --------------------------------------------',
    ];
    return lines.join('\n');
  }

  // ---------------------------------------------------------------------------
  // Private paragraph builders
  // ---------------------------------------------------------------------------

  private buildBlockNarrative(config: RandomizationConfig): string {
    const strategy    = config.globalBlockStrategy;
    const effectiveSizes = (strategy?.sizes ?? config.blockSizes ?? []);
    const sizesStr    = effectiveSizes.join(', ');

    let text: string;

    if (strategy) {
      if (strategy.selectionType === 'RANDOM_POOL') {
        text =
          `Block Size Strategy: Block sizes are randomly selected from the pool ` +
          `[${sizesStr}] at the start of each block (Block Selection Mode: RANDOM_POOL). ` +
          `This variable-block approach means the next treatment assignment cannot ` +
          `be predicted from the preceding sequence, providing an additional layer of ` +
          `protection against selection bias.`;
      } else {
        text =
          `Block Size Strategy: Block sizes are applied in a fixed sequence ` +
          `[${sizesStr}] (Block Selection Mode: FIXED_SEQUENCE), cycling back to the ` +
          `first size when the sequence is exhausted.`;
      }
      if (strategy.limits && Object.keys(strategy.limits).length > 0) {
        const limitsStr = Object.entries(strategy.limits)
          .map(([k, v]) => `size ${k} (max ${v} uses)`)
          .join(', ');
        text += ` Block-size usage limits are enforced: ${limitsStr}.`;
      }
    } else if (effectiveSizes.length === 1) {
      text =
        `Block Size Strategy: A fixed block size of ${effectiveSizes[0]} is used ` +
        `uniformly throughout the trial.`;
    } else {
      text =
        `Block Size Strategy: Block sizes are randomly selected from the pool ` +
        `[${sizesStr}] at the start of each block to prevent selection bias.`;
    }

    return text;
  }

  private buildStratificationNarrative(config: RandomizationConfig): string {
    const strata = config.strata || [];
    if (strata.length === 0) {
      return (
        'Stratification Factors: None. The trial is treated as a single ' +
        'unstratified population; all subjects share one allocation pool.'
      );
    }
    const factorDescriptions = strata.map(s => {
      const name   = s.name || s.id;
      const levels = (s.levels || []).join(', ');
      return `${name} [${levels}]`;
    });
    return (
      `Stratification Factors (${strata.length}): ` +
      factorDescriptions.join('; ') +
      '. Randomization is performed independently within each unique combination ' +
      'of these stratification factor levels, ensuring balanced allocation across all strata.'
    );
  }

  private buildCapStrategyNarrative(config: RandomizationConfig): string {
    const strategy = config.capStrategy ?? 'MANUAL_MATRIX';
    const strata   = config.strata || [];

    if (strategy === 'PROPORTIONAL') {
      const globalCapPart = config.globalCap !== undefined
        ? ` The global enrollment cap per site is set to ${config.globalCap} subjects.`
        : '';
      const pctLines = strata.map(s => {
        const detailByName = new Map((s.levelDetails ?? []).map(d => [d.name, d]));
        const parts = s.levels
          .map(lvl => {
            const pct = detailByName.get(lvl)?.targetPercentage;
            return pct !== undefined ? `${lvl} = ${pct}%` : null;
          })
          .filter(Boolean) as string[];
        return parts.length ? `${s.name || s.id}: ${parts.join(', ')}` : null;
      }).filter(Boolean) as string[];
      const pctPart = pctLines.length
        ? ` Target level proportions - ${pctLines.join('; ')}.`
        : '';
      return (
        'Enrollment Cap Strategy: PROPORTIONAL. Per-stratum enrollment caps are ' +
        'computed automatically using the Largest Remainder Method (LRM) from ' +
        'user-supplied target percentages per factor level. Intersection caps are ' +
        `derived from these proportions and are not specified manually.${globalCapPart}${pctPart}`
      );
    }

    if (strategy === 'MARGINAL_ONLY') {
      const marginalLines = strata.map(s => {
        const detailByName = new Map((s.levelDetails ?? []).map(d => [d.name, d]));
        const parts = s.levels
          .map(lvl => {
            const cap = detailByName.get(lvl)?.marginalCap;
            return cap !== undefined ? `${lvl} = ${cap}` : null;
          })
          .filter(Boolean) as string[];
        return parts.length ? `${s.name || s.id}: ${parts.join(', ')}` : null;
      }).filter(Boolean) as string[];
      const capPart = marginalLines.length
        ? ` Per-level marginal caps - ${marginalLines.join('; ')}.`
        : '';
      return (
        'Enrollment Cap Strategy: MARGINAL_ONLY. Enrollment is controlled using ' +
        'per-factor, per-level marginal caps rather than explicit intersection caps. ' +
        'As each level cap is reached, affected stratum combinations are removed ' +
        `from the active allocation pool, allowing the algorithm to terminate naturally.${capPart}`
      );
    }

    // MANUAL_MATRIX (default)
    const capCount = (config.stratumCaps || []).length;
    return (
      'Enrollment Cap Strategy: MANUAL_MATRIX. Enrollment caps are defined ' +
      `explicitly for each stratum combination (${capCount} intersection ` +
      `cap${capCount !== 1 ? 's' : ''} configured). Each cap specifies the ` +
      'maximum number of subjects to be enrolled within that exact combination ' +
      'of stratification factor levels.'
    );
  }
}
