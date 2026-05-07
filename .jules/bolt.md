## 2025-02-12 - ChangeDetectionStrategy.OnPush enforcement
**Learning:** Found several Angular components lacking explicit `ChangeDetectionStrategy.OnPush` declaration.
**Action:** Enforce `ChangeDetectionStrategy.OnPush` across all Angular components to improve rendering performance and minimize change detection cycles.
## 2025-05-05 - Minimization algorithm memory layout optimization
**Learning:** Found significant bottlenecks in the `activePool` loop of the minimization algorithm, relying heavily on `.map().join()` and `Object.entries()` over large arrays and dynamically constructed keys.
**Action:** Use precalculated properties (`_key`) injected into array elements and explicit bounds/caching to optimize hot-paths.
## 2025-05-07 - Minimization Object.entries and filter short-circuiting
**Learning:** Found performance bottlenecks in the core minimization algorithm: `Object.entries()` inside hot loops created substantial intermediate allocations, and expensive array filtering conditions weren't short-circuited.
**Action:** Replace `Object.entries()` with `for...of` iterating over structurally available schemas (like `strata`) using string indexing, and always place simple static checks (like value matches) before iterating through dynamic arrays to short-circuit earlier.
