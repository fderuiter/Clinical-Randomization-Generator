## 2026-05-20 - Drag Handle Affordance
**Learning:** When implementing drag handles for sortable list items in the UI, relying on simple text characters (like `⋮⋮`) lacks sufficient visual cues for interactivity and accessibility. Users benefit from multiple layered affordances.
**Action:** Use an SVG icon button with CSS classes for `cursor-grab`, `active:cursor-grabbing`, an explicit `aria-label`, a `title` attribute, and distinct `focus-visible` styling to ensure visual affordance and keyboard accessibility.
