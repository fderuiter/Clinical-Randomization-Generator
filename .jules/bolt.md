## Initializing Bolt Journal
## 2024-04-27 - Angular ChangeDetectionStrategy

**Learning:** Missing `ChangeDetectionStrategy.OnPush` in components within an Angular application that utilizes Signals and RxJS can lead to unnecessary re-renders during change detection cycles. This negatively impacts frontend performance, especially in components dealing with large datasets or frequent updates like forms and grids.
**Action:** Ensure all Angular components implement `ChangeDetectionStrategy.OnPush` to optimize frontend performance, as required by the application memory guidelines.
