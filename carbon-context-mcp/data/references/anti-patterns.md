# Carbon Anti-Patterns — what makes a UI "fake Carbon"

> The failure mode for AI-generated Carbon is **themed-generic**: a Tailwind/Material layout
> wearing Carbon colors. Real Carbon is recognizable by token discipline, the 2x Grid, IBM Plex,
> flat surfaces with layer contrast (no drop shadows), and sentence-case content. Name these
> anti-patterns to yourself and check your output against them before delivering.

---

## A. The "fake Carbon" slop clusters — recognize and avoid

1. **Hardcoded hex/px instead of tokens.** `color: #161616; padding: 16px;` → `color: theme.$text-primary; padding: spacing.$spacing-05;`. This is the single biggest tell and it breaks all four themes.
2. **Drop shadows / elevation for depth.** Material-style `box-shadow` cards. Carbon uses **layer tokens** for depth, not shadows. Tiles are flat; separate surfaces with `$layer-01/02/03`, not `box-shadow`.
3. **Rounded corners everywhere.** Carbon is low-radius / mostly square. Don't apply `border-radius: 12px` to everything; respect component defaults.
4. **Wrong type.** Inter/Roboto/system-ui instead of **IBM Plex**; arbitrary font sizes instead of type tokens (`body-01`, `heading-03`). Plex + the type scale *is* the Carbon voice.
5. **Title Case and trailing periods.** Carbon is strictly **sentence case** ("Save changes", not "Save Changes") and notification/labels have **no terminal period**.
6. **Emoji or random icon sets.** Use `@carbon/icons` only. No 🚀/✅ emoji, no Font Awesome.
7. **Non-grid layout.** Free-floating flexbox with magic margins instead of `<Grid>`/`<Column>` on the 16-col 2x Grid.
8. **Reinventing components.** Hand-rolled `<div>` modals/dropdowns/tables instead of `Modal`/`Dropdown`/`DataTable`. If Carbon has it, use it.
9. **Gradient/glassmorphism accents.** Carbon is sober and enterprise; no purple gradients, no frosted glass.
10. **Centered button labels / icon-only buttons without tooltips.** Labels are left-aligned; icon-only needs `iconDescription`.

---

## B. Correct vs. wrong (copy-pasteable)

**Color & spacing**
```scss
/* ❌ wrong — breaks theming, dark mode */
.card { background: #ffffff; color: #161616; padding: 16px; box-shadow: 0 2px 6px rgba(0,0,0,.1); }

/* ✅ right — token-driven, flat, theme-aware */
@use '@carbon/styles/scss/theme';
@use '@carbon/styles/scss/spacing';
.card { background: theme.$layer; color: theme.$text-primary; padding: spacing.$spacing-05; }
```

**Type**
```scss
/* ❌ */ .title { font-family: Inter, sans-serif; font-size: 20px; font-weight: 700; }
/* ✅ */ @use '@carbon/styles/scss/type'; .title { @include type.type-style('heading-03'); }
```

**Content**
```
❌ "Save Changes."   ❌ "Error: Something Went Wrong!"
✅ "Save changes"    ✅ "Upload failed"  (+ subtitle with the next step)
```

**Layout**
```jsx
/* ❌ */ <div style={{ display:'flex', gap: 24, margin: '0 auto', maxWidth: 1200 }}>…</div>
/* ✅ */ <Grid><Column sm={4} md={8} lg={16}>…</Column></Grid>
```

---

## C. Code gotchas that break Carbon (the must-knows)

1. **Sass mandatory.** No `@use '@carbon/react';` in a Sass file (and `node_modules` on the load path) → unstyled components. Dart Sass only; use `@use`, not legacy `@import`.
2. **Prefix is `cds`, not `bx`.** `bx--*` classes are v10. If you change `$prefix`, your class names must match.
3. **Theming needs both layers.** `GlobalTheme`/`Theme` set context; the colors only apply if the Sass styles (and `scss/zone` for inline `Theme`) are included.
4. **Grid nesting.** `<Column>` must be a direct child of `<Grid>` (or a nested subgrid). CSS Grid is the v11 default; flexbox grid is opt-in with different classes.
5. **`labelText`/`id` required on inputs.** `TextInput`, `Dropdown`, `Select`, etc. need them for a11y. Icon-only buttons need `iconDescription`.
6. **Controlled inputs need `onChange`.** Passing `value`/`selectedItem` without `onChange` makes the field read-only.
7. **`Dropdown.onChange` returns `{ selectedItem }`**, not a DOM event.
8. **DataTable render-prop transforms rows.** The render-prop `rows` have a `.cells` array — not your raw rows. Spread `getRowProps`/`getHeaderProps`/`getTableProps`; every raw row needs a unique `id`.
9. **Icons are components.** `renderIcon={Add}`, not `renderIcon={<Add/>}`. Import from `@carbon/react/icons`.
10. **Don't hardcode colors/spacing** — see §A.1; use tokens so theming works.
11. **`@carbon/ibm-products` is separate** and must version-align with `@carbon/react`; some components need feature flags enabled.
12. **Next.js App Router:** import global Sass once in root `layout.tsx`; add `"use client"` to interactive Carbon components.
13. **Web Components is a different package & major** (`@carbon/web-components` v2, `<cds-*>` elements) — not interchangeable with `@carbon/react`.

---

## D. Component-judgment traps (design, not code)

- **More than one primary button** on a screen, or a **secondary button with no primary**.
- **Mixing data-table header and body row heights** (must match).
- **Dropdown for 2 options** (use radio buttons).
- **Spinner where a skeleton belongs** (tables, content placeholders).
- **Modal for non-critical info** (use toast/inline notification).
- **Callout used as feedback** (it's persistent page guidance, never dismissible).
- **Ignoring `prefers-reduced-motion`** and the **44px** interactive touch-target minimum.
- **Mixing in non-Carbon component patterns** (a Material FAB, a Bootstrap navbar) inside a Carbon app.
