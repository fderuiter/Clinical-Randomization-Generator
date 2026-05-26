## 2024-05-26 - [Avoid Map and Set for hot-loops]
**Learning:** Found an opportunity to optimize Monte Carlo simulation arrays by avoiding object iteration. In high-iteration environments like Monte Carlo testing, using simple array lengths and preallocating avoids garbage collection.
**Action:** Replace `const armCounts: Record<string, number> = {};` with `const armCounts = new Float64Array(config.arms.length);` in `runMonteCarlo` or just standard simple for loops and indexed arrays.
