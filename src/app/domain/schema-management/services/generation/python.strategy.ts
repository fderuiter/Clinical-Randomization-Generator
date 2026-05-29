import { Injectable } from "@angular/core";
import { RandomizationConfig } from '../../../core/models/randomization.model';
import { CodeGenerationStrategy } from './base.strategy';
import { FormattingUtil } from './formatting.util';
import { ReproducibilityUtil } from './reproducibility.util';
import { APP_VERSION } from '../../../../../environments/version';
import { MethodologySpecificationService } from '../methodology-specification.service';
import { StrataParsingError, TemplateCompilationError, ConfigurationValidationError } from '../../errors/code-generation-errors';

@Injectable()
export class PythonStrategy implements CodeGenerationStrategy {
  readonly language = 'Python';

  constructor(private methodologySpec: MethodologySpecificationService) {}

  generate(config: RandomizationConfig): string {
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
      return this.buildMarginalOnly(config);
    }

    // Phase 2 – Strata parsing (localized catch)
    let pyCapsDict: string;
    let strataLevelsList: string;
    let strataNamesArr: string;
    try {
      pyCapsDict = caps.map(c => {
        const tupleElements = strata.map(s => `"${FormattingUtil.escapePythonString(c.levelIds?.[s.id] ?? '')}"`).join(', ');
        return `    (${strata.length === 1 ? tupleElements + ',' : tupleElements}): ${c.cap}`;
      }).join(',\n');
      strataLevelsList = strata.map(s => `[${(s.levels || []).map(l => '"' + FormattingUtil.escapePythonString(l) + '"').join(', ')}]`).join(',\n    ');
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
# Source Seed Hash: ${ReproducibilityUtil.get128BitHash(config.seed)}
${this.buildCapStrategySection('#', config)}${blockStrategySection ? '\n' + blockStrategySection : ''}
${methodologyBlock}

import numpy as np
import itertools
import pandas as pd

# Set seed for reproducibility
rng = np.random.default_rng(${ReproducibilityUtil.hashCode(config.seed)})

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
print(df.head() if not df.empty else "No rows generated.")

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

  generateMinimization(config: RandomizationConfig): string {
const sites = config.sites || [];
    const arms = config.arms || [];
    const strata = config.strata || [];
    const mc = config.minimizationConfig;
    const p = mc?.p ?? 0.8;
    const n = mc?.totalSampleSize ?? 100;
    const isMarginal = config.capStrategy === 'MARGINAL_ONLY';

    const header = this.generateMinimizationHeader('Python', config);

    let setupCode: string;
    let capsCode: string;
    let baseProbsCode: string;

    try {
      const strataLevelsList = strata.map(s => `    "${s.id}": [${s.levels.map(l => '"' + FormattingUtil.escapePythonString(l) + '"').join(', ')}]`).join(',\n');

      if (isMarginal) {
        const pyMarginalCaps = strata.map(s => {
          const entries = s.levels.map((lvl, i) => {
            const cap = s.levelDetails?.[i]?.marginalCap;
            return cap !== undefined ? `        "${FormattingUtil.escapePythonString(lvl)}": ${cap}` : `        "${FormattingUtil.escapePythonString(lvl)}": float("inf")`;
          });
          return `    "${s.id}": {\n${entries.join(',\n')}\n    }`;
        }).join(',\n');

        capsCode = `marginal_caps = {\n${pyMarginalCaps}\n}\n\n` +
                   `marginal_counts = {\n` +
                   strata.map(s => `    "${s.id}": {lvl: 0 for lvl in strata_levels["${s.id}"]}`).join(',\n') +
                   `\n}`;
      } else {
        const caps = config.stratumCaps || [];
        const pyCapsDict = caps.map(c => {
          const tupleElements = strata.map(s => `"${FormattingUtil.escapePythonString(c.levelIds?.[s.id] ?? '')}"`).join(', ');
          const tupleKey = strata.length === 1 ? `(${tupleElements},)` : `(${tupleElements})`;
          return `    ${tupleKey}: ${c.cap}`;
        }).join(',\n');
        capsCode = `stratum_caps = {\n${pyCapsDict || '    (): 0'}\n}\nintersection_counts = {}`;
      }

      baseProbsCode = `base_probs = {\n` + strata.map(s => {
        const probs = s.levels.map((lvl, i) => {
          const expected = s.levelDetails?.[i]?.expectedProbability;
          return expected !== undefined ? expected : 'None';
        });
        return `    "${s.id}": [${probs.join(', ')}]`;
      }).join(',\n') + `\n}`;

      setupCode = `
# Strata
strata_levels = {
${strataLevelsList}
}
strata_names = list(strata_levels.keys())
strata_combinations = list(itertools.product(*(strata_levels[k] for k in strata_names))) if strata_names else [()]
active_pool = [dict(zip(strata_names, c)) for c in strata_combinations]

# Expected Probabilities
${baseProbsCode}

# Caps and Counts
${capsCode}

# Treatment Arms
arms = [${arms.map(a => `{"id": "${a.id}", "name": "${a.name}", "ratio": ${a.ratio}}`).join(', ')}]
arm_ratios = {arm["id"]: arm["ratio"] for arm in arms}
total_ratio = sum(arm["ratio"] for arm in arms)

# Imbalance Tracking (Global)
marginal_imbalance = {
    factor_id: {lvl: {arm["id"]: 0 for arm in arms} for lvl in levels}
    for factor_id, levels in strata_levels.items()
}
`;
    } catch (e) {
      throw new StrataParsingError('Python', e, config);
    }

    try {
      return `${header}
# Note: Python's PCG64 algorithm will not generate the exact same sequence as the
# typescript web application, but the statistical properties and parameters are identical.

import numpy as np
import itertools
import pandas as pd

# Set seed for reproducibility
rng = np.random.default_rng(${ReproducibilityUtil.hashCode(config.seed)})

# Parameters
p_minimization = ${p}
total_sample_size = ${n}
sites = [${sites.map(s => '"' + s + '"').join(', ')}]
if not sites:
    raise ValueError("Sites array is empty.")
${setupCode}

# Setup site counts
site_subject_counts = {site: 0 for site in sites}
schema = []
used_subject_ids = set()

# Function to generate Subject ID
def generate_subject_id(site, sequence):
    subj_id = f"{site}-{sequence:03d}"
    while subj_id in used_subject_ids:
        sequence += 1
        subj_id = f"{site}-{sequence:03d}"
    used_subject_ids.add(subj_id)
    return subj_id

def sample_level(available_levels, probs_vector):
    if not available_levels:
        raise ValueError("Cannot sample from empty levels.")

    clean_probs = [p for p in probs_vector if p is not None]
    if not clean_probs:
        return rng.choice(available_levels)

    explicit_sum = sum(clean_probs)
    probs = []

    if explicit_sum > 1.0:
        probs = [p / explicit_sum if p is not None else 0 for p in probs_vector]
    elif explicit_sum == 1.0:
        probs = [p if p is not None else 0 for p in probs_vector]
    elif explicit_sum > 0 and explicit_sum < 1.0:
        na_count = sum(1 for p in probs_vector if p is None)
        if na_count > 0:
            share = (1.0 - explicit_sum) / na_count
            probs = [p if p is not None else share for p in probs_vector]
        else:
            probs = [p / explicit_sum if p is not None else 0 for p in probs_vector]
    else:
        probs = [1.0 / len(probs_vector) for _ in probs_vector]

    # Ensure sum is exactly 1.0 to avoid numpy errors
    prob_sum = sum(probs)
    if prob_sum > 0:
        probs = [p / prob_sum for p in probs]

    return rng.choice(available_levels, p=probs)

def compute_imbalance_score(candidate_arm_id, profile, marginals):
    total_score = 0
    for factor_id, level_value in profile.items():
        arm_counts = dict(marginals[factor_id][level_value])
        arm_counts[candidate_arm_id] += 1

        min_val = float('inf')
        max_val = float('-inf')
        for arm in arms:
            normalized = arm_counts[arm["id"]] / arm["ratio"]
            if normalized < min_val: min_val = normalized
            if normalized > max_val: max_val = normalized
        total_score += (max_val - min_val)
    return total_score

for s_idx in range(total_sample_size):
    # Update active pool
${isMarginal ? `
    new_active_pool = []
    for combo in active_pool:
        keep = True
        for factor_id, level_val in combo.items():
            cap_val = marginal_caps.get(factor_id, {}).get(level_val, float('inf'))
            count = marginal_counts.get(factor_id, {}).get(level_val, 0)
            if count >= cap_val:
                keep = False
                break
        if keep:
            new_active_pool.append(combo)
    active_pool = new_active_pool
` : `
    new_active_pool = []
    for combo in active_pool:
        key = tuple(combo.get(k, "") for k in strata_names)
        cap = stratum_caps.get(key, float('inf'))
        count = intersection_counts.get(key, 0)
        if count < cap:
            new_active_pool.append(combo)
    active_pool = new_active_pool
`}

    if not active_pool:
        break # Exhaustion

    site = rng.choice(sites)

    subject_profile = {}
    current_prefix = {}
    valid_subject = True

    for factor_id in strata_names:
        levels = strata_levels[factor_id]
        available_levels = []
        for lvl in levels:
            # Check if this level exists in active pool matching current prefix
            for combo in active_pool:
                match_prefix = True
                for k, v in current_prefix.items():
                    if combo.get(k) != v:
                        match_prefix = False
                        break
                if match_prefix and combo.get(factor_id) == lvl:
                    available_levels.append(lvl)
                    break

        if not available_levels:
            valid_subject = False
            break

        prob_indices = [levels.index(lvl) for lvl in available_levels]
        probs_vector = [base_probs[factor_id][idx] for idx in prob_indices]

        level = sample_level(available_levels, probs_vector)
        subject_profile[factor_id] = level
        current_prefix[factor_id] = level

    if not valid_subject:
        break

    # Imbalance Score per site. (Using global marginal tracking)
    min_score = float('inf')
    arm_scores = []
    for arm in arms:
        score = compute_imbalance_score(arm["id"], subject_profile, marginal_imbalance)
        arm_scores.append(score)
        if score < min_score: min_score = score

    preferred = [arms[i] for i, score in enumerate(arm_scores) if score == min_score]
    non_preferred = [arms[i] for i, score in enumerate(arm_scores) if score != min_score]

    assigned_arm = None
    if len(preferred) == len(arms) or len(non_preferred) == 0:
        pref_ratios = [arm["ratio"] for arm in preferred]
        probs = [r / sum(pref_ratios) for r in pref_ratios]
        assigned_arm = rng.choice(preferred, p=probs)
    else:
        if rng.random() < p_minimization:
            pref_ratios = [arm["ratio"] for arm in preferred]
            probs = [r / sum(pref_ratios) for r in pref_ratios]
            assigned_arm = rng.choice(preferred, p=probs)
        else:
            non_pref_ratios = [arm["ratio"] for arm in non_preferred]
            probs = [r / sum(non_pref_ratios) for r in non_pref_ratios]
            assigned_arm = rng.choice(non_preferred, p=probs)

    # Update state
    for factor_id, lvl in subject_profile.items():
        marginal_imbalance[factor_id][lvl][assigned_arm["id"]] += 1
${isMarginal ? `
        marginal_counts[factor_id][lvl] += 1
` : ''}

${!isMarginal ? `
    key = tuple(subject_profile.get(k, "") for k in strata_names)
    intersection_counts[key] = intersection_counts.get(key, 0) + 1
` : ''}

    site_subject_counts[site] += 1
    stratum_code = "-".join([subject_profile.get(k, "")[:3].upper() for k in strata_names])
    subject_id = generate_subject_id(site, site_subject_counts[site])

    row = {
        "SubjectID": subject_id,
        "Site": site,
        "BlockNumber": 0,
        "BlockSize": 0,
        "Treatment": assigned_arm["name"],
        "TreatmentId": assigned_arm["id"],
        **subject_profile
    }
    schema.append(row)

df = pd.DataFrame(schema)
print("\\n--- Generated Randomization Schema (First 5 Rows) ---")
print(df.head() if not df.empty else "No rows generated.")

if not df.empty:
    print("\\n--- QC Check: Overall Allocation ---")
    print(df['Treatment'].value_counts())

    print("\\n--- QC Check: Site-Level Balance ---")
    print(pd.crosstab(df['Site'], df['Treatment']))
else:
    print("\\n--- QC Check ---")
    print("No rows generated; skipping QC tables.")
`;
    } catch (e) {
      if (this.isKnownError(e)) throw e;
      throw new TemplateCompilationError('Python', e, config);
    }
  }

  private isKnownError(e: unknown): boolean {
    return e instanceof StrataParsingError || e instanceof ConfigurationValidationError;
  }


  private buildMarginalOnly(config: RandomizationConfig): string {
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
          return cap !== undefined ? `        "${FormattingUtil.escapePythonString(lvl)}": ${cap}` : null;
        }).filter(Boolean);
        return `    "${s.id}": {\n${entries.join(',\n')}\n    }`;
      }).join(',\n');
      strataLevelsList = strata.map(s => `[${s.levels.map(l => '"' + FormattingUtil.escapePythonString(l) + '"').join(', ')}]`).join(',\n    ');
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
# Source Seed Hash: ${ReproducibilityUtil.get128BitHash(config.seed)}
${this.buildCapStrategySection('#', config)}${blockStrategySection ? '\n' + blockStrategySection : ''}
${methodologyBlock}
# Subjects are allocated by randomly selecting valid stratum combinations
# until no combination can accept additional subjects.

import numpy as np
import itertools
import pandas as pd

# Set seed for reproducibility
rng = np.random.default_rng(${ReproducibilityUtil.hashCode(config.seed)})

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



  private generateMinimizationHeader(language: string, config: RandomizationConfig): string {
const generatedAt = new Date().toISOString();
const arms = config.arms || [];
const strata = config.strata || [];
const mc = config.minimizationConfig;
const p = mc?.p ?? 0.8;
const n = mc?.totalSampleSize ?? 100;

const armLines = arms.map(a => `  ${a.name} (ratio: ${a.ratio})`).join('\n');
const strataLines = strata.map(s => {
  const levels = s.levelDetails?.length
    ? s.levels.map(lvl => {
        const detail = s.levelDetails!.find(d => d.name === lvl);
        const prob = detail?.expectedProbability !== undefined
          ? ` (p=${(detail.expectedProbability * 100).toFixed(1)}%)`
          : '';
        return `    - ${lvl}${prob}`;
      }).join('\n')
    : s.levels.map(lvl => `    - ${lvl}`).join('\n');
  return `  ${s.name || s.id}:\n${levels}`;
}).join('\n');

const body = [
  `Randomization Schema Configuration`,
  `Protocol: ${config.protocolId || 'Unknown'}`,
  `Study: ${config.studyName || 'Unknown'}`,
  `Generated by Equipose (equipose.org)`,
  `App Version: ${APP_VERSION}`,
  `Generated At: ${generatedAt}`,
  ``,
  `Algorithm: Pocock-Simon Minimization`,
  `Source Seed Hash: ${ReproducibilityUtil.get128BitHash(config.seed)}`,
  `Base Probability (p): ${p}`,
  `Total Sample Size (N): ${n}`,
  `Sites: ${(config.sites || []).join(', ')}`,
  ``,
  `Treatment Arms:`,
  armLines,
  ``,
  `Stratification Factors:`,
  strataLines,
  ``,
  `NOTE: The Pocock-Simon minimization algorithm dynamically assigns treatments`,
  `to minimise marginal imbalance across all stratification factors.`,
  `Full implementation in ${language} requires a custom sequential allocation loop.`,
  `The schema generated by the application (CSV export) is the authoritative`,
  `randomisation list and should be used directly in trial operations.`,
].join('\n');

if (language === 'SAS') {
  return body.split('\n').map(l => `/* ${l} */`).join('\n');
}
const prefix = language === 'STATA' ? '* ' : '# ';
return body.split('\n').map(l => `${prefix}${l}`).join('\n');
  }


  private effectiveBlockSizes(config: RandomizationConfig): number[] {
    return config.globalBlockStrategy?.sizes ?? config.blockSizes ?? [];
  }

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

  private computeCombinations(strata: any[]): Record<string, string>[] {
    let combos = [{}];
    for (const s of strata) {
      const next = [];
      for (const combo of combos) {
        for (const lvl of s.levels) {
          next.push({ ...combo, [s.id]: lvl });
        }
      }
      combos = next;
    }
    return combos.length ? combos : [{}];
  }
}
