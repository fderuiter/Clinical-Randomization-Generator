## 2025-02-12 - ChangeDetectionStrategy.OnPush enforcement
**Learning:** Found several Angular components lacking explicit `ChangeDetectionStrategy.OnPush` declaration.
**Action:** Enforce `ChangeDetectionStrategy.OnPush` across all Angular components to improve rendering performance and minimize change detection cycles.

## 2025-02-12 - Minimization algorithm dynamic key and array allocation overhead
**Learning:** In the randomization Monte Carlo simulations, filtering the combinations pool repeatedly across all factors dynamically computed the combination key using `map().join()` which causes huge string manipulation overhead, and `Object.entries()` inside `Array.prototype.some` caused large intermediate object allocations per combination evaluation inside a very hot loop.
**Action:** When implementing combinatorial generation algorithms, precalculate and attach invariant keys directly to objects when they are created, and avoid intermediate array/object destructors like `Object.entries` in deep hot-loops in favor of index-based loops over a precalculated array of object keys.
