## 2024-05-17 - Add tooltips (titles) and ARIA labels to button groups
**Learning:** Icon-only or partially icon-based action buttons in the results grid missed tooltip context (title) and distinct ARIA labels (e.g. Export buttons missing 'Export as Excel' semantics for screen readers).
**Action:** When creating grouped UI actions or icon-driven data export buttons, always supply `title` for sighted users and `aria-label` for assistive technology to clarify intent.
