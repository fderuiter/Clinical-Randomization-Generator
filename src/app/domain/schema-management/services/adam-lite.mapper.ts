import { AdamLiteDataset, AdamLiteVariable } from '../../core/models/adam-lite.model';
import { RandomizationResult } from '../../core/models/randomization.model';

export class AdamLiteMapper {
  static fromRandomizationResult(result: RandomizationResult): AdamLiteDataset {
    const variables: AdamLiteVariable[] = [
      { id: 'subjectId', label: 'Subject ID', type: 'identifier', metadataTags: ['Subject'] },
      { id: 'site', label: 'Site', type: 'categorical', metadataTags: ['Site'] },
      { id: 'treatmentArm', label: 'Treatment Arm', type: 'categorical', metadataTags: ['Group'] },
      { id: 'blockNumber', label: 'Block Number', type: 'continuous', metadataTags: [] },
      { id: 'blockSize', label: 'Block Size', type: 'continuous', metadataTags: [] },
      { id: 'stratumCode', label: 'Stratum Code', type: 'categorical', metadataTags: [] },
    ];

    for (const stratum of result.metadata.strata || []) {
      variables.push({
        id: `stratum_${stratum.id}`,
        label: stratum.name || stratum.id,
        type: 'categorical',
        metadataTags: ['Stratum']
      });
    }

    const records = result.schema.map(row => {
      const rec: Record<string, any> = {
        subjectId: row.subjectId,
        site: row.site,
        treatmentArm: row.treatmentArm,
        blockNumber: row.blockNumber,
        blockSize: row.blockSize,
        stratumCode: row.stratumCode,
      };
      
      for (const [key, val] of Object.entries(row.stratum || {})) {
        rec[`stratum_${key}`] = val;
      }
      
      return rec;
    });

    return {
      name: result.metadata.studyName || 'Randomization Dataset',
      variables,
      records
    };
  }
}
