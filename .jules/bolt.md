
## 2024-05-04 - Precomputing invariant keys for algorithms
**Learning:** In the randomization algorithms (`randomization-algorithm.ts` and `minimization-algorithm.ts`), the performance was degraded by recalculating the same string keys (`.map().join('|')`) dynamically per element within inner looping or filtering logic (`activePool.filter()`). Precomputing string keys onto objects can significantly reduce object iteration overhead.
**Action:** When filtering objects inside algorithmic hot-loops, check if filtering relies on keys that can be computed statically and add `_key` or related properties to the objects once, then access the pre-calculated property in the loop to vastly reduce redundant string manipulation and object iteration overhead.
