import { Injectable, inject } from '@angular/core';
import { RandomizationConfig, StratificationFactor } from '../../core/models/randomization.model';
import { APP_VERSION } from '../../../../environments/version';
import {
  ConfigurationValidationError,
  StrataParsingError,
  TemplateCompilationError,
  UnsupportedLanguageError,
} from '../errors/code-generation-errors';
import { MethodologySpecificationService } from './methodology-specification.service';

@Injectable({ providedIn: 'root' })
export class CodeGeneratorService {
  private readonly methodologySpec = inject(MethodologySpecificationService);
  /**
   * Upper bound (exclusive) for auto-generated seeds when the user leaves the
   * seed field empty.  Kept well within R's `set.seed()` / Python's
   * `SeedSequence` / SAS's `call streaminit` valid range (0..2^31-2).
   */
  private static readonly MAX_AUTO_SEED = 1_000_000;
  /**
   * Phase 0 – Language dispatch entry point.
   * Runs pre-flight config validation, then delegates to the appropriate generator.
   */
  generate(language: 'R' | 'SAS' | 'Python', config: RandomizationConfig): string {
    this.validateConfig(config);
    switch (language) {
      case 'R':      return this.generateR(config);
      case 'SAS':    return this.generateSas(config);
      case 'Python': return this.generatePython(config);
      default:       throw new UnsupportedLanguageError(language as string, config);
    }
  }

  /**
   * Phase 1 – Pre-flight validation.
   * Throws {@link ConfigurationValidationError} when the config is structurally
   * invalid before any template work begins.
   */
  private validateConfig(config: RandomizationConfig): void {
    if (!config.arms || config.arms.length === 0) {
      throw new ConfigurationValidationError('Arms array is empty. At least one treatment arm is required.', config);
    }
    const effectiveSizes = config.globalBlockStrategy?.sizes ?? config.blockSizes;
    if (!effectiveSizes || effectiveSizes.length === 0) {
      throw new ConfigurationValidationError('Block sizes array is empty. At least one block size is required.', config);
    }
  }

  /**
   * Returns the effective block sizes for code generation.
   * Uses `globalBlockStrategy.sizes` when the hierarchical strategy is present,
   * otherwise falls back to the flat `blockSizes` array.
   */
  private effectiveBlockSizes(config: RandomizationConfig): number[] {
    return config.globalBlockStrategy?.sizes ?? config.blockSizes ?? [];
  }

  /**
   * Builds a comment block summarising the block strategy, using the given
   * line-comment prefix (hash for R/Python; SAS callers wrap in slash-star).
   */
  private buildBlockStrategySection(prefix: string, config: RandomizationConfig): string {
    const lines: string[] = [];
    const strategy = config.globalBlockStrategy;
    if (strategy) {
      lines.push(`${prefix} Block Selection Mode: ${strategy.selectionType}`);
      if (strategy.selectionType === 'FIXED_SEQUENCE') {
        lines.push(`${prefix} Sizes are applied in order and cycle when exhausted.`);
      }
      if (strategy.limits && Object.keys(strategy.limits).length) {
        const limitStr = Object.entries(strategy.limits).map(([k, v]) => `${k}→max ${v}`).join(', ');
        lines.push(`${prefix} Usage limits: ${limitStr}`);
      }
    }
    if (config.siteBlockOverrides && Object.keys(config.siteBlockOverrides).length) {
      lines.push(`${prefix} Site-level block overrides defined for: ${Object.keys(config.siteBlockOverrides).join(', ')}`);
      lines.push(`${prefix} NOTE: Site-specific overrides are not replicated in this generated code.`);
      lines.push(`${prefix}       Apply the override logic manually for the affected sites.`);
    }
    if (config.stratumBlockOverrides && Object.keys(config.stratumBlockOverrides).length) {
      lines.push(`${prefix} Stratum-level block overrides defined for: ${Object.keys(config.stratumBlockOverrides).join(', ')}`);
      lines.push(`${prefix} NOTE: Stratum-specific overrides are not replicated in this generated code.`);
      lines.push(`${prefix}       Apply the override logic manually for the affected strata.`);
    }
    return lines.length ? lines.join('\n') : '';
  }

  /**
   * Returns true when the error is already a domain-specific error that
   * should be propagated as-is without wrapping.
   */
  private isKnownError(e: unknown): boolean {
    return (
      e instanceof StrataParsingError ||
      e instanceof ConfigurationValidationError
    );
  }

  private hashCode(str: string | undefined): number {
    // When no seed is provided the generator picks a random numeric seed.
    // The range [0, MAX_AUTO_SEED) is well within the valid seed range for
    // R set.seed(), Python SeedSequence, and SAS call streaminit (0..2^31-2).
    if (!str) return Math.floor(Math.random() * CodeGeneratorService.MAX_AUTO_SEED);
    const s = String(str);
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      const char = s.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    // Use unsigned right-shift to get a non-negative 32-bit integer, then mod into
    // R's set.seed() / Python's SeedSequence / SAS's call streaminit range (0..2^31-2).
    // Math.abs(-2147483648) === 2147483648, which exceeds the 31-bit limit; this
    // approach avoids that edge case entirely.
    return (hash >>> 0) % 2147483647;
  }

  // ---------------------------------------------------------------------------
  // Cap-strategy helpers
  // ---------------------------------------------------------------------------

  /**
   * Validates that a MARGINAL_ONLY config can guarantee the active-pool loop terminates.
   * For termination to be guaranteed, every stratum combination must include at least one
   * capped level. A sufficient condition is that at least one stratification factor has a
   * finite marginalCap on *every* one of its levels — any combo containing that factor will
   * eventually be pruned.
   * Throws {@link ConfigurationValidationError} when the guard is not met.
   */
  private validateMarginalOnlyConfig(config: RandomizationConfig): void {
    const hasFullyCappedFactor = (config.strata || []).some(s => {
      if (!s.levels || s.levels.length === 0) return false;
      const detailByName = new Map((s.levelDetails ?? []).map(d => [d.name, d]));
      return s.levels.every(lvl => {
        const detail = detailByName.get(lvl);
        return detail !== undefined && Number.isFinite(detail.marginalCap);
      });
    });
    if (!hasFullyCappedFactor) {
      throw new ConfigurationValidationError(
        'MARGINAL_ONLY cap strategy requires at least one stratification factor to define a finite ' +
        'marginalCap for every level, so every stratum combination can be deactivated and the ' +
        'active-pool loop can terminate.',
        config
      );
    }
  }

  /**
   * Returns a comment block describing the active cap strategy, formatted
   * with the given line-comment prefix (hash for R/Python; the SAS caller
   * wraps each line in slash-star delimiters separately).
   */
  private buildCapStrategySection(prefix: string, config: RandomizationConfig): string {
    const strategy = config.capStrategy ?? 'MANUAL_MATRIX';
    const lines: string[] = [];
    if (strategy === 'PROPORTIONAL') {
      lines.push(`${prefix} Cap Strategy: PROPORTIONAL (Largest Remainder Method)`);
      if (config.globalCap !== undefined) {
        lines.push(`${prefix} Global Enrollment Cap (per site): ${config.globalCap}`);
      }
      for (const s of (config.strata || [])) {
        const detailByName = new Map((s.levelDetails ?? []).map(d => [d.name, d]));
        const lvlPcts = s.levels.map(lvl => {
          const pct = detailByName.get(lvl)?.targetPercentage;
          return pct !== undefined ? `${lvl}=${pct}%` : null;
        }).filter(Boolean);
        if (lvlPcts.length) {
          lines.push(`${prefix} ${s.name}: ${lvlPcts.join(', ')}`);
        }
      }
      lines.push(`${prefix} Intersection caps below were LRM-computed from the above percentages.`);
    } else if (strategy === 'MARGINAL_ONLY') {
      lines.push(`${prefix} Cap Strategy: MARGINAL_ONLY`);
      lines.push(`${prefix} Per-factor, per-level caps; no intersection caps needed.`);
    } else {
      lines.push(`${prefix} Cap Strategy: MANUAL_MATRIX`);
      lines.push(`${prefix} Intersection caps are defined explicitly.`);
    }
    return lines.join('\n');
  }

  /**
   * Compute all strata Cartesian-product combinations from the factors.
   * Returns an array of { factorId: levelName } maps.
   */
  private computeCombinations(strata: StratificationFactor[]): Record<string, string>[] {
    let combos: Record<string, string>[] = [{}];
    for (const s of strata) {
      const next: Record<string, string>[] = [];
      for (const combo of combos) {
        for (const lvl of s.levels) {
          next.push({ ...combo, [s.id]: lvl });
        }
      }
      combos = next;
    }
    return combos.length ? combos : [{}];
  }

  // ---------------------------------------------------------------------------
  // R – MARGINAL_ONLY template
  // ---------------------------------------------------------------------------

  private buildRMarginalOnly(config: RandomizationConfig): string {
    const generatedAt = new Date().toISOString();
    const sites = config.sites || [];
    const blockSizes = this.effectiveBlockSizes(config);
    const arms = config.arms || [];
    const strata = config.strata || [];

    let rMarginalCaps: string;
    let strataLines: string;
    let strataGridArgs: string;
    try {
      rMarginalCaps = strata.map(s => {
        const entries = s.levels.map((lvl, i) => {
          const cap = s.levelDetails?.[i]?.marginalCap;
          return cap !== undefined ? `"${lvl}" = ${cap}` : null;
        }).filter(Boolean);
        return `  ${s.id} = list(${entries.join(', ')})`;
      }).join(',\n');
      strataLines = strata.map(s =>
        `${s.id}_levels <- c(${s.levels.map(l => '"' + l + '"').join(', ')})`
      ).join('\n');
      strataGridArgs = [...strata.map(s => `${s.id} = ${s.id}_levels`), 'stringsAsFactors = FALSE'].join(',\n  ');
    } catch (e) {
      throw new StrataParsingError('R', e, config);
    }

    try {
      const blockStrategySection = this.buildBlockStrategySection('#', config);
      const methodologyBlock = this.methodologySpec.formatAsLineComments(
        this.methodologySpec.generateNarrative(config), '#'
      );
      return `# Randomization Schema Generation in R
# Protocol: ${config.protocolId || 'Unknown'}
# Study: ${config.studyName || 'Unknown'}
# Generated by Equipose (equipose.org)
# App Version: ${APP_VERSION}
# Generated At: ${generatedAt}
# PRNG Algorithm: Mersenne-Twister
${this.buildCapStrategySection('#', config)}${blockStrategySection ? '\n' + blockStrategySection : ''}
${methodologyBlock}
# Subjects are allocated by randomly selecting valid stratum combinations
# until no combination can accept additional subjects.

# Set seed for reproducibility
set.seed(${this.hashCode(config.seed)})

# Parameters
sites <- c(${sites.map(s => '"' + s + '"').join(', ')})
block_sizes <- c(${blockSizes.join(', ')})

# Treatment Arms
arms <- c(${arms.map(a => '"' + a.name + '"').join(', ')})
ratios <- c(${arms.map(a => a.ratio).join(', ')})
total_ratio <- sum(ratios)

# Block Math Failsafe
if (any(block_sizes %% total_ratio != 0)) {
  stop("Block sizes must be exact multiples of the total allocation ratio.")
}

# Strata
${strataLines}

strata_grid <- expand.grid(
  ${strataGridArgs}
)
if (nrow(strata_grid) == 0) strata_grid <- data.frame(row.names = 1L)

# Marginal Caps (per factor, per level; NULL = uncapped)
marginal_caps <- list(
${rMarginalCaps}
)

# Function to generate a single block
generate_block <- function(block_size) {
  multiplier <- block_size / total_ratio
  block <- rep(arms, times = ratios * multiplier)
  sample(block) # Shuffle
}

# Generate Schema with Marginal Cap Enforcement
schema_list <- list()
row_idx <- 1

for (site in sites) {
  site_subject_count <- 0L
  block_number <- 0L

  # Per-factor, per-level enrollment counts (reset for each site)
  marginal_counts <- lapply(marginal_caps, function(mc) {
    setNames(rep(0L, length(mc)), names(mc))
  })

  # Active pool of strata combinations (those not yet exhausted)
  active_pool <- strata_grid

  while (nrow(active_pool) > 0) {
    # Randomly select a combination from the active pool
    pool_idx <- sample(nrow(active_pool), 1)
    stratum  <- active_pool[pool_idx, , drop = FALSE]

    # Pick a random block size and generate the block
    current_block_size <- sample(block_sizes, 1)
    current_block <- generate_block(current_block_size)
    block_number <- block_number + 1L

    for (treatment in current_block) {
      # Check marginal caps before enrolling this subject
      can_add <- TRUE
      for (factor_id in names(marginal_caps)) {
        level_val <- as.character(stratum[[factor_id]])
        cap_val   <- marginal_caps[[factor_id]][[level_val]]
        if (!is.null(cap_val) && marginal_counts[[factor_id]][[level_val]] >= cap_val) {
          can_add <- FALSE
          break
        }
      }
      if (!can_add) break

      site_subject_count <- site_subject_count + 1L
      subject_id <- sprintf("%s-%03d", site, site_subject_count)

      row <- data.frame(
        SubjectID   = subject_id,
        Site        = site,
        BlockNumber = block_number,
        BlockSize   = current_block_size,
        Treatment   = treatment
      )
      row <- cbind(row, stratum)
      schema_list[[row_idx]] <- row
      row_idx <- row_idx + 1L

      # Update marginal counts
      for (factor_id in names(marginal_caps)) {
        level_val <- as.character(stratum[[factor_id]])
        if (!is.null(marginal_caps[[factor_id]][[level_val]])) {
          marginal_counts[[factor_id]][[level_val]] <-
            marginal_counts[[factor_id]][[level_val]] + 1L
        }
      }
    }

    # Prune pool: remove combinations that breach any marginal cap
    keep_flags <- sapply(seq_len(nrow(active_pool)), function(i) {
      combo_row <- active_pool[i, , drop = FALSE]
      all(sapply(names(marginal_caps), function(factor_id) {
        level_val <- as.character(combo_row[[factor_id]])
        cap_val   <- marginal_caps[[factor_id]][[level_val]]
        is.null(cap_val) || marginal_counts[[factor_id]][[level_val]] < cap_val
      }))
    })
    active_pool <- active_pool[keep_flags, , drop = FALSE]
  }
}

schema <- do.call(rbind, schema_list)
if (is.null(schema) || nrow(schema) == 0) {
  base_schema <- data.frame(
    SubjectID   = character(0),
    Site        = character(0),
    BlockNumber = integer(0),
    BlockSize   = integer(0),
    Treatment   = character(0)
  )
  schema <- cbind(base_schema, strata_grid[0, , drop = FALSE])
}
print(head(schema))

if (nrow(schema) > 0) {
  cat("\\n--- QC Check: Overall Allocation ---\\n")
  print(table(schema$Treatment))

  cat("\\n--- QC Check: Site-Level Balance ---\\n")
  print(table(schema$Site, schema$Treatment))

  cat("\\n--- QC Check: Dynamic Block Utilization ---\\n")
  print(table(schema$BlockSize))
} else {
  cat("\\n--- QC Check ---\\n")
  cat("No rows generated; skipping QC tables.\\n")
}

# write.csv(schema, "randomization_schema.csv", row.names=FALSE)
`;
    } catch (e) {
      if (this.isKnownError(e)) throw e;
      throw new TemplateCompilationError('R', e, config);
    }
  }

  // ---------------------------------------------------------------------------
  // Python – MARGINAL_ONLY template
  // ---------------------------------------------------------------------------

  private buildPythonMarginalOnly(config: RandomizationConfig): string {
    const generatedAt = new Date().toISOString();
    const sites = config.sites || [];
    const blockSizes = this.effectiveBlockSizes(config);
    const arms = config.arms || [];
    const strata = config.strata || [];

    let pyMarginalCaps: string;
    let strataLevelsList: string;
    let strataNamesArr: string;
    try {
      pyMarginalCaps = strata.map(s => {
        const entries = s.levels.map((lvl, i) => {
          const cap = s.levelDetails?.[i]?.marginalCap;
          return cap !== undefined ? `        "${lvl}": ${cap}` : null;
        }).filter(Boolean);
        return `    "${s.id}": {\n${entries.join(',\n')}\n    }`;
      }).join(',\n');
      strataLevelsList = strata.map(s => `[${s.levels.map(l => '"' + l + '"').join(', ')}]`).join(',\n    ');
      strataNamesArr = strata.map(s => '"' + s.id + '"').join(', ');
    } catch (e) {
      throw new StrataParsingError('Python', e, config);
    }

    try {
      const blockStrategySection = this.buildBlockStrategySection('#', config);
      const methodologyBlock = this.methodologySpec.formatAsLineComments(
        this.methodologySpec.generateNarrative(config), '#'
      );
      return `# Randomization Schema Generation in Python
# Protocol: ${config.protocolId || 'Unknown'}
# Study: ${config.studyName || 'Unknown'}
# App Version: ${APP_VERSION}
# Generated At: ${generatedAt}
# PRNG Algorithm: PCG64
${this.buildCapStrategySection('#', config)}${blockStrategySection ? '\n' + blockStrategySection : ''}
${methodologyBlock}
# Subjects are allocated by randomly selecting valid stratum combinations
# until no combination can accept additional subjects.

import numpy as np
import itertools
import pandas as pd

# Set seed for reproducibility
rng = np.random.default_rng(${this.hashCode(config.seed)})

# Parameters
sites = [${sites.map(s => '"' + s + '"').join(', ')}]
block_sizes = [${blockSizes.join(', ')}]

# Marginal Caps (per factor, per level; missing key = uncapped)
marginal_caps = {
${pyMarginalCaps || '    # No marginal caps defined'}
}

# Treatment Arms
arms = [${arms.map(a => `{"name": "${a.name}", "ratio": ${a.ratio}}`).join(', ')}]
total_ratio = sum(arm["ratio"] for arm in arms)

# Block Math Failsafe
if any(bs % total_ratio != 0 for bs in block_sizes):
    raise ValueError("Block sizes must be exact multiples of the total allocation ratio.")

# Strata
strata_levels = [
    ${strataLevelsList}
]
strata_names = [${strataNamesArr}]
strata_combinations = list(itertools.product(*strata_levels)) if strata_levels else [()]

schema = []

for site in sites:
    site_subject_count = 0

    # Per-factor, per-level enrollment counts (reset each site)
    marginal_counts: dict[str, dict[str, int]] = {
        factor_id: {lvl: 0 for lvl in lvls}
        for factor_id, lvls in zip(strata_names, strata_levels)
    }

    # Active pool of strata combinations
    active_pool = list(strata_combinations)
    block_number = 0

    while active_pool:
        # Randomly select a combination from the active pool
        pick_idx = int(rng.integers(len(active_pool)))
        combo = active_pool[pick_idx]
        stratum = dict(zip(strata_names, combo))

        # Pick a random block size and generate the block
        current_block_size = int(rng.choice(block_sizes))
        multiplier = current_block_size // total_ratio
        block = []
        for arm in arms:
            block.extend([arm["name"]] * int(arm["ratio"] * multiplier))
        rng.shuffle(block)
        block_number += 1

        for treatment in block:
            # Check marginal caps before enrolling
            can_add = True
            for factor_id, level_val in stratum.items():
                cap = marginal_caps.get(factor_id, {}).get(level_val)
                if cap is not None and marginal_counts.get(factor_id, {}).get(level_val, 0) >= cap:
                    can_add = False
                    break
            if not can_add:
                break

            site_subject_count += 1
            subject_id = f"{site}-{site_subject_count:03d}"

            schema.append({
                "SubjectID": subject_id,
                "Site": site,
                "BlockNumber": block_number,
                "BlockSize": current_block_size,
                "Treatment": treatment,
                **stratum
            })

            # Update marginal counts
            for factor_id, level_val in stratum.items():
                if factor_id in marginal_counts:
                    marginal_counts[factor_id][level_val] = \
                        marginal_counts[factor_id].get(level_val, 0) + 1

        # Prune pool: remove combinations that breach any marginal cap
        active_pool = [
            c for c in active_pool
            if all(
                marginal_caps.get(strata_names[i], {}).get(c[i]) is None or
                marginal_counts.get(strata_names[i], {}).get(c[i], 0) <
                marginal_caps.get(strata_names[i], {}).get(c[i], 0)
                for i in range(len(strata_names))
            )
        ]

df = pd.DataFrame(schema)
print("\\n--- Generated Randomization Schema (First 5 Rows) ---")
print(df.head())

if not df.empty:
    print("\\n--- QC Check: Overall Allocation ---")
    print(df['Treatment'].value_counts())

    print("\\n--- QC Check: Site-Level Balance ---")
    print(pd.crosstab(df['Site'], df['Treatment']))

    print("\\n--- QC Check: Dynamic Block Utilization ---")
    print(df['BlockSize'].value_counts())
else:
    print("\\n--- QC Check ---")
    print("No rows generated; skipping QC tables.")

# df.to_csv("randomization_schema.csv", index=False)
`;
    } catch (e) {
      if (this.isKnownError(e)) throw e;
      throw new TemplateCompilationError('Python', e, config);
    }
  }

  // ---------------------------------------------------------------------------
  // SAS – MARGINAL_ONLY template
  // ---------------------------------------------------------------------------

  private buildSasMarginalOnly(config: RandomizationConfig): string {
    const generatedAt = new Date().toISOString();
    const sites = config.sites || [];
    const blockSizes = this.effectiveBlockSizes(config);
    const arms = config.arms || [];
    const strata = config.strata || [];
    const totalRatio = arms.reduce((s, a) => s + a.ratio, 0);

    // Compute all strata combinations (Cartesian product)
    const combos = this.computeCombinations(strata);
    const nCombos = combos.length;
    const nFactors = strata.length;

    // Assign a 1-based global level index to every (factorId, levelName) pair.
    // Using a Map avoids prototype-pollution when factor/level names are user-supplied.
    let globalIdx = 0;
    const levelIndices = new Map<string, Map<string, number>>();
    for (const s of strata) {
      const m = new Map<string, number>();
      for (const lvl of s.levels) { m.set(lvl, ++globalIdx); }
      levelIndices.set(s.id, m);
    }
    const totalLevels = Math.max(globalIdx, 1); // at least 1 to avoid zero-length arrays

    // Caps array (-1 = uncapped)
    const capsArr: number[] = new Array(totalLevels).fill(-1);
    for (const s of strata) {
      for (let i = 0; i < s.levels.length; i++) {
        const cap = s.levelDetails?.[i]?.marginalCap;
        if (cap !== undefined) {
          capsArr[(levelIndices.get(s.id)?.get(s.levels[i]) ?? 1) - 1] = cap;
        }
      }
    }

    // Combo-to-global-level-index flat mapping (row-major: combo × factor)
    const comboFidxArr: number[] = [];
    for (const combo of combos) {
      for (const s of strata) {
        comboFidxArr.push(levelIndices.get(s.id)?.get(combo[s.id] ?? s.levels[0] ?? '') ?? 1);
      }
    }

    // Per-factor character arrays mapping combo index → level name
    const factorLevelArrays = strata.map(s => ({
      id: s.id,
      values: combos.map(c => (c[s.id] ?? s.levels[0] ?? '').replace(/'/g, "''"))
    }));

    // SAS macro variable strings
    const sasSites = sites.map(s => `"${s}"`).join(' ');
    const sasArms  = arms.map(a => `"${a.name}"`).join(' ');
    const sasRatios = arms.map(a => String(a.ratio)).join(' ');
    const maxBlockSize = Math.max(...blockSizes, 1) * 2;

    // Block size selection SAS code
    let blockSizePick: string;
    if (blockSizes.length === 1) {
      blockSizePick = `    block_size = ${blockSizes[0]};`;
    } else {
      const parts = blockSizes.map((bs, i) => {
        const p = ((i + 1) / blockSizes.length).toFixed(5);
        if (i === 0) return `    if _rand_bs <= ${p} then block_size = ${bs};`;
        if (i === blockSizes.length - 1) return `    else block_size = ${bs};`;
        return `    else if _rand_bs <= ${p} then block_size = ${bs};`;
      });
      blockSizePick = `    _rand_bs = rand('Uniform');\n${parts.join('\n')}`;
    }

    // Strata variable declarations and level-dataset building
    const strataLenDecl = nFactors > 0 ? ' ' + strata.map(s => `${s.id} $50`).join(' ') : '';
    const strataLevelMacros = nFactors > 0
      ? strata.map(s => `%let ${s.id}_levels = ${s.levels.map(l => `"${l}"`).join(' ')};`).join('\n') + '\n'
      : '';
    const charArrayDecls = factorLevelArrays.map(f =>
      `  array _cvl_${f.id}[${nCombos}] $50 _temporary_ (${f.values.map(v => `'${v}'`).join(' ')});`
    ).join('\n');
    const strataAssign = factorLevelArrays.map(f =>
      `      ${f.id} = _cvl_${f.id}[_chosen];`
    ).join('\n');

    // Level-index map documentation
    const levelMapComment = strata.map(s =>
      `  /* ${s.id}: ${s.levels.map(lvl => `${lvl}->${levelIndices.get(s.id)?.get(lvl) ?? '?'}`).join(', ')} */`
    ).join('\n');

    // Cap annotations
    const capAnnotations = strata.map(s => {
      const entries = s.levels.map((lvl, i) => {
        const cap = s.levelDetails?.[i]?.marginalCap;
        return cap !== undefined ? `${lvl}=${cap}` : `${lvl}=uncapped`;
      }).join(', ');
      return `/* ${s.name}: ${entries} */`;
    }).join('\n');

    const sasMethodologyBlock = this.methodologySpec.formatAsSasComment(
      this.methodologySpec.generateNarrative(config)
    );

    let code = `/* Randomization Schema Generation in SAS */
/* Protocol: ${config.protocolId || 'Unknown'} */
/* Study: ${config.studyName || 'Unknown'} */
/* App Version: ${APP_VERSION} */
/* Generated At: ${generatedAt} */
/* PRNG Algorithm: Mersenne Twister */
/* Cap Strategy: MARGINAL_ONLY */
/* Per-factor, per-level caps; no intersection caps needed. */
/* Implementation: SAS DATA step with temporary arrays (base SAS 9.2+). */
${this.buildBlockStrategySection('#', config).split('\n').map(l => l.replace(/^#/, '/*') + ' */').join('\n').replace(/\/\*  \*\//g, '')}
${capAnnotations}
${sasMethodologyBlock}

%let seed = ${this.hashCode(config.seed)};
%let total_ratio = ${totalRatio};

/* User-defined Parameters */
%let arms = ${sasArms};
%let ratios = ${sasRatios};
%let block_sizes = ${blockSizes.join(' ')};
%let sites = ${sasSites};

/* Block Math Failsafe */
data _null_;
  _n_blocks = countw("&block_sizes.", ' ', 'q');
  do _i = 1 to _n_blocks;
    _block_size = input(scan("&block_sizes.", _i, ' ', 'q'), best.);
    if mod(_block_size, &total_ratio.) ^= 0 then do;
      call symputx('BLOCK_MATH_ERROR', 1);
      put "ERROR: Block size " _block_size " is not an exact multiple of total allocation ratio " &total_ratio. ".";
    end;
  end;
run;

%macro check_block_math;
  %if &BLOCK_MATH_ERROR. = 1 %then %do;
    %abort cancel;
  %end;
%mend check_block_math;
%check_block_math;
`;

    if (nFactors > 0) { code += '\n' + strataLevelMacros; }

    code += `
/* Configuration: ${nCombos} strata combination(s), ${nFactors} factor(s) */
%let n_combos = ${nCombos};
%let n_factors = ${nFactors};
%let max_block_size = ${maxBlockSize};

/* Level-index map (for caps array documentation): */
${levelMapComment}

/* Generate schema using DATA step with marginal cap enforcement */
data _schema_marginal;
  length SubjectID $50 Site $50 Treatment $50${strataLenDecl} _tmp_s $50 _arm $50;
  call streaminit(&seed.);

  /* Caps array (1-based index, -1 = uncapped) */
  array _caps[${totalLevels}] _temporary_ (${capsArr.join(' ')});

  /* Combo-to-level-index flat mapping: _combo_fidx[(combo-1)*n_factors + factor_pos] */
${nFactors > 0 ? `  array _combo_fidx[${comboFidxArr.length}] _temporary_ (${comboFidxArr.join(' ')});` : '  /* No strata factors defined */'}

  /* Per-factor combo level names (for output variable assignment) */
${charArrayDecls || '  /* No strata factors */'}

  /* Active pool flags and enrollment count arrays (reset per site) */
  array _active[&n_combos.] _temporary_;
  array _counts[${totalLevels}] _temporary_;

  /* Treatment block working array */
  array _blk[&max_block_size.] $50 _temporary_;

  /* Sites loop */
  _n_sites = countw("&sites.", ' ', 'q');
  do _s = 1 to _n_sites;
    Site = dequote(scan("&sites.", _s, ' ', 'q'));
    _site_subj_count = 0;
    _block_num = 0;

    /* Reset active flags and counts for each site */
    do _i = 1 to &n_combos.; _active[_i] = 1; end;
    do _i = 1 to ${totalLevels}; _counts[_i] = 0; end;
    _n_active = &n_combos.;

    do while (_n_active > 0);
      /* Randomly select an active strata combination */
      _rand_pick = floor(rand('Uniform') * _n_active) + 1;
      _seen = 0;
      _chosen = 0;
      do _i = 1 to &n_combos.;
        if _active[_i] then do;
          _seen + 1;
          if _seen = _rand_pick then do;
            _chosen = _i;
            _i = &n_combos. + 1; /* exit inner loop */
          end;
        end;
      end;
      if _chosen = 0 then leave; /* safety guard */

      /* Pick a random block size */
${blockSizePick}
      _block_num = _block_num + 1;

      /* Assign stratum output variables from the chosen combination */
${strataAssign || '      /* No strata factors */'}

      /* Build treatment block */
      _blk_n = 0;
      _n_arms = countw("&arms.", ' ', 'q');
      _multiplier = block_size / &total_ratio.;
      do _a = 1 to _n_arms;
        _arm = dequote(scan("&arms.", _a, ' ', 'q'));
        _arm_ratio = input(scan("&ratios.", _a, ' '), best.);
        do _t = 1 to round(_arm_ratio * _multiplier);
          _blk_n + 1;
          _blk[_blk_n] = _arm;
        end;
      end;

      /* Fisher-Yates shuffle */
      do _i = _blk_n to 2 by -1;
        _j = floor(rand('Uniform') * _i) + 1;
        _tmp_s = _blk[_i]; _blk[_i] = _blk[_j]; _blk[_j] = _tmp_s;
      end;

      /* Process each subject in the block */
      do _t = 1 to _blk_n;
        /* Check marginal caps before enrolling */
        _can_add = 1;
${nFactors > 0 ? `        do _f = 1 to &n_factors.;
          _lidx = _combo_fidx[(_chosen - 1) * &n_factors. + _f];
          if _caps[_lidx] >= 0 and _counts[_lidx] >= _caps[_lidx] then do;
            _can_add = 0;
            _f = &n_factors. + 1; /* exit cap-check loop */
          end;
        end;` : '        /* No strata factors: no cap check */'}
        if not _can_add then leave; /* stop block early */

        _site_subj_count + 1;
        SubjectID = cats(Site, '-', put(_site_subj_count, z3.));
        Treatment = _blk[_t];
        BlockSize = block_size;
        BlockNumber = _block_num;
        output;

        /* Update marginal enrollment counts */
${nFactors > 0 ? `        do _f = 1 to &n_factors.;
          _lidx = _combo_fidx[(_chosen - 1) * &n_factors. + _f];
          if _caps[_lidx] >= 0 then _counts[_lidx] + 1;
        end;` : '        /* No strata factors: no counts to update */'}
      end; /* block loop */

      /* Prune active pool: deactivate combinations that breach any marginal cap */
      _n_active = 0;
      do _i = 1 to &n_combos.;
        if _active[_i] then do;
          _exhausted = 0;
${nFactors > 0 ? `          do _f = 1 to &n_factors.;
            _lidx = _combo_fidx[(_i - 1) * &n_factors. + _f];
            if _caps[_lidx] >= 0 and _counts[_lidx] >= _caps[_lidx] then do;
              _exhausted = 1;
              _f = &n_factors. + 1; /* exit loop */
            end;
          end;` : '          /* No factors: pool never exhausts (add a global cap to terminate) */'}
          if _exhausted then _active[_i] = 0;
          else _n_active + 1;
        end;
      end;
    end; /* while loop */
  end; /* sites loop */

  drop _:;
run;

/* Quality Control (QC) Checks */
proc freq data=_schema_marginal;
  title "Overall Treatment Balance";
  tables Treatment / nocum;
run;

proc freq data=_schema_marginal;
  title "Site-Level Treatment Balance";
  tables Site * Treatment / nocol nopercent;
run;

proc freq data=_schema_marginal;
  title "Block Size Distribution";
  tables BlockSize / nocum;
run;

title "Randomization Schema Preview";
proc print data=_schema_marginal(obs=20);
run;
title;
`;
    return code.trim() + '\n';
  }

  generateR(config: RandomizationConfig): string {
    const generatedAt = new Date().toISOString();
    const sites = config.sites || [];
    const blockSizes = this.effectiveBlockSizes(config);
    const arms = config.arms || [];
    const strata = config.strata || [];
    const caps = config.stratumCaps || [];
    const capStrategy = config.capStrategy ?? 'MANUAL_MATRIX';

    // Branch to the marginal-only template which has entirely different generation logic.
    if (capStrategy === 'MARGINAL_ONLY') {
      this.validateMarginalOnlyConfig(config);
      return this.buildRMarginalOnly(config);
    }

    // Phase 2 – Strata parsing (localized catch)
    let rCapsVector: string;
    let strataLines: string;
    let strataGridArgs: string;
    try {
      rCapsVector = caps.map(c => `"${c.levels.join('_')}" = ${c.cap}`).join(',\n  ');
      strataLines = strata.map(s => `${s.id}_levels <- c(${(s.levels || []).map(l => '"' + l + '"').join(', ')})`).join('\n');
      strataGridArgs = [...strata.map(s => `${s.id} = ${s.id}_levels`), 'stringsAsFactors = FALSE'].join(',\n  ');
    } catch (e) {
      throw new StrataParsingError('R', e, config);
    }

    // Phase 3 – Template compilation (localized catch)
    try {
      const blockStrategySection = this.buildBlockStrategySection('#', config);
      const methodologyBlock = this.methodologySpec.formatAsLineComments(
        this.methodologySpec.generateNarrative(config), '#'
      );
      return `# Randomization Schema Generation in R
# Protocol: ${config.protocolId || 'Unknown'}
# Study: ${config.studyName || 'Unknown'}
# Generated by Equipose (equipose.org)
# App Version: ${APP_VERSION}
# Generated At: ${generatedAt}
# PRNG Algorithm: Mersenne-Twister
${this.buildCapStrategySection('#', config)}${blockStrategySection ? '\n' + blockStrategySection : ''}
${methodologyBlock}

# Set seed for reproducibility
# Note: R uses a different PRNG than the web tool, so the exact sequence will differ,
# but the statistical properties and parameters remain the same.
set.seed(${this.hashCode(config.seed)})

# Parameters
sites <- c(${sites.map(s => '"' + s + '"').join(', ')})
block_sizes <- c(${blockSizes.join(', ')})

# Stratum Caps
stratum_caps <- c(
  ${rCapsVector}
)

# Treatment Arms
arms <- c(${arms.map(a => '"' + a.name + '"').join(', ')})
ratios <- c(${arms.map(a => a.ratio).join(', ')})
total_ratio <- sum(ratios)

# Block Math Failsafe
if (any(block_sizes %% total_ratio != 0)) {
  stop("Block sizes must be exact multiples of the total allocation ratio.")
}

# Strata
${strataLines}

# Generate all strata combinations
# stringsAsFactors=FALSE is required: expand.grid() creates factor columns by default,
# which causes paste() to emit integer level codes (1, 2, ...) instead of the actual
# label strings, breaking the stratum_caps named-vector lookup below.
strata_grid <- expand.grid(
  ${strataGridArgs}
)
# If no strata are defined, expand.grid() returns 0 rows. Insert one empty row so
# the generation loop executes once (treating the whole trial as a single stratum).
if (nrow(strata_grid) == 0) strata_grid <- data.frame(row.names = 1L)

# Function to generate a single block
generate_block <- function(block_size) {
  multiplier <- block_size / total_ratio
  block <- rep(arms, times = ratios * multiplier)
  sample(block) # Shuffle
}

# Generate Schema
schema_list <- list()
row_idx <- 1

for (site in sites) {
  site_subject_count <- 0
  # seq_len() is used instead of 1:nrow() to avoid the R gotcha where 1:0 produces
  # c(1, 0) instead of an empty sequence when there are no rows.
  for (i in seq_len(nrow(strata_grid))) {
    stratum <- strata_grid[i, , drop=FALSE]
    # In the unstratified case, expand.grid() produces a 1-row, 0-column data.frame.
    # Force a scalar empty key so the stratum_caps named-vector lookup remains length-1.
    if (ncol(stratum) == 0) {
      stratum_key <- ""
    } else {
      # unlist() is required to coerce the data.frame row to a plain character vector
      # before pasting; directly pasting a data.frame can give unexpected results.
      stratum_key <- paste(unlist(stratum), collapse="_")
      if (length(stratum_key) == 0) stratum_key <- ""
    }
    max_subjects_per_stratum <- if (length(stratum_caps) > 0) unname(stratum_caps[stratum_key]) else 0
    if (is.na(max_subjects_per_stratum)) max_subjects_per_stratum <- 0

    stratum_subject_count <- 0
    block_number <- 1

    while (stratum_subject_count < max_subjects_per_stratum) {
      # Pick random block size
      current_block_size <- sample(block_sizes, 1)

      # Generate block
      current_block <- generate_block(current_block_size)

      for (treatment in current_block) {
        site_subject_count <- site_subject_count + 1
        stratum_subject_count <- stratum_subject_count + 1

        # Format Subject ID (Simplified)
        subject_id <- sprintf("%s-%03d", site, site_subject_count)

        row <- data.frame(
          SubjectID = subject_id,
          Site = site,
          BlockNumber = block_number,
          BlockSize = current_block_size,
          Treatment = treatment
        )
        row <- cbind(row, stratum)

        schema_list[[row_idx]] <- row
        row_idx <- row_idx + 1

        if (stratum_subject_count >= max_subjects_per_stratum) break
      }
      if (stratum_subject_count >= max_subjects_per_stratum) break
      block_number <- block_number + 1
    }
  }
}

schema <- do.call(rbind, schema_list)

# Guard: when no subjects were generated (e.g. all caps are 0 or sites is empty),
# do.call(rbind, list()) returns NULL. Create an empty typed data.frame so that
# downstream code (print, write.csv) does not error.
if (is.null(schema) || nrow(schema) == 0) {
  base_schema <- data.frame(
    SubjectID = character(0),
    Site = character(0),
    BlockNumber = integer(0),
    BlockSize = integer(0),
    Treatment = character(0)
  )
  schema <- cbind(base_schema, strata_grid[0, , drop=FALSE])
}
print(head(schema))

if (nrow(schema) > 0) {
  cat("\\n--- QC Check: Overall Allocation ---\\n")
  print(table(schema$Treatment))

  cat("\\n--- QC Check: Site-Level Balance ---\\n")
  print(table(schema$Site, schema$Treatment))

  cat("\\n--- QC Check: Dynamic Block Utilization ---\\n")
  print(table(schema$BlockSize))
} else {
  cat("\\n--- QC Check ---\\n")
  cat("No rows generated; skipping QC tables.\\n")
}

# write.csv(schema, "randomization_schema.csv", row.names=FALSE)
`;
    } catch (e) {
      if (this.isKnownError(e)) throw e;
      throw new TemplateCompilationError('R', e, config);
    }
  }

  generatePython(config: RandomizationConfig): string {
    const generatedAt = new Date().toISOString();
    const sites = config.sites || [];
    const blockSizes = this.effectiveBlockSizes(config);
    const arms = config.arms || [];
    const strata = config.strata || [];
    const caps = config.stratumCaps || [];
    const capStrategy = config.capStrategy ?? 'MANUAL_MATRIX';

    // Branch to the marginal-only template which has entirely different generation logic.
    if (capStrategy === 'MARGINAL_ONLY') {
      this.validateMarginalOnlyConfig(config);
      return this.buildPythonMarginalOnly(config);
    }

    // Phase 2 – Strata parsing (localized catch)
    let pyCapsDict: string;
    let strataLevelsList: string;
    let strataNamesArr: string;
    try {
      pyCapsDict = caps.map(c => `    (${c.levels.map(l => `"${l}"`).join(', ')}): ${c.cap}`).join(',\n');
      strataLevelsList = strata.map(s => `[${(s.levels || []).map(l => '"' + l + '"').join(', ')}]`).join(',\n    ');
      strataNamesArr = strata.map(s => '"' + s.id + '"').join(', ');
    } catch (e) {
      throw new StrataParsingError('Python', e, config);
    }

    // Phase 3 – Template compilation (localized catch)
    try {
      const blockStrategySection = this.buildBlockStrategySection('#', config);
      const methodologyBlock = this.methodologySpec.formatAsLineComments(
        this.methodologySpec.generateNarrative(config), '#'
      );
      return `# Randomization Schema Generation in Python
# Protocol: ${config.protocolId || 'Unknown'}
# Study: ${config.studyName || 'Unknown'}
# App Version: ${APP_VERSION}
# Generated At: ${generatedAt}
# PRNG Algorithm: PCG64
${this.buildCapStrategySection('#', config)}${blockStrategySection ? '\n' + blockStrategySection : ''}
${methodologyBlock}

import numpy as np
import itertools
import pandas as pd

# Set seed for reproducibility
rng = np.random.default_rng(${this.hashCode(config.seed)})

# Parameters
sites = [${sites.map(s => '"' + s + '"').join(', ')}]
block_sizes = [${blockSizes.join(', ')}]

# Stratum Caps Mapping
stratum_caps = {
${pyCapsDict || '    (): 0'}
}

# Treatment Arms
arms = [${arms.map(a => `{"name": "${a.name}", "ratio": ${a.ratio}}`).join(', ')}]
total_ratio = sum(arm["ratio"] for arm in arms)

# Strata
strata_levels = [
    ${strataLevelsList}
]
strata_names = [${strataNamesArr}]

# Generate all strata combinations
strata_combinations = list(itertools.product(*strata_levels))

# Block Math Failsafe
if any(bs % total_ratio != 0 for bs in block_sizes):
    raise ValueError("Block sizes must be exact multiples of the total allocation ratio.")

schema = []

for site in sites:
    site_subject_count = 0
    for combo in strata_combinations:
        stratum = dict(zip(strata_names, combo))

        # Determine cap for this specific stratum combination
        max_subjects_per_stratum = stratum_caps.get(combo, 0)

        stratum_subject_count = 0
        block_number = 1

        while stratum_subject_count < max_subjects_per_stratum:
            # Pick random block size
            current_block_size = rng.choice(block_sizes)

            # Generate block
            multiplier = current_block_size // total_ratio
            block = []
            for arm in arms:
                block.extend([arm["name"]] * int(arm["ratio"] * multiplier))

            rng.shuffle(block)

            for treatment in block:
                site_subject_count += 1
                stratum_subject_count += 1

                # Format Subject ID (Simplified)
                subject_id = f"{site}-{site_subject_count:03d}"

                schema.append({
                    "SubjectID": subject_id,
                    "Site": site,
                    "BlockNumber": block_number,
                    "BlockSize": current_block_size,
                    "Treatment": treatment,
                    **stratum
                })

                if stratum_subject_count >= max_subjects_per_stratum:
                    break

            block_number += 1

df = pd.DataFrame(schema)
print("\\n--- Generated Randomization Schema (First 5 Rows) ---")
print(df.head())

print("\\n--- QC Check: Overall Allocation ---")
print(df['Treatment'].value_counts())

print("\\n--- QC Check: Site-Level Balance ---")
print(pd.crosstab(df['Site'], df['Treatment']))

print("\\n--- QC Check: Dynamic Block Utilization ---")
print(df['BlockSize'].value_counts())
# df.to_csv("randomization_schema.csv", index=False)
`;
    } catch (e) {
      if (this.isKnownError(e)) throw e;
      throw new TemplateCompilationError('Python', e, config);
    }
  }

  generateSas(config: RandomizationConfig): string {
    const generatedAt = new Date().toISOString();
    const sites = config.sites || [];
    const blockSizes = this.effectiveBlockSizes(config);
    const arms = config.arms || [];
    const strata = config.strata || [];
    const caps = config.stratumCaps || [];
    const totalRatio = arms.reduce((sum, a) => sum + a.ratio, 0);
    const capStrategy = config.capStrategy ?? 'MANUAL_MATRIX';

    // Branch to the marginal-only template which has entirely different generation logic.
    if (capStrategy === 'MARGINAL_ONLY') {
      this.validateMarginalOnlyConfig(config);
      return this.buildSasMarginalOnly(config);
    }

    // Phase 2 – Strata parsing (localized catch)
    let strataFactorsLine: string;
    let strataLevelLines: string;
    let capsRows: string;
    let capsLengthDecl: string;
    try {
      strataFactorsLine = strata.length > 0
        ? `%let strata_factors = ${strata.map(s => `"${s.id}"`).join(' ')};\n`
        : '';
      strataLevelLines = strata.map(s => `%let ${s.id}_levels = ${(s.levels || []).map(l => `"${l}"`).join(' ')};`).join('\n');
      capsLengthDecl = strata.length > 0 ? strata.map(s => ` ${s.id} $50`).join('') : '';
      if (caps.length === 0) {
        capsRows = `  max_subjects_per_stratum = 0; output;\n`;
      } else {
        capsRows = caps.map(c => {
          let row = '';
          if (strata.length > 0 && c.levels.length === strata.length) {
            strata.forEach((s, idx) => { row += `  ${s.id} = "${c.levels[idx]}";`; });
          }
          row += `  max_subjects_per_stratum = ${c.cap};\n  output;\n`;
          return row;
        }).join('');
      }
    } catch (e) {
      throw new StrataParsingError('SAS', e, config);
    }

    // Build the cap strategy comment block for SAS (/* */ style)
    const sasCapStrategyComment = this.buildCapStrategySection('/*', config)
      .split('\n')
      .map(line => line.replace(/^\/\*\s?/, '/* ').replace(/$/, ' */'))
      .join('\n');

    // Build the block strategy comment block for SAS (/* */ style)
    const sasBlockStrategyComment = this.buildBlockStrategySection('#', config)
      .split('\n')
      .filter(l => l)
      .map(line => line.replace(/^#\s?/, '/* ') + ' */')
      .join('\n');

    // Build the methodology narrative block for SAS (/* */ style)
    const sasMethodologyBlock = this.methodologySpec.formatAsSasComment(
      this.methodologySpec.generateNarrative(config)
    );

    // Phase 3 – Template compilation (localized catch)
    try {
      let code = `/* Randomization Schema Generation in SAS */
/* Protocol: ${config.protocolId || 'Unknown'} */
/* Study: ${config.studyName || 'Unknown'} */
/* App Version: ${APP_VERSION} */
/* Generated At: ${generatedAt} */
/* PRNG Algorithm: Mersenne Twister */
${sasCapStrategyComment}${sasBlockStrategyComment ? '\n' + sasBlockStrategyComment : ''}
${sasMethodologyBlock}

%let seed = ${this.hashCode(config.seed)};
%let total_ratio = ${totalRatio};

/* User-defined Parameters */
%let arms = ${arms.map(a => `"${a.name}"`).join(' ')};
%let ratios = ${arms.map(a => a.ratio).join(' ')};
%let block_sizes = ${blockSizes.join(' ')};
%let sites = ${sites.map(s => `"${s}"`).join(' ')};

/* Block Math Failsafe */
data _null_;
  _n_blocks = countw("&block_sizes.", ' ', 'q');
  do _i = 1 to _n_blocks;
    _block_size = input(scan("&block_sizes.", _i, ' ', 'q'), best.);
    if mod(_block_size, &total_ratio.) ^= 0 then do;
      call symputx('BLOCK_MATH_ERROR', 1);
      put "ERROR: Block size " _block_size " is not an exact multiple of total allocation ratio " &total_ratio. ".";
    end;
  end;
run;

%macro check_block_math;
  %if &BLOCK_MATH_ERROR. = 1 %then %do;
    %abort cancel;
  %end;
%mend check_block_math;
%check_block_math;
`;

      if (strata.length > 0) {
        code += strataFactorsLine;
        code += strataLevelLines + '\n';
      }

      code += `
/* 1. Build the Design Matrix (Sites and Strata) */
data _sites;
  length Site $50;
  _n_sites = countw(&sites., ' ', 'q');
  do _i = 1 to _n_sites;
    Site = dequote(scan(&sites., _i, ' ', 'q'));
    output;
  end;
  drop _i _n_sites;
run;
`;

      const designVars = ['Site'];
      if (strata.length > 0) {
        for (let i = 0; i < strata.length; i++) {
          const s = strata[i];
          designVars.push(s.id);
          code += `
data _strata_${i+1};
  length ${s.id} $50;
  _n_levels = countw(&${s.id}_levels., ' ', 'q');
  do _i = 1 to _n_levels;
    ${s.id} = dequote(scan(&${s.id}_levels., _i, ' ', 'q'));
    output;
  end;
  drop _i _n_levels;
run;
`;
        }
      }

      // Create the cap mapping dataset
      code += `
/* Define Stratum Caps Map */
data _caps;
  length max_subjects_per_stratum 8${capsLengthDecl};
${capsRows}run;\n`;

      if (strata.length > 0) {
        code += `
proc sql noprint;
  create table _design as
  select a.Site`;
        for (let i = 0; i < strata.length; i++) {
          const char = String.fromCharCode(98 + i); // 'b', 'c', etc.
          code += `, ${char}.${strata[i].id}`;
        }
        // Add the cap join logic
        code += `, caps.max_subjects_per_stratum
  from _sites a`;
        for (let i = 0; i < strata.length; i++) {
          const char = String.fromCharCode(98 + i);
          code += `
  cross join _strata_${i+1} ${char}`;
        }
        // Merge caps
        code += `
  left join _caps caps on 1=1`;
        for (let i = 0; i < strata.length; i++) {
          const char = String.fromCharCode(98 + i);
          code += ` and ${char}.${strata[i].id} = caps.${strata[i].id}`;
        }
        code += `;\nquit;\n`;
      } else {
        code += `
proc sql noprint;
  create table _design as
  select a.Site, caps.max_subjects_per_stratum
  from _sites a
  cross join _caps caps;
quit;
`;
      }

      code += `
/* 2. Generate Blocks and Assign Treatments */
data _blocks;
  set _design;
  if missing(max_subjects_per_stratum) then max_subjects_per_stratum = 0;
  call streaminit(&seed.);
  length Treatment $50;

  _total_ratio = &total_ratio.;
  _subj_count = 0;
  block_num = 1;

  do while (_subj_count < max_subjects_per_stratum);
    /* Dynamic Block Selection */
    _rand_val = rand('uniform');
`;

      for (let i = 0; i < blockSizes.length; i++) {
        if (i === 0 && blockSizes.length === 1) {
          code += `    block_size = ${blockSizes[i]};\n`;
        } else if (i === 0) {
          const p = (i + 1) / blockSizes.length;
          code += `    if _rand_val <= ${p.toFixed(5)} then block_size = ${blockSizes[i]};\n`;
        } else if (i === blockSizes.length - 1) {
          code += `    else block_size = ${blockSizes[i]};\n`;
        } else {
          const p = (i + 1) / blockSizes.length;
          code += `    else if _rand_val <= ${p.toFixed(5)} then block_size = ${blockSizes[i]};\n`;
        }
      }

      code += `
    _subj_count = _subj_count + block_size;
    _multiplier = block_size / _total_ratio;
    _n_arms = countw(&arms., ' ', 'q');

    /* Generate Treatments for the Block */
    do _a = 1 to _n_arms;
      Treatment = dequote(scan(&arms., _a, ' ', 'q'));
      _arm_ratio = input(scan(&ratios., _a, ' '), best.);

      do _t = 1 to round(_arm_ratio * _multiplier);
        _rand_sort = rand('uniform');
        output;
      end;
    end;
    block_num = block_num + 1;
  end;
run;
`;

      code += `
/* 3. Enforce Physical Sorting to Permute Blocks */
`;
      const byVars = designVars.join(' ');
      code += `proc sort data=_blocks;
  by ${byVars} block_num _rand_sort;
run;
`;

      const lastDesignVar = designVars[designVars.length - 1];

      code += `
/* 4. Final Data Deliverable & Cleanup */
data final_schema;
  set _blocks;
  by ${byVars};

  retain _site_subj_count 0;
  if first.Site then _site_subj_count = 0;

  retain _stratum_subj_count;
  if first.${lastDesignVar} then _stratum_subj_count = 1;
  else _stratum_subj_count = _stratum_subj_count + 1;

  if _stratum_subj_count <= max_subjects_per_stratum then do;
    _site_subj_count = _site_subj_count + 1;

    /* Format Subject ID */
    length SubjectID $50;
    SubjectID = cats(Site, "-", put(_site_subj_count, z3.));

    output;
  end;

  drop _:;
run;
`;

      code += `
/* 5. Quality Control (QC) Checks */
proc freq data=final_schema;
  title "Overall Treatment Balance";
  tables Treatment / nocum;
run;

proc freq data=final_schema;
  title "Site-Level Treatment Balance";
  tables Site * Treatment / nocol nopercent;
run;

proc freq data=final_schema;
  title "Block Size Distribution";
  tables block_size / nocum;
run;

title "Randomization Schema Preview";
proc print data=final_schema(obs=20);
run;
title;
`;

      return code.trim() + '\n';
    } catch (e) {
      if (this.isKnownError(e)) throw e;
      throw new TemplateCompilationError('SAS', e, config);
    }
  }
}
