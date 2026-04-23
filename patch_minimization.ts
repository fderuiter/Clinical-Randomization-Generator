import * as fs from 'fs';

const targetFile = 'src/app/domain/randomization-engine/core/minimization-algorithm.ts';
let content = fs.readFileSync(targetFile, 'utf8');

// We need to implement a uniform site allocation and cap enforcement mechanism.
// Let's rewrite generateMinimization and replace sampleLevel.
