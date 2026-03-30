import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';
import seedrandom from 'seedrandom';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
app.use(express.json());
const angularApp = new AngularNodeAppEngine();

interface TreatmentArm {
  id: string;
  name: string;
  ratio: number;
}

interface StratificationFactor {
  id: string;
  name: string;
  levels: string[];
}

interface RandomizationConfig {
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

interface AuditLogEntry {
  userId: string;
  timestamp: string;
  protocolId: string;
  parameters: RandomizationConfig;
  seed: string;
  randomizationCode: string;
}

const auditLogs: AuditLogEntry[] = [];

app.get('/api/audit-logs', (req, res) => {
  res.json(auditLogs);
});

app.post('/api/randomize', (req, res) => {
  try {
    const config: RandomizationConfig = req.body;
    
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
        res.status(400).json({ error: `Block size ${size} is not a multiple of total ratio ${totalRatio}` });
        return;
      }
    }
    
    const schema = [];
    
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
    
    res.json({
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
    
    // Audit Log
    const logEntry: AuditLogEntry = {
      userId: 'System', // Placeholder since there is no auth
      timestamp: new Date().toISOString(),
      protocolId: config.protocolId,
      seed: config.seed,
      parameters: config,
      randomizationCode: `// Core randomization logic used for block generation:
const rng = seedrandom(config.seed);
// ...
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
}`
    };
    auditLogs.push(logEntry);
    
    console.log(JSON.stringify({
      event: 'SCHEMA_GENERATED',
      ...logEntry
    }));
  } catch (error) {
    console.error('Randomization error:', error);
    res.status(500).json({ error: 'Internal server error during randomization' });
  }
});

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
