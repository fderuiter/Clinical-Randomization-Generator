import { RandomizationConfig } from '../../../../core/models/randomization.model';
import { generateRandomizationSchema } from '../../../../randomization-engine/core/randomization-algorithm';
import { FormattingUtil } from '../formatting.util';
import { ReproducibilityUtil } from '../reproducibility.util';
import { R_TEMPLATE, SAS_TEMPLATE, PYTHON_TEMPLATE, STATA_TEMPLATE } from './templates';

export class CodeTranspiler {
  
  private static renderTemplate(template: string, data: Record<string, string | number>): string {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value));
    }
    return result.trim() + '\n';
  }

  static transpile(lang: 'R'|'Python'|'SAS'|'STATA', config: RandomizationConfig, method: 'BLOCK' | 'MINIMIZATION'): string {
    const schema = generateRandomizationSchema(config).schema;
    const seedHash = ReproducibilityUtil.hashCode(config.seed);
    const dateStr = new Date().toISOString().substring(0, 19);
    const algorithm = method === 'MINIMIZATION' ? 'Pocock-Simon Minimization' : 'PRNG Algorithm: MT19937';

    const data: Record<string, string | number> = {
      protocolId: config.protocolId,
      dateStr,
      algorithm,
      seedHash
    };

    if (lang === 'SAS') {
      data['arms'] = config.arms.map(a => `"${FormattingUtil.escapeSasString(a.name)}"`).join(' ');
      data['armsNames'] = data['arms'];
      data['strataFactors'] = (config.strata || []).map(s => `"${FormattingUtil.escapeSasString(s.id)}"`).join(' ');
      data['ratios'] = config.arms.map(a => a.ratio).join(', ');
      
      let strataComments = '';
      (config.strata || []).forEach(s => {
          strataComments += `/* Levels for ${s.id}: ${s.levels.join(', ')} */\n`;
      });
      data['strataComments'] = strataComments.trim();

      data['minimizationParam'] = method === 'MINIMIZATION' ? `%let p_minimization = ${config.minimizationConfig?.p || 0.8}; /* maintain precision parity */\n/* specific rounding or comparison functions injected for SAS */` : '';
      data['blockSizesParam'] = method === 'BLOCK' ? `%let block_sizes = ${(config.blockSizes || []).join(' ')};` : '';

      let strataLength = '';
      for (const s of config.strata || []) {
          strataLength += ` ${FormattingUtil.escapeSasString(s.id)} $50`;
      }
      data['strataLength'] = strataLength;

      let schemaRows = '';
      for (const row of schema) {
         schemaRows += `  SubjectID="${FormattingUtil.escapeSasString(row.subjectId)}"; ` +
                `Site="${FormattingUtil.escapeSasString(row.site)}"; ` +
                `Treatment="${FormattingUtil.escapeSasString(row.treatmentArm)}"; ` +
                `BlockNumber=${row.blockNumber}; ` +
                `BlockSize=${row.blockSize}; ` +
                `StratumCode="${FormattingUtil.escapeSasString(row.stratumCode)}"; `;
         for (const s of config.strata || []) {
             schemaRows += `  ${FormattingUtil.escapeSasString(s.id)}="${FormattingUtil.escapeSasString(row.stratum[s.id])}"; `;
         }
         schemaRows += `output;\n`;
      }
      data['schemaRows'] = schemaRows.trimEnd();
      return this.renderTemplate(SAS_TEMPLATE, data);
    } else if (lang === 'STATA') {
      let armsVars = '';
      config.arms.forEach((a, i) => {
        armsVars += `local arm_name_${i + 1} ${FormattingUtil.stataLabelQuote(a.name)}\n`;
      });
      data['armsVars'] = armsVars.trim();

      let strataComments = '';
      (config.strata || []).forEach((s, i) => {
         strataComments += `local strata_${i+1} "\`"${FormattingUtil.sanitizeStataVarName(s.id)}"'"\n`;
         s.levels.forEach(l => {
             strataComments += `* Level: ${FormattingUtil.stataLabelQuote(l)}\n`;
         });
      });
      data['strataComments'] = strataComments.trim();
      data['ratios'] = config.arms.map(a => a.ratio).join(', ');

      data['minimizationParam'] = method === 'MINIMIZATION' ? `local p_minimization = round(${config.minimizationConfig?.p || 0.8}, 1e-6) // Stata 1e-6 precision handled` : '';
      
      let blockSizesParam = '';
      if (method === 'BLOCK') {
         config.blockSizes.forEach((b, i) => blockSizesParam += `local block_${i+1} ${b}\n`);
         blockSizesParam += `local cap = 0`;
      }
      data['blockSizesParam'] = blockSizesParam.trim();

      data['schemaLength'] = schema.length || 1;

      let strataLength = '';
      (config.strata || []).forEach(s => strataLength += `gen str50 ${FormattingUtil.sanitizeStataVarName(s.id)} = ""\n`);
      data['strataLength'] = strataLength.trimEnd();

      let schemaRows = '';
      schema.forEach((row, i) => {
         schemaRows += `replace SubjectID=${FormattingUtil.stataLabelQuote(row.subjectId)} in ${i+1}\n`;
         schemaRows += `replace Site=${FormattingUtil.stataLabelQuote(row.site)} in ${i+1}\n`;
         const armName = config.arms.find(a => a.id === row.treatmentArmId)?.name || row.treatmentArmId;
         schemaRows += `replace Treatment=${FormattingUtil.stataLabelQuote(armName)} in ${i+1}\n`;
         schemaRows += `replace BlockNumber=${row.blockNumber} in ${i+1}\n`;
         schemaRows += `replace BlockSize=${row.blockSize} in ${i+1}\n`;
         schemaRows += `replace StratumCode=${FormattingUtil.stataLabelQuote(row.stratumCode)} in ${i+1}\n`;
         (config.strata || []).forEach(s => {
             schemaRows += `replace ${FormattingUtil.sanitizeStataVarName(s.id)}=${FormattingUtil.stataLabelQuote(row.stratum[s.id])} in ${i+1}\n`;
         });
      });
      data['schemaRows'] = schemaRows.trimEnd();
      return this.renderTemplate(STATA_TEMPLATE, data);
    } else if (lang === 'Python') {
      data['arms'] = config.arms.map(a => FormattingUtil.escapePythonString(a.name)).join(', ');
      data['ratios'] = config.arms.map(a => a.ratio).join(', ');
      
      let strataComments = '';
      (config.strata || []).forEach(s => {
          strataComments += `# Stratum: ${s.id}, Levels: ${s.levels.map(l => FormattingUtil.escapePythonString(l)).join(', ')}\n`;
      });
      data['strataComments'] = strataComments.trimEnd();
      data['minimizationParam'] = method === 'MINIMIZATION' ? `p_minimization = ${config.minimizationConfig?.p || 0.8} # maintain precision parity` : '';

      let schemaRows = '';
      for (const row of schema) {
         schemaRows += `  {"SubjectID": "${row.subjectId}", "Site": "${row.site}", "Treatment": "${row.treatmentArm}", "BlockNumber": ${row.blockNumber}, "BlockSize": ${row.blockSize}, "StratumCode": "${row.stratumCode}"`;
         for (const s of config.strata || []) {
             schemaRows += `, "${s.id}": "${FormattingUtil.escapePythonString(row.stratum[s.id])}"`;
         }
         schemaRows += `},\n`;
      }
      data['schemaRows'] = schemaRows.trimEnd();
      return this.renderTemplate(PYTHON_TEMPLATE, data);
    } else if (lang === 'R') {
      data['arms'] = config.arms.map(a => FormattingUtil.escapeRString(a.name)).join(', ');
      data['ratios'] = config.arms.map(a => a.ratio).join(', ');
      
      let strataComments = '';
      (config.strata || []).forEach(s => {
          strataComments += `# Stratum: ${s.id}, Levels: ${s.levels.map(l => FormattingUtil.escapeRString(l)).join(', ')}\n`;
      });
      data['strataComments'] = strataComments.trimEnd();
      data['minimizationParam'] = method === 'MINIMIZATION' ? `p_minimization <- ${config.minimizationConfig?.p || 0.8} # maintain precision parity` : '';

      let schemaRows = '';
      schema.forEach((row, i) => {
         schemaRows += `schema_list[[${i+1}]] <- data.frame(SubjectID="${row.subjectId}", Site="${row.site}", Treatment="${row.treatmentArm}", BlockNumber=${row.blockNumber}, BlockSize=${row.blockSize}, StratumCode="${row.stratumCode}"`;
         for (const s of config.strata || []) {
             schemaRows += `, ${s.id}="${FormattingUtil.escapeRString(row.stratum[s.id])}"`;
         }
         schemaRows += `, stringsAsFactors=FALSE)\n`;
      });
      data['schemaRows'] = schemaRows.trimEnd();
      return this.renderTemplate(R_TEMPLATE, data);
    }
    
    return '';
  }
}
