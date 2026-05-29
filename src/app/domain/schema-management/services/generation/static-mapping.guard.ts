import { RandomizationConfig } from '../../../core/models/randomization.model';
import { MappingMismatchError } from '../../errors/code-generation-errors';
import { ReproducibilityUtil } from './reproducibility.util';
import { FormattingUtil } from './formatting.util';

export class StaticMappingGuard {
  static verify(language: 'R' | 'SAS' | 'Python' | 'STATA', config: RandomizationConfig, output: string): void {
    // 1. Verify Seed
    const expectedSeed = ReproducibilityUtil.hashCode(config.seed).toString();
    if (!output.includes(expectedSeed)) {
      throw new MappingMismatchError(language, `Seed hash ${expectedSeed} not found in logic.`, config);
    }

    // 2. Verify Arms
    for (const arm of config.arms || []) {
      let armNameStr = arm.name;
      if (language === 'R') armNameStr = FormattingUtil.escapeRString(arm.name);
      else if (language === 'Python') armNameStr = FormattingUtil.escapePythonString(arm.name);
      else if (language === 'SAS') armNameStr = FormattingUtil.escapeSasString(arm.name);
      else if (language === 'STATA') armNameStr = FormattingUtil.stataLabelQuote(arm.name);

      if (!output.includes(armNameStr) && !output.includes(arm.name) && !output.includes(FormattingUtil.escapeSasString(arm.name))) {
        throw new MappingMismatchError(language, `Treatment arm "${arm.name}" not found in logic.`, config);
      }
      
      // Ratios
      if (!output.includes(arm.ratio.toString())) {
        throw new MappingMismatchError(language, `Treatment ratio ${arm.ratio} not found in logic.`, config);
      }
    }

    // 3. Verify Strata
    for (const stratum of config.strata || []) {
      let stratumId = stratum.id;
      if (language === 'STATA') stratumId = FormattingUtil.sanitizeStataVarName(stratum.id);

      if (!output.includes(stratumId)) {
        throw new MappingMismatchError(language, `Stratum factor "${stratum.id}" not found in logic.`, config);
      }

      for (const level of stratum.levels || []) {
        let levelStr = level;
        if (language === 'R') levelStr = FormattingUtil.escapeRString(level);
        else if (language === 'Python') levelStr = FormattingUtil.escapePythonString(level);
        else if (language === 'SAS') levelStr = FormattingUtil.escapeSasString(level);
        else if (language === 'STATA') levelStr = FormattingUtil.stataLabelQuote(level);

        if (!output.includes(levelStr) && !output.includes(level)) {
          throw new MappingMismatchError(language, `Stratum level "${level}" not found in logic.`, config);
        }
      }
    }

    // 4. Identify orphaned variables (variables in script that do not exist in schema)
    if (language === 'SAS') {
      const armsMatch = output.match(/%let arms\s*=\s*(.*?);/i);
      if (armsMatch) {
        const definedArms = armsMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/(^"|"$)/g, '').replace(/""/g, '"')) || [];
        const schemaArms = config.arms.map(a => a.name);
        for (const da of definedArms) {
          if (!schemaArms.includes(da)) {
            throw new MappingMismatchError(language, `Orphaned variable: Treatment arm "${da}" found in script but not in schema.`, config);
          }
        }
      }
      const armsNamesMatch = output.match(/%let arms_names\s*=\s*(.*?);/i);
      if (armsNamesMatch) {
        const definedArms = armsNamesMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/(^"|"$)/g, '').replace(/""/g, '"')) || [];
        const schemaArms = config.arms.map(a => a.name);
        for (const da of definedArms) {
          if (!schemaArms.includes(da)) {
            throw new MappingMismatchError(language, `Orphaned variable: Treatment arm "${da}" found in script but not in schema.`, config);
          }
        }
      }
      
      const strataFactorsMatch = output.match(/%let strata_factors\s*=\s*(.*?);/i);
      if (strataFactorsMatch) {
        const definedStrata = strataFactorsMatch[1].match(/"([^"]+)"/g)?.map(s => s.replace(/(^"|"$)/g, '').replace(/""/g, '"')) || [];
        const schemaStrata = (config.strata || []).map(s => s.id);
        for (const ds of definedStrata) {
          if (!schemaStrata.includes(ds)) {
             throw new MappingMismatchError(language, `Orphaned variable: Stratum "${ds}" found in script but not in schema.`, config);
          }
        }
      }
    } else if (language === 'STATA') {
      const armDefs = [...output.matchAll(/local arm_name_\d+\s+\`?"([^"]+)"?'?/g)].map(m => m[1]);
      const schemaArms = config.arms.map(a => a.name);
      for (const da of armDefs) {
        if (!schemaArms.includes(da)) {
          throw new MappingMismatchError(language, `Orphaned variable: Treatment arm "${da}" found in script but not in schema.`, config);
        }
      }

      const strataDefs = [...output.matchAll(/local strata_\d+\s+\`?"([^"]+)"?'?/g)].map(m => m[1]);
      const schemaStrata = (config.strata || []).map(s => s.id);
      for (const ds of strataDefs) {
        // Stata ID may be sanitized in the generated output, so we need to sanitize schemaStrata to compare
        const sanitizedSchemaStrata = schemaStrata.map(id => FormattingUtil.sanitizeStataVarName(id));
        if (!schemaStrata.includes(ds) && !sanitizedSchemaStrata.includes(ds)) {
          throw new MappingMismatchError(language, `Orphaned variable: Stratum "${ds}" found in script but not in schema.`, config);
        }
      }
    }
  }
}
