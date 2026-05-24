## 2024-05-24 - Optimizing algorithmic hot loop for minimization

**Learning:** When using `activePool.some()` or `.filter()` to check if combinations exist in algorithmic hot-loops, we were recalculating the `some()` predicate for every possible level of every factor for every subject. With a large number of possible factor combinations, this resulted in an exponential performance degradation due to nested higher-order array filtering, leading to times >20s for large pools.

**Action:** Replace the per-level `.some()` check inside `.filter()` with a single O(N) pass over `activePool`. Track valid levels using a `Set`, and short-circuit the loop early if `seenLevels.size === factor.levels.length`. This reduces the complexity from `O(L * N)` to `O(N)` (where L is the number of levels for a factor, and N is the size of `activePool`), and often finishes much faster due to the early break, yielding an ~8x performance improvement on large combination pools.
