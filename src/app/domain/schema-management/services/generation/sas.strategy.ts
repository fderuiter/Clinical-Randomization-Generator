import { Injectable } from "@angular/core";
import { RandomizationConfig } from '../../../core/models/randomization.model';
import { CodeGenerationStrategy } from './base.strategy';
import { FormattingUtil } from './formatting.util';
import { ReproducibilityUtil } from './reproducibility.util';
import { APP_VERSION } from '../../../../../environments/version';
import { MethodologySpecificationService } from '../methodology-specification.service';
import { StrataParsingError, TemplateCompilationError, ConfigurationValidationError } from '../../errors/code-generation-errors';

@Injectable()
export class SasStrategy implements CodeGenerationStrategy {
  readonly language = 'SAS';

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

    // Branch to the marginal-only template which has entirely different generation logic.
    if (capStrategy === 'MARGINAL_ONLY') {
      this.validateMarginalOnlyConfig(config);
      return this.buildMarginalOnly(config);
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
      strataLevelLines = strata.map(s => `%let ${s.id}_levels = ${(s.levels || []).map(l => `"${FormattingUtil.escapeSasString(l)}"`).join(' ')};`).join('\n');
      capsLengthDecl = strata.length > 0 ? strata.map(s => ` ${s.id} $50`).join('') : '';
      if (caps.length === 0) {
        capsRows = `  max_subjects_per_stratum = 0; output;\n`;
      } else {
        capsRows = caps.map(c => {
          let row = '';
          if (strata.length > 0) {
            strata.forEach(s => { row += `  ${s.id} = "${FormattingUtil.escapeSasString(c.levelIds?.[s.id] ?? '')}";`; });
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
/* Source Seed Hash: ${ReproducibilityUtil.get128BitHash(config.seed)} */
${sasCapStrategyComment}${sasBlockStrategyComment ? '\n' + sasBlockStrategyComment : ''}
${sasMethodologyBlock}

%let seed = ${ReproducibilityUtil.hashCode(config.seed)};
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

      return code.trim() + '\n' ;
    } catch (e) {
      if (this.isKnownError(e)) throw e;
      throw new TemplateCompilationError('SAS', e, config);
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
    const totalRatio = arms.reduce((s, a) => s + a.ratio, 0);

    const header = this.generateMinimizationHeader('SAS', config);

    // Prepare macro definitions for strata levels and arms
    const sasSites = sites.map(s => `"${s}"`).join(' ');
    const sasArmsIds = arms.map(a => `"${a.id}"`).join(' ');
    const sasArmsNames = arms.map(a => `"${a.name}"`).join(' ');
    const sasRatios = arms.map(a => String(a.ratio)).join(' ');

    const nFactors = strata.length;
    const nArms = arms.length;

    // Use computeCombinations to find all possible strata combinations
    const combos = this.computeCombinations(strata);
    const nCombos = combos.length;

    // Assign a 1-based global level index to every (factorId, levelName) pair.
    let globalIdx = 0;
    const levelIndices = new Map<string, Map<string, number>>();
    for (const s of strata) {
      const m = new Map<string, number>();
      for (const lvl of s.levels) { m.set(lvl, ++globalIdx); }
      levelIndices.set(s.id, m);
    }
    const totalLevels = Math.max(globalIdx, 1);

    // Marginal caps array (-1 = uncapped)
    const capsArr: number[] = new Array(totalLevels).fill(-1);
    if (isMarginal) {
      for (const s of strata) {
        for (let i = 0; i < s.levels.length; i++) {
          const cap = s.levelDetails?.[i]?.marginalCap;
          if (cap !== undefined) {
            capsArr[(levelIndices.get(s.id)?.get(s.levels[i]) ?? 1) - 1] = cap;
          }
        }
      }
    }

    // Intersection caps array
    const intersectionCapsArr: number[] = new Array(nCombos).fill(-1);
    if (!isMarginal) {
      const capsDict = new Map<string, number>();
      for (const c of config.stratumCaps || []) {
        capsDict.set(strata.map(s => c.levelIds?.[s.id] || '').join('|'), c.cap);
      }
      for (let i = 0; i < combos.length; i++) {
        const combo = combos[i];
        const key = strata.map(s => combo[s.id] || '').join('|');
        if (capsDict.has(key)) {
          intersectionCapsArr[i] = capsDict.get(key) as number;
        }
      }
    }

    // Base probabilities mapping
    const baseProbsArr: number[] = new Array(totalLevels).fill(-1); // -1 signifies undefined/uniform
    for (const s of strata) {
      for (let i = 0; i < s.levels.length; i++) {
        const expected = s.levelDetails?.[i]?.expectedProbability;
        if (expected !== undefined) {
          baseProbsArr[(levelIndices.get(s.id)?.get(s.levels[i]) ?? 1) - 1] = expected;
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

    // Per-factor character arrays mapping level index to string values
    const factorLevelArrays = strata.map(s => ({
      id: s.id,
      values: s.levels.map(lvl => lvl.replace(/\r?\n/g, ' ').replace(/'/g, "''"))
    }));

    const charArrayDecls = factorLevelArrays.map(f => {
      // Initialize a full array but only put values in the relevant slots.
      // (SAS arrays are 1-based by default)
      // To simplify, we'll map the global ID directly
      return `  array _lvl_name_${f.id}[${totalLevels}] $50 _temporary_ ;`;
    }).join('\n');

    const charArrayInits = strata.map(s => {
      // Use original level names for the index lookup; use separately-escaped values for the SAS string literal.
      let initBlock = '';
      for (const lvl of s.levels) {
        const idx = levelIndices.get(s.id)?.get(lvl) ?? 1;
        const escapedLvl = lvl.replace(/\r?\n/g, ' ').replace(/'/g, "''");
        initBlock += `  _lvl_name_${s.id}[${idx}] = '${escapedLvl}';\n`;
      }
      return initBlock;
    }).join('');

    const strataAssign = factorLevelArrays.map(f =>
      `      ${f.id} = _lvl_name_${f.id}[_subj_profile[${strata.indexOf(strata.find(s=>s.id===f.id)!)+1}]];`
    ).join('\n');

    const levelMapComment = strata.map(s =>
      `  /* ${s.id}: ${s.levels.map(lvl => `${lvl}->${levelIndices.get(s.id)?.get(lvl) ?? '?'}`).join(', ')} */`
    ).join('\n');

    const code = `${header}
/* Note: SAS's PRNG algorithm will not generate the exact same sequence as the
typescript web application, but the statistical properties and parameters are identical. */

%let seed = ${ReproducibilityUtil.hashCode(config.seed)};
%let total_ratio = ${totalRatio};

/* User-defined Parameters */
%let arms_ids = ${sasArmsIds};
%let arms_names = ${sasArmsNames};
%let ratios = ${sasRatios};
%let sites = ${sasSites};
%let p_minimization = ${p};
%let total_sample_size = ${n};
%let n_factors = ${nFactors};
%let n_arms = ${nArms};
%let n_combos = ${nCombos};
%let total_levels = ${totalLevels};

/* Level-index map for global indexing: */
${levelMapComment}

data _schema_minimization;
  length SubjectID $50 Site $50 Treatment $50 TreatmentId $50${nFactors > 0 ? ' ' + strata.map(s => `${s.id} $50`).join(' ') : ''};
  call streaminit(&seed.);

  /* Active pool flag (1=active, 0=inactive) */
  array _active[&n_combos.] _temporary_;

  /* Combo-to-level-index flat mapping: _combo_fidx[(combo-1)*n_factors + factor_pos] */
${nFactors > 0 ? `  array _combo_fidx[${comboFidxArr.length}] _temporary_ (${comboFidxArr.join(' ')});` : '  /* No strata factors defined */'}

${isMarginal ? `
  /* Marginal caps array (1-based index, -1 = uncapped) */
  array _caps[&total_levels.] _temporary_ (${capsArr.join(' ')});
  /* Enrollment count array for marginals */
  array _counts[&total_levels.] _temporary_;
` : `
  /* Intersection caps array (1-based index, -1 = uncapped) */
  array _caps[&n_combos.] _temporary_ (${intersectionCapsArr.join(' ')});
  /* Enrollment count array for intersections */
  array _counts[&n_combos.] _temporary_;
`}

  /* Base Expected Probabilities (-1 = missing/undefined) */
${totalLevels > 0 ? `  array _base_probs[&total_levels.] _temporary_ (${baseProbsArr.join(' ')});` : ''}

  /* Marginal imbalance tracking: _imbalance[(level_idx - 1)*n_arms + arm_idx] */
${totalLevels > 0 && nArms > 0 ? `  array _imbalance[${totalLevels * nArms}] _temporary_;` : '  /* No levels or arms */'}

  /* Treatment Ratios Array */
  array _ratios[&n_arms.] _temporary_;

  /* Name arrays */
  array _site_names[100] $50 _temporary_;
  array _arm_ids[&n_arms.] $50 _temporary_;
  array _arm_names[&n_arms.] $50 _temporary_;

  /* Current Subject Profile Factor Indices */
  array _subj_profile[&n_factors.] _temporary_;
  array _available_levels[&total_levels.] _temporary_;
  array _level_probs[&total_levels.] _temporary_;

  /* Score calculation arrays */
  array _arm_scores[&n_arms.] _temporary_;
  array _preferred_arms[&n_arms.] _temporary_;
  array _non_preferred_arms[&n_arms.] _temporary_;

${charArrayDecls}

  /* Initialization Block */
  if _N_ = 1 then do;
${charArrayInits}

    _n_sites = countw("&sites.", ' ', 'q');
    do _i = 1 to _n_sites;
      _site_names[_i] = dequote(scan("&sites.", _i, ' ', 'q'));
    end;

    do _i = 1 to &n_arms.;
      _arm_ids[_i] = dequote(scan("&arms_ids.", _i, ' ', 'q'));
      _arm_names[_i] = dequote(scan("&arms_names.", _i, ' ', 'q'));
      _ratios[_i] = input(scan("&ratios.", _i, ' '), best.);
    end;

    do _i = 1 to &n_combos.; _active[_i] = 1; end;
${isMarginal ? `
    do _i = 1 to &total_levels.; _counts[_i] = 0; end;
` : `
    do _i = 1 to &n_combos.; _counts[_i] = 0; end;
`}
    do _i = 1 to ${totalLevels * nArms}; _imbalance[_i] = 0; end;
  end;

  /* Setup site counts map (using parallel array since SAS lacks hash dict in standard variables easily across iterations) */
  array _site_counts[100] _temporary_;
  do _i = 1 to 100; _site_counts[_i] = 0; end;

  /* Main Minimization Loop over Total Sample Size */
  do _s = 1 to &total_sample_size.;

    /* 1. Prune Active Pool */
    _n_active = 0;
    do _i = 1 to &n_combos.;
      if _active[_i] = 1 then do;
        _keep = 1;
${isMarginal ? `
        do _f = 1 to &n_factors.;
          _lidx = _combo_fidx[(_i - 1) * &n_factors. + _f];
          if _caps[_lidx] >= 0 and _counts[_lidx] >= _caps[_lidx] then do;
            _keep = 0;
            _f = &n_factors. + 1; /* exit loop */
          end;
        end;
` : `
        if _caps[_i] >= 0 and _counts[_i] >= _caps[_i] then _keep = 0;
`}
        if _keep = 0 then _active[_i] = 0;
        else _n_active = _n_active + 1;
      end;
    end;

    if _n_active = 0 then leave; /* Exhaustion */

    /* 2. Select Random Site */
    _rand_site_idx = floor(rand('Uniform') * _n_sites) + 1;
    Site = _site_names[_rand_site_idx];

    /* 3. Sample Subject Profile sequentially by factor */
    _valid_subject = 1;
    do _f = 1 to &n_factors.;
      /* Find available levels for this factor given current prefix in active pool */
      _n_available = 0;
      do _lvl_i = 1 to &total_levels.; _available_levels[_lvl_i] = 0; end;

      do _i = 1 to &n_combos.;
        if _active[_i] = 1 then do;
          /* Check prefix match */
          _match_prefix = 1;
          do _pf = 1 to _f - 1;
            if _combo_fidx[(_i - 1) * &n_factors. + _pf] ^= _subj_profile[_pf] then do;
              _match_prefix = 0;
              _pf = _f; /* break inner */
            end;
          end;

          if _match_prefix = 1 then do;
            _lidx = _combo_fidx[(_i - 1) * &n_factors. + _f];
            if _available_levels[_lidx] = 0 then do;
               _available_levels[_lidx] = 1;
               _n_available = _n_available + 1;
            end;
          end;
        end;
      end;

      if _n_available = 0 then do;
        _valid_subject = 0;
        _f = &n_factors. + 1; /* break */
      end;
      else do;
        /* Sample Level logic */
        _explicit_sum = 0;
        _na_count = 0;

        do _lidx = 1 to &total_levels.;
          if _available_levels[_lidx] = 1 then do;
             _p = _base_probs[_lidx];
             if _p ^= -1 then _explicit_sum = _explicit_sum + _p;
             else _na_count = _na_count + 1;
          end;
        end;

        do _lidx = 1 to &total_levels.;
          if _available_levels[_lidx] = 1 then do;
            _p = _base_probs[_lidx];
            if _explicit_sum > 1.0 then do;
               if _p ^= -1 then _level_probs[_lidx] = _p / _explicit_sum;
               else _level_probs[_lidx] = 0;
            end;
            else if _explicit_sum = 1.0 then do;
               if _p ^= -1 then _level_probs[_lidx] = _p;
               else _level_probs[_lidx] = 0;
            end;
            else if _explicit_sum > 0 then do;
               if _na_count > 0 then do;
                 _share = (1.0 - _explicit_sum) / _na_count;
                 if _p ^= -1 then _level_probs[_lidx] = _p;
                 else _level_probs[_lidx] = _share;
               end;
               else do;
                 if _p ^= -1 then _level_probs[_lidx] = _p / _explicit_sum;
                 else _level_probs[_lidx] = 0;
               end;
            end;
            else do;
               _level_probs[_lidx] = 1.0 / _n_available;
            end;
          end;
        end;

        /* Normalize and cumulative selection */
        _prob_sum = 0;
        do _lidx = 1 to &total_levels.;
          if _available_levels[_lidx] = 1 then _prob_sum = _prob_sum + _level_probs[_lidx];
        end;

        _r = rand('Uniform') * _prob_sum;
        _cumulative = 0;
        _chosen_lvl = -1;
        do _lidx = 1 to &total_levels.;
          if _available_levels[_lidx] = 1 then do;
             _cumulative = _cumulative + _level_probs[_lidx];
             if _r <= _cumulative then do;
                _chosen_lvl = _lidx;
                _lidx = &total_levels. + 1; /* break */
             end;
             _last_lvl = _lidx; /* Fallback */
          end;
        end;
        if _chosen_lvl = -1 then _chosen_lvl = _last_lvl;

        _subj_profile[_f] = _chosen_lvl;
      end;
    end; /* factor loop */

    if _valid_subject = 0 then leave;

    /* 4. Calculate Imbalance Scores */
    _min_score = 9999999;
    do _a = 1 to &n_arms.;
      _total_score = 0;
      do _f = 1 to &n_factors.;
        _lidx = _subj_profile[_f];

        /* Calculate min and max normalized counts across arms, simulating if candidate arm was chosen */
        _min_val = 9999999;
        _max_val = -9999999;

        do _a2 = 1 to &n_arms.;
          _imb_idx = (_lidx - 1) * &n_arms. + _a2;
          _count = _imbalance[_imb_idx];
          if _a2 = _a then _count = _count + 1;

          _normalized = _count / _ratios[_a2];
          if _normalized < _min_val then _min_val = _normalized;
          if _normalized > _max_val then _max_val = _normalized;
        end;

        _total_score = _total_score + (_max_val - _min_val);
      end;
      _arm_scores[_a] = _total_score;
      if _total_score < _min_score then _min_score = _total_score;
    end;

    /* 5. Separate Preferred and Non-Preferred */
    _n_pref = 0;
    _n_nonpref = 0;
    do _a = 1 to &n_arms.;
      if _arm_scores[_a] = _min_score then do;
        _n_pref = _n_pref + 1;
        _preferred_arms[_n_pref] = _a;
      end;
      else do;
        _n_nonpref = _n_nonpref + 1;
        _non_preferred_arms[_n_nonpref] = _a;
      end;
    end;

    /* 6. Assign Arm */
    _assigned_arm_idx = -1;

    if _n_pref = &n_arms. or _n_nonpref = 0 then do;
      /* Weighted random from preferred */
      _w_sum = 0;
      do _i = 1 to _n_pref; _w_sum = _w_sum + _ratios[_preferred_arms[_i]]; end;
      _r_arm = rand('Uniform') * _w_sum;
      do _i = 1 to _n_pref;
        _r_arm = _r_arm - _ratios[_preferred_arms[_i]];
        if _r_arm <= 0 then do;
          _assigned_arm_idx = _preferred_arms[_i];
          _i = _n_pref + 1;
        end;
      end;
      if _assigned_arm_idx = -1 then _assigned_arm_idx = _preferred_arms[_n_pref];
    end;
    else do;
      if rand('Uniform') < &p_minimization. then do;
        _w_sum = 0;
        do _i = 1 to _n_pref; _w_sum = _w_sum + _ratios[_preferred_arms[_i]]; end;
        _r_arm = rand('Uniform') * _w_sum;
        do _i = 1 to _n_pref;
          _r_arm = _r_arm - _ratios[_preferred_arms[_i]];
          if _r_arm <= 0 then do;
            _assigned_arm_idx = _preferred_arms[_i];
            _i = _n_pref + 1;
          end;
        end;
        if _assigned_arm_idx = -1 then _assigned_arm_idx = _preferred_arms[_n_pref];
      end;
      else do;
        _w_sum = 0;
        do _i = 1 to _n_nonpref; _w_sum = _w_sum + _ratios[_non_preferred_arms[_i]]; end;
        _r_arm = rand('Uniform') * _w_sum;
        do _i = 1 to _n_nonpref;
          _r_arm = _r_arm - _ratios[_non_preferred_arms[_i]];
          if _r_arm <= 0 then do;
            _assigned_arm_idx = _non_preferred_arms[_i];
            _i = _n_nonpref + 1;
          end;
        end;
        if _assigned_arm_idx = -1 then _assigned_arm_idx = _non_preferred_arms[_n_nonpref];
      end;
    end;

    /* 7. Update State (Imbalance & Counts) */
    do _f = 1 to &n_factors.;
      _lidx = _subj_profile[_f];
      _imb_idx = (_lidx - 1) * &n_arms. + _assigned_arm_idx;
      _imbalance[_imb_idx] = _imbalance[_imb_idx] + 1;
${isMarginal ? `
      _counts[_lidx] = _counts[_lidx] + 1;
` : ''}
    end;

${!isMarginal ? `
    /* Find matching combo index for intersection count update */
    _matched_combo = 0;
    do _i = 1 to &n_combos.;
      _match = 1;
      do _f = 1 to &n_factors.;
        if _combo_fidx[(_i - 1) * &n_factors. + _f] ^= _subj_profile[_f] then do;
           _match = 0;
           _f = &n_factors. + 1;
        end;
      end;
      if _match = 1 then do;
         _matched_combo = _i;
         _i = &n_combos. + 1;
      end;
    end;
    if _matched_combo > 0 then _counts[_matched_combo] = _counts[_matched_combo] + 1;
` : ''}

    /* 8. Output Subject */
    TreatmentId = _arm_ids[_assigned_arm_idx];
    Treatment = _arm_names[_assigned_arm_idx];
    BlockSize = 0;
    BlockNumber = 0;

    _site_counts[_rand_site_idx] = _site_counts[_rand_site_idx] + 1;
    SubjectID = cats(Site, "-", put(_site_counts[_rand_site_idx], z3.));

${strataAssign}

    output;
  end; /* Main subject loop */

  drop _:;
run;

/* Quality Control (QC) Checks */
proc freq data=_schema_minimization;
  title "Overall Treatment Balance";
  tables Treatment / nocum;
run;

proc freq data=_schema_minimization;
  title "Site-Level Treatment Balance";
  tables Site * Treatment / nocol nopercent;
run;

title "Randomization Schema Preview";
proc print data=_schema_minimization(obs=20);
run;
title;
`;
    return code.trim() + '\n' ;
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
      values: combos.map(c => (c[s.id] ?? s.levels[0] ?? '').replace(/\r?\n/g, ' ').replace(/'/g, "''"))
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
      ? strata.map(s => `%let ${s.id}_levels = ${s.levels.map(l => `"${FormattingUtil.escapeSasString(l)}"`).join(' ')};`).join('\n') + '\n'
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
/* Source Seed Hash: ${ReproducibilityUtil.get128BitHash(config.seed)} */
/* Cap Strategy: MARGINAL_ONLY */
/* Per-factor, per-level caps; no intersection caps needed. */
/* Implementation: SAS DATA step with temporary arrays (base SAS 9.2+). */
${this.buildBlockStrategySection('#', config).split('\n').map(l => l.replace(/^#/, '/*') + ' */').join('\n').replace(/\/\* {2}\*\//g, '')}
${capAnnotations}
${sasMethodologyBlock}

%let seed = ${ReproducibilityUtil.hashCode(config.seed)};
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
    return code.trim() + '\n' ;
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
