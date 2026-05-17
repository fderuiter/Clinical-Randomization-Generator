## 2024-05-14 - Optimize O(N) array filtering in algorithm loops
**Learning:** O(N) array filtering operations (`.filter()`) inside large simulation loops (like Monte Carlo aggregations for randomization schemas) cause significant performance degradation when called unconditionally per iteration, even if the state hasn't changed.
**Action:** Introduce a boolean flag (e.g., `poolNeedsFilter`) to short-circuit filtering until state changes make it necessary. Initialize the flag to `true` to ensure the initial pool is correctly filtered against any historical assignments that may have already reached their caps.

## 2024-05-24 - Precompute configuration maps to avoid nested array iterations
**Learning:** Initializing algorithmic state by searching configuration arrays with `.find()` inside nested loops creates an O(N^2) bottleneck, which is particularly slow for large simulation tasks.
**Action:** Always precalculate/pre-map configuration arrays into an O(1) `Map` keyed by invariant identifiers before entering configuration iteration loops.

## 2024-05-24 - Array allocation overhead in algorithmic hot-loops
**Learning:** Using high-level array iteration methods like `.map()`, `.filter()`, and `.reduce()` within Monte Carlo hot-loops introduces excessive short-lived array allocations and garbage collection overhead, severely degrading throughput.
**Action:** Replace functional array methods in core algorithm mathematical loops with raw `for` loops, manual counters, and pre-allocated arrays to optimize execution speed.
