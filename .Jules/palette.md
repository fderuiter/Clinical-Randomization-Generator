## 2026-05-20 - Drag Handle Affordance
**Learning:** When implementing drag handles for sortable list items in the UI, relying on simple text characters (like `⋮⋮`) lacks sufficient visual cues for interactivity and accessibility. Users benefit from multiple layered affordances.
**Action:** Use an SVG icon button with CSS classes for `cursor-grab`, `active:cursor-grabbing`, an explicit `aria-label`, a `title` attribute, and distinct `focus-visible` styling to ensure visual affordance and keyboard accessibility.

## 2026-05-21 - Remove Button Accessibility
**Learning:** Icon-only remove buttons in tag/chip inputs need more than just an `aria-label`. They also require a `title` attribute so sighted mouse users can discover what the button does on hover, and proper focus styling for keyboard users.
**Action:** Add `[attr.title]` and `focus-visible:ring-2 focus-visible:ring-indigo-500 rounded` to small removal buttons like the one in `TagInputComponent`.
