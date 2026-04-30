## 2026-04-30 - Added OnPush ChangeDetectionStrategy
**Learning:** Adding `ChangeDetectionStrategy.OnPush` to Angular components that heavily rely on Signals and RxJS prevents unnecessary change detection cycles and significantly improves application rendering performance.
**Action:** Always ensure that UI components, particularly those using Signals or custom structural state, specify `changeDetection: ChangeDetectionStrategy.OnPush` when performance optimization is necessary.
