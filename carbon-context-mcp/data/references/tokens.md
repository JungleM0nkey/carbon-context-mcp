# Carbon Tokens Reference (v11)

> The single rule that makes Carbon *Carbon*: **emit tokens, never literals.** Every spacing,
> color, type, and motion value below has a token. Hardcoding a px or hex breaks theming, dark
> mode, and responsive behavior. When you reach for a number, find its token here first.

Sass token names use `$name` (from `@carbon/styles`/`@carbon/react`). The same tokens exist as CSS
custom properties `--cds-<name>` and, for JS, as exports from `@carbon/elements`.

---

## 1. Spacing scale (`$spacing-01` … `$spacing-13`)

Rooted in the **8px mini-unit**. Use for padding, margin, gap — never raw px.

| Token | rem | px | Typical use |
|-------|-----|----|-------------|
| `$spacing-01` | 0.125 | 2 | Hairline insets |
| `$spacing-02` | 0.25 | 4 | Tight icon/text gaps |
| `$spacing-03` | 0.5 | 8 | Compact component padding |
| `$spacing-04` | 0.75 | 12 | |
| `$spacing-05` | 1 | 16 | **Default gutter / component padding** |
| `$spacing-06` | 1.5 | 24 | Section spacing |
| `$spacing-07` | 2 | 32 | |
| `$spacing-08` | 2.5 | 40 | |
| `$spacing-09` | 3 | 48 | |
| `$spacing-10` | 4 | 64 | Large layout gaps |
| `$spacing-11` | 5 | 80 | |
| `$spacing-12` | 6 | 96 | |
| `$spacing-13` | 10 | 160 | Page-level whitespace |

Fixed sizing scale (for icons/avatars/tiles): 8, 16, 24, 32, 48, 64, 80 (all mini-unit multiples).

---

## 2. The 2x Grid & breakpoints

8px mini-unit underlies everything. **16 columns** at `lg` and up.

| Breakpoint | Width (px / rem) | Columns | Margin | Sass key |
|------------|------------------|---------|--------|----------|
| Small `sm` | 320 / 20 | 4 | 0 | `'sm'` |
| Medium `md` | 672 / 42 | 8 | 16px | `'md'` |
| Large `lg` | 1056 / 66 | 16 | 16px | `'lg'` |
| X-Large `xlg` | 1312 / 82 | 16 | 16px | `'xlg'` |
| Max | 1584 / 99 | 16 | 24px | `'max'` |

- **Gutter:** 32px default (16px padding each side of a column). Modes: **wide (32)**, **narrow (16,** gutter hangs into margin), **condensed (1px)**.
- **Aspect-ratio tokens:** 1:1, 2:1, 2:3, 3:2, 4:3, 16:9.
- React: `<Grid>` + `<Column sm={4} md={8} lg={16}>`. Props `condensed` / `narrow` for tighter modes.
- A `<Column>` must be a direct child of a `<Grid>` (or a nested subgrid). Never put columns in arbitrary divs.

---

## 3. Typography (IBM Plex)

**Font stacks:**
- Sans: `'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif`
- Mono: `'IBM Plex Mono', 'Menlo', 'DejaVu Sans Mono', Courier, monospace`
- Serif: `'IBM Plex Serif', 'Georgia', Times, serif`

**Weights:** Light 300, Regular 400, SemiBold 600 (SemiBold for section headers, *not* long text).

**Two type sets:** suffix `-01` = **productive** (dense product UI, fixed sizes); suffix `-02` = **expressive** (editorial/marketing, larger/responsive). Apply with the Sass mixin `@include type.type-style('heading-03');`.

**Key type tokens** — `token: font-size / line-height / weight / letter-spacing`:

| Token | px / lh / weight / tracking | Use |
|-------|------------------------------|-----|
| `code-01` | 12 / 16 / 400 / 0.32px | Inline code (Plex Mono) |
| `code-02` | 14 / 20 / 400 / 0.32px | Code blocks |
| `label-01` | 12 / 16 / 400 / 0.32px | Field labels, captions |
| `label-02` | 14 / 18 / 400 / 0.16px | Larger labels |
| `helper-text-01` | 12 / 16 / 400 / 0.32px | Helper text under fields |
| `body-compact-01` | 14 / 18 / 400 / 0.16px | Dense body |
| `body-01` | 14 / 20 / 400 / 0.16px | **Default body** |
| `body-02` | 16 / 24 / 400 / 0px | Comfortable body |
| `heading-compact-01` | 14 / 18 / **600** / 0.16px | Dense headings |
| `heading-01` | 14 / 20 / 600 / 0.16px | Small heading |
| `heading-02` | 16 / 24 / 600 / 0px | |
| `heading-03` | 20 / 28 / 400 / 0px | Section heading |
| `heading-04` | 28 / 36 / 400 / 0px | |
| `heading-05` | 32 / 40 / 400 / 0px | Page title |
| `heading-06` | 42 / 50 / 300 / 0px | Expressive |
| `heading-07` | 54 / 64 / 300 / 0px | Display |

**Fluid tokens** (`fluid-heading-03/04/05/06`, `fluid-display-01..04`, `fluid-paragraph-01`, `fluid-quotation-01/02`) scale font-size responsively across breakpoints — use for expressive/marketing layouts only.

---

## 4. Color — role-based tokens & themes

A token is a **role**, not a hex. The name stays constant across themes; the value remaps. Naming pattern: `$[element]-[role]-[state]` (e.g. `$text-secondary`, `$background-hover`, `$layer-01`).

### Token groups (the ones you'll use constantly)

| Group | Key tokens | Purpose |
|-------|-----------|---------|
| Background | `$background`, `$background-hover`, `$background-active`, `$background-selected` | Page / primary surface |
| **Layer** | `$layer-01`, `$layer-02`, `$layer-03` (+ `-hover/-active/-selected`) | Stacked/elevated surfaces |
| Field | `$field-01`, `$field-02` | Input backgrounds |
| Border | `$border-subtle`, `$border-strong`, `$border-interactive`, `$border-inverse` | Dividers, input borders |
| **Text** | `$text-primary`, `$text-secondary`, `$text-placeholder`, `$text-helper`, `$text-on-color`, `$text-disabled`, `$text-error`, `$text-inverse` | Type colors |
| Link | `$link-primary`, `$link-secondary`, `$link-inverse`, `$link-visited` | Links |
| Icon | `$icon-primary`, `$icon-secondary`, `$icon-on-color`, `$icon-disabled` | Icons |
| **Support** | `$support-error`, `$support-success`, `$support-warning`, `$support-info` (+ `-inverse`) | Status |
| **Focus** | `$focus`, `$focus-inset`, `$focus-inverse` | Keyboard focus ring — never remove |
| Interactive | `$interactive`, `$link-primary` | Primary accent |
| Skeleton | `$skeleton-background`, `$skeleton-element` | Loading placeholders |

In Sass, import `@use '@carbon/styles/scss/theme';` then reference `theme.$text-primary` (resolves to `var(--cds-text-primary)`, so it reacts to the active theme automatically). Use `theme.get('text-primary')` for a raw value (e.g. inside `rgba()`).

### The four themes

| Theme | Mode | Global background |
|-------|------|-------------------|
| White (`white`) | light | `#ffffff` |
| Gray 10 (`g10`) | light | `#f4f4f4` |
| Gray 90 (`g90`) | dark | `#262626` |
| Gray 100 (`g100`) | dark | `#161616` |

**Layering model** — nest surfaces so each step contrasts against the previous in *every* theme:
`$background → $layer-01 → $layer-02 → $layer-03`. Pick the layer token by nesting depth. Build against tokens only and the component works in all four themes for free.

**Primary interactive blue:** Blue 60 = `#0f62fe` (this is the value `$interactive`/`$link-primary` resolves to in White theme — but reference the *token*, not the hex).

---

## 5. Motion

Two **modes**: **productive** (efficient, subtle — task moments) and **expressive** (vibrant — significant moments). Sass: `motion($name, $mode)` → cubic-bezier.

**Easing curves:**

| Curve | Productive | Expressive |
|-------|-----------|------------|
| standard | `cubic-bezier(0.2, 0, 0.38, 0.9)` | `cubic-bezier(0.4, 0.14, 0.3, 1)` |
| entrance | `cubic-bezier(0, 0, 0.38, 0.9)` | `cubic-bezier(0, 0, 0.3, 1)` |
| exit | `cubic-bezier(0.2, 0, 1, 0.9)` | `cubic-bezier(0.4, 0.14, 1, 1)` |

**Duration tokens:**

| Token | ms | Use |
|-------|----|----|
| `$duration-fast-01` | 70 | Micro (button, toggle) |
| `$duration-fast-02` | 110 | Micro (fade) |
| `$duration-moderate-01` | 150 | Small expansions |
| `$duration-moderate-02` | 240 | Toasts, system comms |
| `$duration-slow-01` | 400 | Large expansion, notifications |
| `$duration-slow-02` | 700 | Background dimming |

Always provide a `prefers-reduced-motion` alternative. Example:
```scss
@use '@carbon/styles/scss/motion' as *;
.panel { transition: transform $duration-moderate-01 motion(standard, productive); }
@media (prefers-reduced-motion: reduce) { .panel { transition: none; } }
```

---

## 6. Quick consumption recipes

**Sass:**
```scss
@use '@carbon/styles/scss/spacing';
@use '@carbon/styles/scss/type';
@use '@carbon/styles/scss/theme';
@use '@carbon/styles/scss/breakpoint';

.card {
  padding: spacing.$spacing-05;
  background: theme.$layer;
  color: theme.$text-primary;
  @include type.type-style('heading-03');
  @include breakpoint.breakpoint('lg') { padding: spacing.$spacing-07; }
}
```

**JS (from `@carbon/elements`):**
```js
import { white, g100, blue50, spacing } from '@carbon/elements';
white.background;   // theme token value
g100.textPrimary;
blue50;             // '#0f62fe'
spacing[4];         // '1rem'
```
