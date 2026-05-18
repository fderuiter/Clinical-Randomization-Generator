
## 2026-05-18 - Upgrade Drag Handles
**Learning:** Plain-text characters like '⋮⋮' used as UI controls lack the visual affordance and interaction states expected in modern apps.
**Action:** Always use proper SVG icons for drag handles, accompanied by `cursor-grab`, an explicit `aria-label`, a `title` attribute, and distinct `focus-visible` styling for keyboard users navigating sortable lists.
