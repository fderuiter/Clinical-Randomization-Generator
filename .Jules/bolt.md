
## 2024-05-18 - Optimize algorithm inner loops for JS JIT
**Learning:** In highly CPU-bound simulation code (like Monte Carlo minimization iterations generating 1000s of schemas), chaining higher-order functional array methods (`.filter`, `.some`, `.every`) on dynamic arrays adds massive closure allocation overhead and forces O(N) traversals per check.
**Action:** Unroll these into standard `for...of` loops, use `Set` for intersection tracking, and `break`/`continue` early to heavily prune the algorithm state space, significantly boosting hot-path performance without altering external behavior.
