import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import seedrandom from 'seedrandom';

export interface TreatmentArm {
  id: string;
  name: string;
  ratio: number;
}

export interface StratificationFactor {
  id: string;
  name: string;
  levels: string[];
}

export interface RandomizationConfig {
  protocolId: string;
  studyName: string;
  phase: string;
  arms: TreatmentArm[];
  sites: string[];
  strata: StratificationFactor[];
  blockSizes: number[];
  subjectsPerSite: number;
  seed: string;
  subjectIdMask: string;
}

export interface GeneratedSchema {
  subjectId: string;
  site: string;
  stratum: Record<string, string>;
  stratumCode: string;
  blockNumber: number;
  blockSize: number;
  treatmentArm: string;
  treatmentArmId: string;
}

export interface RandomizationResult {
  metadata: {
    protocolId: string;
    studyName: string;
    phase: string;
    seed: string;
    generatedAt: string;
    strata: StratificationFactor[];
    config: RandomizationConfig;
  };
  schema: GeneratedSchema[];
}

@Injectable({
  providedIn: 'root'
})
export class RandomizationService {
  generateSchema(config: RandomizationConfig): Observable<RandomizationResult> {
    try {
      if (!config.seed) {
        config.seed = Math.random().toString(36).substring(2, 15);
      }

      const rng = seedrandom(config.seed);

      // Generate all strata combinations
      let strataCombinations: Record<string, string>[] = [{}];
      for (const factor of config.strata) {
        const newCombinations: Record<string, string>[] = [];
        for (const combo of strataCombinations) {
          for (const level of factor.levels) {
            newCombinations.push({ ...combo, [factor.id]: level });
          }
        }
        strataCombinations = newCombinations;
      }

      // Calculate total ratio sum
      const totalRatio = config.arms.reduce((sum, arm) => sum + arm.ratio, 0);

      // Validate block sizes
      for (const size of config.blockSizes) {
        if (size % totalRatio !== 0) {
          return throwError(() => ({ error: { error: `Block size ${size} is not a multiple of total ratio ${totalRatio}` } }));
        }
      }

      const schema: GeneratedSchema[] = [];

      for (const site of config.sites) {
        for (const stratum of strataCombinations) {
          let subjectCount = 0;
          let blockNumber = 1;

          // Generate enough blocks for the site/stratum
          while (subjectCount < config.subjectsPerSite) {
            // Pick a random block size from the allowed sizes
            const blockSizeIndex = Math.floor(rng() * config.blockSizes.length);
            const blockSize = config.blockSizes[blockSizeIndex];

            // Create the block
            const block: TreatmentArm[] = [];
            const multiplier = blockSize / totalRatio;

            for (const arm of config.arms) {
              for (let i = 0; i < arm.ratio * multiplier; i++) {
                block.push(arm);
              }
            }

            // Fisher-Yates shuffle
            for (let i = block.length - 1; i > 0; i--) {
              const j = Math.floor(rng() * (i + 1));
              [block[i], block[j]] = [block[j], block[i]];
            }

            // Assign subjects
            for (const arm of block) {
              subjectCount++;

              // Format Subject ID
              let subjectId = config.subjectIdMask;
              subjectId = subjectId.replace('[SiteID]', site);

              // Generate StratumCode (e.g., A1, B2, etc. or just join levels)
              const stratumCode = Object.values(stratum).map(v => v.substring(0, 3).toUpperCase()).join('-');
              subjectId = subjectId.replace('[StratumCode]', stratumCode);

              // Replace [001] with padded number
              const match = subjectId.match(/\[(0+)1\]/);
              if (match) {
                const padding = match[1].length + 1;
                const paddedNum = subjectCount.toString().padStart(padding, '0');
                subjectId = subjectId.replace(match[0], paddedNum);
              } else {
                subjectId = subjectId.replace('[001]', subjectCount.toString().padStart(3, '0'));
              }

              schema.push({
                subjectId,
                site,
                stratum,
                stratumCode,
                blockNumber,
                blockSize,
                treatmentArm: arm.name,
                treatmentArmId: arm.id
              });

              if (subjectCount >= config.subjectsPerSite) break;
            }
            blockNumber++;
          }
        }
      }

      return of({
        metadata: {
          protocolId: config.protocolId,
          studyName: config.studyName,
          phase: config.phase,
          seed: config.seed,
          generatedAt: new Date().toISOString(),
          strata: config.strata,
          config: config
        },
        schema
      });
    } catch (error) {
      console.error('Randomization error:', error);
      return throwError(() => ({ error: { error: 'Internal error during randomization' } }));
    }
  }
}
