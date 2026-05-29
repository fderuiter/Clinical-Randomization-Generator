import { Injectable } from "@angular/core";
import { RandomizationConfig } from '../../../core/models/randomization.model';
import { CodeGenerationStrategy } from './base.strategy';
import { FormattingUtil, EscapedString } from './formatting.util';
import { ReproducibilityUtil } from './reproducibility.util';
import { APP_VERSION } from '../../../../../environments/version';
import { MethodologySpecificationService } from '../methodology-specification.service';
import { StrataParsingError, TemplateCompilationError, ConfigurationValidationError } from '../../errors/code-generation-errors';

@Injectable()
export class StataStrategy implements CodeGenerationStrategy {
  readonly language = 'STATA';

  @EscapedString('STATA')
  escapeString(s: string): string {
    return s;
  }

  constructor(private methodologySpec: MethodologySpecificationService) {}

  generate(config: RandomizationConfig): string {
const generatedAt = new Date().toISOString();
    const sites = config.sites || [];
    const blockSizes = this.effectiveBlockSizes(config);
    const arms = config.arms || [];
    const strata = config.strata || [];
    const caps = config.stratumCaps || [];
    const totalRatio = arms.reduce((sum, a) => sum + a.ratio, 0);
    const capStrategy = config.capStrategy ?? 'MANUAL_MATRIX';

    if (capStrategy === 'MARGINAL_ONLY') {
      this.validateMarginalOnlyConfig(config);
      return this.buildMarginalOnly(config);
    }

    // Phase 2 – Strata parsing (localized catch)
    let varNames: string[];
    let labelDefs: string;
    let postfileStrataDecl: string;
    let capConditions: string;
    let forvaluesOpen: string;
    let forvaluesClose: string;
    let postStrataArgs: string;
    let labelValues: string;
    try {
      varNames = strata.map(s => FormattingUtil.sanitizeStataVarName(s.id));

      // Value label definitions (strata factors as 1-based integers)
      labelDefs = strata.map((s, si) => {
        const lvlDefs = s.levels.map((lvl, j) => `${j + 1} ${this.escapeString(lvl)}`).join(' ');
        return `label define lbl_${varNames[si]} ${lvlDefs}, replace`;
      }).join('\n');

      // Postfile strata variable declarations
      postfileStrataDecl = varNames.length > 0
        ? ' ' + varNames.map(v => `int ${v}`).join(' ')
        : '';

      // Cap conditions inside the strata loops (using _val suffix loop variables)
      const capLines = caps.map(c => {
        const conds = strata.map((s, si) => {
          const levelName = c.levelIds?.[s.id] ?? '';
          const idx = s.levels.indexOf(levelName) + 1;
          return idx > 0 ? `\`${varNames[si]}_val' == ${idx}` : null;
        }).filter(Boolean);
        const cond = conds.join(' & ');
        return cond
          ? `            if ${cond} local cap = ${c.cap}`
          : `            local cap = ${c.cap}`;
      }).join('\n');

      if (strata.length === 0) {
        const singleCap = caps.length > 0 ? caps[0].cap : 0;
        capConditions = `            local cap = ${singleCap}`;
      } else {
        capConditions = `            local cap = 0\n${capLines}`;
      }

      // Nested forvalues loops for strata
      const IND = '    ';
      if (strata.length > 0) {
        forvaluesOpen = strata.map((s, i) => {
          const varMacro = `${varNames[i]}_val`;
          const ind = IND.repeat(i + 1);
          const lvlAnnotation = s.levels.map((l, j) => `${j + 1}=${l}`).join(', ');
          return `${ind}* ${s.name || s.id}: ${lvlAnnotation}\n` +
                 `${ind}forvalues ${varMacro} = 1/${s.levels.length} {`;
        }).join('\n');
        forvaluesClose = strata.map((_, i) =>
          IND.repeat(strata.length - i) + '}'
        ).join('\n');
      } else {
        forvaluesOpen = '';
        forvaluesClose = '';
      }

      // Post args for strata variables
      postStrataArgs = varNames.length > 0
        ? ' ' + varNames.map(v => `(\`${v}_val')`).join(' ')
        : '';

      // Label values
      labelValues = varNames.map(v => `label values ${v} lbl_${v}`).join('\n');
    } catch (e) {
      throw new StrataParsingError('STATA', e, config);
    }

    // Phase 3 – Template compilation (localized catch)
    const stataCapComment = this.buildCapStrategySection('*', config);
    const stataBlockComment = this.buildBlockStrategySection('*', config);
    const stataMethodology = this.methodologySpec.formatAsLineComments(
      this.methodologySpec.generateNarrative(config), '*'
    );

    try {
      // Site macro declarations (indexed, handles spaces in names)
      const siteMacros = sites.map((s, i) =>
        `local site_${i + 1} "${s}"`
      ).join('\n');

      // Arm macro declarations (indexed)
      const armMacros = arms.map((a, i) =>
        `local arm_name_${i + 1} "${a.name}"\nlocal arm_ratio_${i + 1} = ${a.ratio}`
      ).join('\n');

      // Block size pick code
      let blockSizePick: string;
      if (blockSizes.length === 1) {
        blockSizePick = `                local cur_bs = ${blockSizes[0]}`;
      } else {
        const parts = blockSizes.map((bs, i) => {
          const threshold = ((i + 1) / blockSizes.length).toFixed(5);
          if (i === 0) return `                if _rand_bs <= ${threshold} local cur_bs = ${bs}`;
          if (i === blockSizes.length - 1) return `                else local cur_bs = ${bs}`;
          return `                else if _rand_bs <= ${threshold} local cur_bs = ${bs}`;
        });
        blockSizePick = `                local _rand_bs = runiform()\n${parts.join('\n')}`;
      }

      // Cap annotation comments for header
      const capAnnotations = strata.length > 0
        ? caps.map(c => {
            const lvlParts = strata.map((s, i) => `${varNames[i]}=${c.levelIds?.[s.id] || '?'}`).join(', ');
            return `* (${lvlParts}) → ${c.cap} subjects`;
          }).join('\n')
        : '';

      let code = `* Randomization Schema Generation in Stata
* Protocol: ${config.protocolId || 'Unknown'}
* Study: ${config.studyName || 'Unknown'}
* App Version: ${APP_VERSION}
* Generated At: ${generatedAt}
* PRNG Algorithm: Mersenne Twister
* Source Seed Hash: ${ReproducibilityUtil.get128BitHash(config.seed)}
${stataCapComment}${stataBlockComment ? '\n' + stataBlockComment : ''}
${stataMethodology}

version 17
set more off
set seed ${ReproducibilityUtil.hashCode(config.seed)}

* ─── User-defined Parameters ────────────────────────────────────────────────
local total_ratio = ${totalRatio}
local block_sizes "${blockSizes.join(' ')}"
local n_bs : word count \`block_sizes'
local n_arms = ${arms.length}
${armMacros}
local n_sites = ${sites.length}
${siteMacros}

* Block Math Failsafe
forvalues b = 1/\`n_bs' {
    local bs : word \`b' of \`block_sizes'
    if mod(\`bs', \`total_ratio') != 0 {
        di as error "Block size \`bs' is not a multiple of total allocation ratio \`total_ratio'."
        exit 198
    }
}
`;

      if (labelDefs) {
        code += `
* ─── Value Labels ──────────────────────────────────────────────────────────
${labelDefs}
`;
      }

      if (capAnnotations) {
        code += `
* ─── Stratum Caps ────────────────────────────────────────────────────────
${capAnnotations}
`;
      }

      code += `
* ─── Schema Generation ──────────────────────────────────────────────────────
tempfile _schema_data
tempname _schema_fh

* Strata factors are stored as integers; use 'label values' to display labels.
postfile \`_schema_fh' str50 SubjectID str50 Site int BlockNumber int BlockSize ///
    str50 Treatment${postfileStrataDecl} ///
    using \`_schema_data', replace

if \`n_sites' > 0 {
forvalues s = 1/\`n_sites' {
    local site \`site_\`s''
    local site_count = 0
${forvaluesOpen ? '\n' + forvaluesOpen : ''}
${capConditions}

            local stratum_count = 0
            local block_num = 1
            while \`stratum_count' < \`cap' {
                * Pick random block size
${blockSizePick}
                local multiplier = \`cur_bs' / \`total_ratio'

                * Build treatment block using indexed local macros
                local blk_idx = 0
                forvalues a = 1/\`n_arms' {
                    local arm_name \`arm_name_\`a''
                    local arm_ratio = \`arm_ratio_\`a''
                    local arm_reps = round(\`arm_ratio' * \`multiplier')
                    forvalues r = 1/\`arm_reps' {
                        local blk_idx = \`blk_idx' + 1
                        local blk_\`blk_idx' \`arm_name'
                    }
                }
                local n_block = \`blk_idx'

                * Fisher-Yates shuffle (in-place via indexed local macros)
                forvalues _i = \`n_block'(-1)2 {
                    local _j = ceil(runiform() * \`_i')
                    local _tmp \`blk_\`_i''
                    local blk_\`_i' \`blk_\`_j''
                    local blk_\`_j' \`_tmp'
                }

                * Output subjects (truncate to remaining cap)
                local remaining = \`cap' - \`stratum_count'
                local n_out = min(\`n_block', \`remaining')
                forvalues t = 1/\`n_out' {
                    local site_count = \`site_count' + 1
                    local stratum_count = \`stratum_count' + 1
                    local subj_id = "\`site'" + "-" + string(\`site_count', "%03.0f")
                    post \`_schema_fh' ("\`subj_id'") ("\`site'") (\`block_num') ///
                        (\`cur_bs') ("\`blk_\`t''")${postStrataArgs}
                }
                if \`stratum_count' >= \`cap' continue, break
                local block_num = \`block_num' + 1
            }
${forvaluesClose ? '\n' + forvaluesClose : ''}
}
} // end if \`n_sites' > 0

postclose \`_schema_fh'
use \`_schema_data', clear
`;

      if (labelValues) {
        code += `
* Apply value labels to strata variables
${labelValues}
`;
      }

      code += `
* ─── QC Checks ─────────────────────────────────────────────────────────────
di _newline "--- QC Check: Overall Allocation ---"
tabulate Treatment

di _newline "--- QC Check: Site-Level Balance ---"
tabulate Site Treatment, chi2

di _newline "--- QC Check: Block Size Distribution ---"
tabulate BlockSize

list in 1/20, clean noobs

* export delimited "randomization_schema.csv", replace
`;
      return code.trim() + '\n' ;
    } catch (e) {
      if (this.isKnownError(e)) throw e;
      throw new TemplateCompilationError('STATA', e, config);
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

    const header = this.generateMinimizationHeader('STATA', config);

    const n_arms = arms.length;

    // Use computeCombinations to find all possible strata combinations
    const combos = this.computeCombinations(strata);
    const nCombos = combos.length;

    // Sanitised variable names for strata factors
    const varNames = strata.map(s => FormattingUtil.sanitizeStataVarName(s.id));

    // Assign a 1-based global level index to every (factorId, levelName) pair.
    let globalIdx = 0;
    const levelIndices = new Map<string, Map<string, number>>();
    for (const s of strata) {
      const m = new Map<string, number>();
      for (const lvl of s.levels) { m.set(lvl, ++globalIdx); }
      levelIndices.set(s.id, m);
    }
    const totalLevels = Math.max(globalIdx, 1);

    const UNCAPPED = 2147483647; // Stata missing . gets messy in math loops, use large int

    // Macros for Caps
    const capMacroLines: string[] = [];
    if (isMarginal) {
      for (const s of strata) {
        for (const lvl of s.levels) {
          const lidx = levelIndices.get(s.id)?.get(lvl) ?? 1;
          const capEntry = (s.levelDetails ?? []).find(d => d.name === lvl);
          const capVal = capEntry !== undefined && Number.isFinite(capEntry.marginalCap)
            ? capEntry.marginalCap : UNCAPPED;
          capMacroLines.push(`local cap_${lidx} = ${capVal}`);
        }
      }
    } else {
      const capsDict = new Map<string, number>();
      for (const c of config.stratumCaps || []) {
        capsDict.set(strata.map(s => c.levelIds?.[s.id] || '').join('|'), c.cap);
      }
      for (let i = 0; i < combos.length; i++) {
        const combo = combos[i];
        const key = strata.map(s => combo[s.id] || '').join('|');
        const capVal = capsDict.has(key) ? capsDict.get(key) : UNCAPPED;
        capMacroLines.push(`local cap_${i+1} = ${capVal}`);
      }
    }

    // Macros for Base Probabilities (-1 means undefined)
    const baseProbsMacroLines: string[] = [];
    for (const s of strata) {
      for (const lvl of s.levels) {
        const lidx = levelIndices.get(s.id)?.get(lvl) ?? 1;
        const expected = (s.levelDetails ?? []).find(d => d.name === lvl)?.expectedProbability;
        const probVal = expected !== undefined ? expected : -1;
        baseProbsMacroLines.push(`local bprob_${lidx} = ${probVal}`);
      }
    }

    // Combo mapping macros for quick access
    const comboMapLines: string[] = [];
    for (let i = 0; i < nCombos; i++) {
      const combo = combos[i];
      for (let f = 0; f < strata.length; f++) {
        const lidx = levelIndices.get(strata[f].id)?.get(combo[strata[f].id] || '') ?? 1;
        comboMapLines.push(`local combo_${i+1}_f${f+1} = ${lidx}`);
      }
    }

    // Value label definitions
    const labelDefs = strata.length > 0
      ? strata.map((s, si) => {
          const lvlDefs = s.levels.map((lvl, j) => `${j + 1} ${this.escapeString(lvl)}`).join(' ');
          return `label define lbl_${varNames[si]} ${lvlDefs}, replace`;
        }).join('\n')
      : '';

    // label values statements
    const labelValues = varNames.length > 0
      ? varNames.map(v => `label values ${v} lbl_${v}`).join('\n')
      : '';

    // postfile strata variable declarations
    const postfileStrataDecl = varNames.length > 0
      ? ' ' + varNames.map(v => `int ${v}`).join(' ')
      : '';

    // Post args for strata variables
    const postStrataArgs = varNames.length > 0
      ? ' ' + varNames.map((_, i) => `(\`subj_prof_${i+1}')`).join(' ')
      : '';

    try {
      // Site macro declarations
      const siteMacros = sites.map((s, i) => `local site_${i + 1} "${s}"`).join('\n');

      // Arm macro declarations
      const armMacros = arms.map((a, i) =>
        `local arm_id_${i + 1} "${a.id}"\nlocal arm_name_${i + 1} "${a.name}"\nlocal arm_ratio_${i + 1} = ${a.ratio}`
      ).join('\n');

      const code = `${header}
* Note: Stata's PRNG algorithm will not generate the exact same sequence as the
* typescript web application, but the statistical properties and parameters are identical.

version 17
set more off
set seed ${ReproducibilityUtil.hashCode(config.seed)}

* ─── User-defined Parameters ────────────────────────────────────────────────
local p_minimization = ${p}
local total_sample_size = ${n}
local n_arms = ${n_arms}
local n_sites = ${sites.length}
local n_factors = ${strata.length}
local n_combos = ${nCombos}
local total_levels = ${totalLevels}

${siteMacros}
${armMacros}

* ─── Caps and Base Probs ────────────────────────────────────────────────────
${capMacroLines.join('\n')}
${baseProbsMacroLines.join('\n')}

* ─── Combo Factor Mapping ───────────────────────────────────────────────────
${comboMapLines.join('\n')}

* ─── Value Labels ──────────────────────────────────────────────────────────
${labelDefs}

* ─── Initialization ─────────────────────────────────────────────────────────
* Initialize active pool
forvalues i = 1/\`n_combos' {
    local active_\`i' = 1
${isMarginal ? '' : `    local count_\`i' = 0`}
}

${isMarginal ? `
* Initialize marginal counts
forvalues i = 1/\`total_levels' {
    local count_\`i' = 0
}
` : ''}

* Initialize Imbalance Matrix
forvalues i = 1/\`total_levels' {
    forvalues a = 1/\`n_arms' {
        local imb_\`i'_\`a' = 0
    }
}

* Initialize Site Counts
forvalues i = 1/\`n_sites' {
    local site_count_\`i' = 0
}

* ─── Schema Generation ──────────────────────────────────────────────────────
tempfile _schema_data
tempname _schema_fh
postfile \`_schema_fh' str50 SubjectID str50 Site int BlockNumber int BlockSize ///
    str50 Treatment str50 TreatmentId${postfileStrataDecl} ///
    using \`_schema_data', replace

forvalues s_idx = 1/\`total_sample_size' {

    * 1. Prune Active Pool
    local n_active = 0
    forvalues i = 1/\`n_combos' {
        if \`active_\`i'' == 1 {
            local keep = 1
${isMarginal ? `
            forvalues f = 1/\`n_factors' {
                local lidx = \`combo_\`i'_f\`f''
                if \`cap_\`lidx'' < ${UNCAPPED} & \`count_\`lidx'' >= \`cap_\`lidx'' {
                    local keep = 0
                    continue, break
                }
            }
` : `
            if \`cap_\`i'' < ${UNCAPPED} & \`count_\`i'' >= \`cap_\`i'' {
                local keep = 0
            }
`}
            if \`keep' == 0 local active_\`i' = 0
            else local n_active = \`n_active' + 1
        }
    }

    if \`n_active' == 0 continue, break // Exhaustion

    * 2. Select Random Site
    local r_site = ceil(runiform() * \`n_sites')
    local site "\`site_\`r_site''"

    * 3. Sample Subject Profile sequentially
    local valid_subject = 1
    forvalues f = 1/\`n_factors' {
        local n_available = 0
        forvalues lidx = 1/\`total_levels' {
            local avail_\`lidx' = 0
        }

        forvalues i = 1/\`n_combos' {
            if \`active_\`i'' == 1 {
                local match_prefix = 1
                local stop_pf = \`f' - 1
                if \`stop_pf' >= 1 {
                    forvalues pf = 1/\`stop_pf' {
                        if \`combo_\`i'_f\`pf'' != \`subj_prof_\`pf'' {
                            local match_prefix = 0
                            continue, break
                        }
                    }
                }
                if \`match_prefix' == 1 {
                    local lidx = \`combo_\`i'_f\`f''
                    if \`avail_\`lidx'' == 0 {
                        local avail_\`lidx' = 1
                        local available_\`n_available' = \`lidx'
                        local n_available = \`n_available' + 1
                    }
                }
            }
        }

        if \`n_available' == 0 {
            local valid_subject = 0
            continue, break
        }

        local explicit_sum = 0
        local na_count = 0

        forvalues lidx = 1/\`total_levels' {
            if \`avail_\`lidx'' == 1 {
                if \`bprob_\`lidx'' != -1 local explicit_sum = \`explicit_sum' + \`bprob_\`lidx''
                else local na_count = \`na_count' + 1
            }
        }

        local prob_sum = 0
        forvalues lidx = 1/\`total_levels' {
            if \`avail_\`lidx'' == 1 {
                if \`explicit_sum' > 1.0 {
                    if \`bprob_\`lidx'' != -1 local lvlprob_\`lidx' = \`bprob_\`lidx'' / \`explicit_sum'
                    else local lvlprob_\`lidx' = 0
                }
                else if \`explicit_sum' == 1.0 {
                    if \`bprob_\`lidx'' != -1 local lvlprob_\`lidx' = \`bprob_\`lidx''
                    else local lvlprob_\`lidx' = 0
                }
                else if \`explicit_sum' > 0 {
                    if \`na_count' > 0 {
                        local share = (1.0 - \`explicit_sum') / \`na_count'
                        if \`bprob_\`lidx'' != -1 local lvlprob_\`lidx' = \`bprob_\`lidx''
                        else local lvlprob_\`lidx' = \`share'
                    }
                    else {
                        if \`bprob_\`lidx'' != -1 local lvlprob_\`lidx' = \`bprob_\`lidx'' / \`explicit_sum'
                        else local lvlprob_\`lidx' = 0
                    }
                }
                else {
                    local lvlprob_\`lidx' = 1.0 / \`n_available'
                }
                local prob_sum = \`prob_sum' + \`lvlprob_\`lidx''
            }
        }

        local r = runiform() * \`prob_sum'
        local cumulative = 0
        local chosen_lvl = -1

        forvalues lidx = 1/\`total_levels' {
            if \`avail_\`lidx'' == 1 {
                local cumulative = \`cumulative' + \`lvlprob_\`lidx''
                if \`r' <= \`cumulative' {
                    local chosen_lvl = \`lidx'
                    continue, break
                }
                local last_lvl = \`lidx'
            }
        }
        if \`chosen_lvl' == -1 local chosen_lvl = \`last_lvl'

        local subj_prof_\`f' = \`chosen_lvl'
    } // factor loop

    if \`valid_subject' == 0 continue, break

    * 4. Calculate Imbalance Scores
    local min_score = 9999999
    forvalues a = 1/\`n_arms' {
        local total_score = 0
        forvalues f = 1/\`n_factors' {
            local lidx = \`subj_prof_\`f''

            local min_val = 9999999
            local max_val = -9999999
            forvalues a2 = 1/\`n_arms' {
                local count = \`imb_\`lidx'_\`a2''
                if \`a2' == \`a' local count = \`count' + 1

                local normalized = \`count' / \`arm_ratio_\`a2''
                if \`normalized' < \`min_val' local min_val = \`normalized'
                if \`normalized' > \`max_val' local max_val = \`normalized'
            }
            local total_score = \`total_score' + (\`max_val' - \`min_val')
        }
        local arm_score_\`a' = \`total_score'
        if \`total_score' < \`min_score' local min_score = \`total_score'
    }

    * 5. Separate Preferred and Non-Preferred
    local n_pref = 0
    local n_nonpref = 0
    forvalues a = 1/\`n_arms' {
        if reldif(\`arm_score_\`a'', \`min_score') < 1e-6 {
            local n_pref = \`n_pref' + 1
            local pref_\`n_pref' = \`a'
        }
        else {
            local n_nonpref = \`n_nonpref' + 1
            local nonpref_\`n_nonpref' = \`a'
        }
    }

    * 6. Assign Arm
    local assigned_arm_idx = -1
    if \`n_pref' == \`n_arms' | \`n_nonpref' == 0 {
        local w_sum = 0
        forvalues i = 1/\`n_pref' {
            local a = \`pref_\`i''
            local w_sum = \`w_sum' + \`arm_ratio_\`a''
        }
        local r_arm = runiform() * \`w_sum'
        forvalues i = 1/\`n_pref' {
            local a = \`pref_\`i''
            local r_arm = \`r_arm' - \`arm_ratio_\`a''
            if \`r_arm' <= 0 {
                local assigned_arm_idx = \`a'
                continue, break
            }
        }
        if \`assigned_arm_idx' == -1 local assigned_arm_idx = \`pref_\`n_pref''
    }
    else {
        if runiform() < \`p_minimization' {
            local w_sum = 0
            forvalues i = 1/\`n_pref' {
                local a = \`pref_\`i''
                local w_sum = \`w_sum' + \`arm_ratio_\`a''
            }
            local r_arm = runiform() * \`w_sum'
            forvalues i = 1/\`n_pref' {
                local a = \`pref_\`i''
                local r_arm = \`r_arm' - \`arm_ratio_\`a''
                if \`r_arm' <= 0 {
                    local assigned_arm_idx = \`a'
                    continue, break
                }
            }
            if \`assigned_arm_idx' == -1 local assigned_arm_idx = \`pref_\`n_pref''
        }
        else {
            local w_sum = 0
            forvalues i = 1/\`n_nonpref' {
                local a = \`nonpref_\`i''
                local w_sum = \`w_sum' + \`arm_ratio_\`a''
            }
            local r_arm = runiform() * \`w_sum'
            forvalues i = 1/\`n_nonpref' {
                local a = \`nonpref_\`i''
                local r_arm = \`r_arm' - \`arm_ratio_\`a''
                if \`r_arm' <= 0 {
                    local assigned_arm_idx = \`a'
                    continue, break
                }
            }
            if \`assigned_arm_idx' == -1 local assigned_arm_idx = \`nonpref_\`n_nonpref''
        }
    }

    * 7. Update State
    forvalues f = 1/\`n_factors' {
        local lidx = \`subj_prof_\`f''
        local imb_\`lidx'_\`assigned_arm_idx' = \`imb_\`lidx'_\`assigned_arm_idx'' + 1
${isMarginal ? `        local count_\`lidx' = \`count_\`lidx'' + 1` : ''}
    }

${!isMarginal ? `
    local matched_combo = 0
    forvalues i = 1/\`n_combos' {
        local match = 1
        forvalues f = 1/\`n_factors' {
            if \`combo_\`i'_f\`f'' != \`subj_prof_\`f'' {
                local match = 0
                continue, break
            }
        }
        if \`match' == 1 {
            local matched_combo = \`i'
            continue, break
        }
    }
    if \`matched_combo' > 0 local count_\`matched_combo' = \`count_\`matched_combo'' + 1
` : ''}

    * 8. Output Subject
    local site_count_\`r_site' = \`site_count_\`r_site'' + 1
    local subj_id = "\`site'" + "-" + string(\`site_count_\`r_site'', "%03.0f")

    post \`_schema_fh' ("\`subj_id'") ("\`site'") (0) (0) ("\`arm_name_\`assigned_arm_idx''") ("\`arm_id_\`assigned_arm_idx''")${postStrataArgs}

} // End total sample size loop

postclose \`_schema_fh'
use \`_schema_data', clear

* Apply value labels
${labelValues}

* ─── QC Checks ─────────────────────────────────────────────────────────────
di _newline "--- QC Check: Overall Allocation ---"
tabulate Treatment

di _newline "--- QC Check: Site-Level Balance ---"
tabulate Site Treatment, chi2

list in 1/20, clean noobs
`;
      return code.trim() + '\n' ;
    } catch (e) {
      if (this.isKnownError(e)) throw e;
      throw new TemplateCompilationError('STATA', e, config);
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
    const totalRatio = arms.reduce((s, a) => s + a.ratio, 0);

    const combos = this.computeCombinations(strata);
    const nCombos = combos.length;

    // Sanitised variable names for strata factors
    const varNames = strata.map(s => FormattingUtil.sanitizeStataVarName(s.id));

    // 1-based level indices: levelIdx.get(factorId).get(levelName) = 1-based integer
    const levelIdx = new Map<string, Map<string, number>>();
    for (const s of strata) {
      const m = new Map<string, number>();
      s.levels.forEach((lvl, i) => m.set(lvl, i + 1));
      levelIdx.set(s.id, m);
    }

    // Build local macro declarations for marginal caps (uncapped → 2147483647)
    const UNCAPPED = 2147483647;
    const capMacroLines: string[] = [];
    for (const s of strata) {
      const m = levelIdx.get(s.id)!;
      for (const lvl of s.levels) {
        const idx = m.get(lvl)!;
        const capEntry = (s.levelDetails ?? []).find(d => d.name === lvl);
        const capVal = capEntry !== undefined && Number.isFinite(capEntry.marginalCap)
          ? capEntry.marginalCap
          : UNCAPPED;
        const comment = capVal === UNCAPPED ? `// uncapped` : `// ${lvl} cap`;
        const safeVarName = FormattingUtil.sanitizeStataVarName(s.id);
        capMacroLines.push(`local cap_${safeVarName}_${idx} = ${capVal}  ${comment}`);
      }
    }

    // Build count macro reset lines (per site)
    const countResetLines: string[] = [];
    for (const s of strata) {
      const safeVarName = FormattingUtil.sanitizeStataVarName(s.id);
      for (let i = 1; i <= s.levels.length; i++) {
        countResetLines.push(`    local cnt_${safeVarName}_${i} = 0`);
      }
    }

    // Cap annotations for header comment
    const capAnnotations = strata.map(s => {
      const entries = s.levels.map(lvl => {
        const d = (s.levelDetails ?? []).find(ld => ld.name === lvl);
        const capVal = d !== undefined && Number.isFinite(d.marginalCap) ? d.marginalCap : 'uncapped';
        return `${lvl}=${capVal}`;
      }).join(', ');
      return `* ${s.name || s.id}: ${entries}`;
    }).join('\n');

    // Value label definitions
    const labelDefs = strata.length > 0
      ? strata.map((s, si) => {
          const lvlDefs = s.levels.map((lvl, j) => `${j + 1} ${this.escapeString(lvl)}`).join(' ');
          return `label define lbl_${varNames[si]} ${lvlDefs}, replace`;
        }).join('\n')
      : '';

    // postfile strata variable declarations
    const postfileStrataDecl = varNames.length > 0
      ? ' ' + varNames.map(v => `int ${v}`).join(' ')
      : '';

    // Post args for strata variables
    const postStrataArgs = varNames.length > 0
      ? ' ' + varNames.map((_, i) => `(chosen_${varNames[i]})`).join(' ')
      : '';

    // label values statements
    const labelValues = varNames.length > 0
      ? varNames.map(v => `label values ${v} lbl_${v}`).join('\n')
      : '';

    // Combo factor assignments for pool dataset (Cartesian product rows)
    const comboFactorAssigns = strata.map((s, si) => {
      const safeVarName = varNames[si];
      return `    * ${safeVarName}: ${s.levels.map((l, j) => `${j+1}=${l}`).join(', ')}\n` +
             `    gen int ${safeVarName} = .`;
    }).join('\n');

    const comboFactorFill = strata.length > 0
      ? combos.map((combo, ci) => {
          const assigns = strata.map((s, si) => {
            const val = levelIdx.get(s.id)?.get(combo[s.id] ?? '') ?? 1;
            return `    quietly replace ${varNames[si]} = ${val} if combo_id == ${ci + 1}`;
          }).join('\n');
          return assigns;
        }).join('\n')
      : '';

    // Per-subject cap check: only used in countUpdates / cap-check code sections below

    // Count update macros after enrolling a subject
    const countUpdates = strata.map((s, si) => {
      const safeVarName = varNames[si];
      return s.levels.map((_, j) => {
        const idx = j + 1;
        return `                if chosen_${safeVarName} == ${idx} local cnt_${safeVarName}_${idx} = \`cnt_${safeVarName}_${idx}' + 1`;
      }).join('\n');
    }).join('\n');

    // Factor-value extraction from chosen combo row
    const factorValueExtraction = varNames.map(v =>
      `        local chosen_${v} = ${v}[\`_chosen_row']`
    ).join('\n');

    // Block size pick code
    let blockSizePick: string;
    if (blockSizes.length === 1) {
      blockSizePick = `        local cur_bs = ${blockSizes[0]}`;
    } else {
      const parts = blockSizes.map((bs, i) => {
        const threshold = ((i + 1) / blockSizes.length).toFixed(5);
        if (i === 0) return `        if _rand_bs <= ${threshold} local cur_bs = ${bs}`;
        if (i === blockSizes.length - 1) return `        else local cur_bs = ${bs}`;
        return `        else if _rand_bs <= ${threshold} local cur_bs = ${bs}`;
      });
      blockSizePick = `        local _rand_bs = runiform()\n${parts.join('\n')}`;
    }

    const stataMethodologyBlock = this.methodologySpec.formatAsLineComments(
      this.methodologySpec.generateNarrative(config), '*'
    );
    const stataBlockStrategyComment = this.buildBlockStrategySection('*', config);
    const n_arms = arms.length;

    try {
      // Site macro declarations
      const siteMacros = sites.map((s, i) =>
        `local site_${i + 1} "${s}"`
      ).join('\n');

      // Arm macro declarations
      const armMacros = arms.map((a, i) =>
        `local arm_name_${i + 1} "${a.name}"\nlocal arm_ratio_${i + 1} = ${a.ratio}`
      ).join('\n');

      let code = `* Randomization Schema Generation in Stata
* Protocol: ${config.protocolId || 'Unknown'}
* Study: ${config.studyName || 'Unknown'}
* App Version: ${APP_VERSION}
* Generated At: ${generatedAt}
* PRNG Algorithm: Mersenne Twister
* Source Seed Hash: ${ReproducibilityUtil.get128BitHash(config.seed)}
* Cap Strategy: MARGINAL_ONLY
* Per-factor, per-level caps; no intersection caps needed.
${stataBlockStrategyComment ? stataBlockStrategyComment + '\n' : ''}${capAnnotations ? capAnnotations + '\n' : ''}${stataMethodologyBlock}
* Subjects are allocated by randomly selecting valid stratum combinations
* until no combination can accept additional subjects.

version 17
set more off
set seed ${ReproducibilityUtil.hashCode(config.seed)}

* ─── User-defined Parameters ────────────────────────────────────────────────
local total_ratio = ${totalRatio}
local block_sizes "${blockSizes.join(' ')}"
local n_bs : word count \`block_sizes'
local n_arms = ${n_arms}
${armMacros}
local n_sites = ${sites.length}
${siteMacros}

* Block Math Failsafe
forvalues b = 1/\`n_bs' {
    local bs : word \`b' of \`block_sizes'
    if mod(\`bs', \`total_ratio') != 0 {
        di as error "Block size \`bs' is not a multiple of total allocation ratio \`total_ratio'."
        exit 198
    }
}
`;

      if (labelDefs) {
        code += `
* ─── Value Labels ──────────────────────────────────────────────────────────
${labelDefs}
`;
      }

      // Marginal cap macros
      if (capMacroLines.length > 0) {
        code += `
* ─── Marginal Caps (${UNCAPPED} = uncapped) ─────────────────────────────────
${capMacroLines.join('\n')}
`;
      }

      code += `
* ─── Active Pool Dataset (one row per strata combination) ──────────────────
tempfile _pool_file
quietly {
    clear
    set obs ${nCombos}
    gen long combo_id = _n
    gen byte active = 1
`;

      if (strata.length > 0) {
        code += comboFactorAssigns + '\n' + comboFactorFill + '\n';
      }

      code += `    save \`_pool_file', replace
}

* ─── Schema Generation ──────────────────────────────────────────────────────
tempfile _schema_data
tempname _schema_fh
postfile \`_schema_fh' str50 SubjectID str50 Site int BlockNumber int BlockSize ///
    str50 Treatment${postfileStrataDecl} ///
    using \`_schema_data', replace

if \`n_sites' > 0 {
forvalues s = 1/\`n_sites' {
    local site \`site_\`s''
    local site_count = 0
    local block_num = 0

    * Reset active pool and marginal counts for this site
    quietly use \`_pool_file', clear
    quietly replace active = 1
${countResetLines.join('\n')}

    quietly count if active == 1
    local n_active = r(N)
    local total_rows = _N

    while \`n_active' > 0 {
        * Randomly select an active combination
        local rand_pick = ceil(runiform() * \`n_active')
        local seen = 0
        local _chosen_row = 0
        forvalues _i = 1/\`total_rows' {
            if active[\`_i'] == 1 {
                local seen = \`seen' + 1
                if \`seen' == \`rand_pick' {
                    local _chosen_row = \`_i'
                    continue, break
                }
            }
        }
        if \`_chosen_row' == 0 continue, break
`;

      if (factorValueExtraction) {
        code += factorValueExtraction + '\n';
      }

      code += `
        * Pick random block size
${blockSizePick}
        local multiplier = \`cur_bs' / \`total_ratio'
        local block_num = \`block_num' + 1

        * Build treatment block using indexed local macros
        local blk_idx = 0
        forvalues a = 1/\`n_arms' {
            local arm_name \`arm_name_\`a''
            local arm_ratio = \`arm_ratio_\`a''
            local arm_reps = round(\`arm_ratio' * \`multiplier')
            forvalues r = 1/\`arm_reps' {
                local blk_idx = \`blk_idx' + 1
                local blk_\`blk_idx' \`arm_name'
            }
        }
        local n_block = \`blk_idx'

        * Fisher-Yates shuffle
        forvalues _i = \`n_block'(-1)2 {
            local _j = ceil(runiform() * \`_i')
            local _tmp \`blk_\`_i''
            local blk_\`_i' \`blk_\`_j''
            local blk_\`_j' \`_tmp'
        }

        * Process each subject in the block (checking marginal caps)
        forvalues t = 1/\`n_block' {
            * Marginal cap check
            local can_add = 1
`;

      if (strata.length > 0) {
        // Build a simpler per-factor cap check using the chosen factor values
        const capCheckLines = strata.map((s, si) => {
          const safeVarName = varNames[si];
          return s.levels.map((_, j) => {
            const idx = j + 1;
            return `            if chosen_${safeVarName} == ${idx} & \`cnt_${safeVarName}_${idx}' >= \`cap_${safeVarName}_${idx}' local can_add = 0`;
          }).join('\n');
        }).join('\n');
        code += capCheckLines + '\n';
      }

      code += `            if \`can_add' == 0 continue, break

            local site_count = \`site_count' + 1
            local subj_id = "\`site'" + "-" + string(\`site_count', "%03.0f")
            post \`_schema_fh' ("\`subj_id'") ("\`site'") (\`block_num') (\`cur_bs') ("\`blk_\`t''")${postStrataArgs}
`;

      if (countUpdates) {
        code += countUpdates + '\n';
      }

      code += `        }

        * Prune pool: deactivate combinations that breach any marginal cap
        forvalues _i = 1/\`total_rows' {
            if active[\`_i'] == 0 continue
            local _exhausted = 0
`;

      if (strata.length > 0) {
        const pruneLines = strata.map((s, si) => {
          const safeVarName = varNames[si];
          return s.levels.map((_, j) => {
            const idx = j + 1;
            return `            if ${safeVarName}[\`_i'] == ${idx} & \`cnt_${safeVarName}_${idx}' >= \`cap_${safeVarName}_${idx}' local _exhausted = 1`;
          }).join('\n');
        }).join('\n');
        code += pruneLines + '\n';
      }

      code += `            if \`_exhausted' == 1 quietly replace active = 0 in \`_i'
        }

        quietly count if active == 1
        local n_active = r(N)
    }
}
} // end if \`n_sites' > 0

postclose \`_schema_fh'
use \`_schema_data', clear
`;

      if (labelValues) {
        code += `
* Apply value labels
${labelValues}
`;
      }

      code += `
* ─── QC Checks ─────────────────────────────────────────────────────────────
di _newline "--- QC Check: Overall Allocation ---"
tabulate Treatment

di _newline "--- QC Check: Site-Level Balance ---"
tabulate Site Treatment, chi2

di _newline "--- QC Check: Block Size Distribution ---"
tabulate BlockSize

list in 1/20, clean noobs

* export delimited "randomization_schema.csv", replace
`;
      return code.trim() + '\n' ;
    } catch (e) {
      if (this.isKnownError(e)) throw e;
      throw new TemplateCompilationError('STATA', e, config);
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
