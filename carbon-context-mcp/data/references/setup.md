# Carbon Setup & Configuration (React-primary, v11)

> The #1 reason Carbon "doesn't work" is missing/misconfigured Sass — JS imports alone render
> **unstyled** components. You must `@use '@carbon/react';` in a Sass file *and* put `node_modules`
> on the bundler's Sass load path.

---

## 1. Install

```bash
npm install -S @carbon/react
npm install -D sass            # Dart Sass — required peer dep (node-sass is NOT supported)
```

Peer deps: `sass ^1.33.0`; React `^16.8.6 || ^17 || ^18.2 || ^19` (+ matching `react-dom`, `react-is`). Node 18+/20+. No IE11.

Optional companions:
```bash
npm install -S @carbon/ibm-products   # enterprise patterns (Tearsheet, PageHeader, SidePanel)
npm install -S @carbon/charts-react @carbon/charts d3   # charts
```

---

## 2. Global styles

Create one Sass entry (e.g. `styles/globals.scss`):
```scss
// Pulls in reset, IBM Plex type, all component styles, grid, tokens.
@use '@carbon/react';
```
`@carbon/react` re-exports `@carbon/styles`, so `@use '@carbon/react';` ≈ `@use '@carbon/styles';` for styling. Import only what you use to trim CSS:
```scss
@use '@carbon/react/scss/components/button';
@use '@carbon/react/scss/components/text-input';
```

Configure prefix/fonts/grid with `with (...)`:
```scss
@use '@carbon/react' with (
  $font-path: '@ibm/plex',   // fixes Plex font resolution (esp. Vite)
  $prefix: 'cds',            // default; CSS classes become .cds--btn
  $use-flexbox-grid: false   // false = CSS Grid (the v11 default)
);
```

---

## 3. Bundler config

### Next.js (`next.config.js`)
```js
const path = require('path');
module.exports = {
  sassOptions: { includePaths: [path.join(__dirname, 'node_modules')] },
};
```
Then import the global Sass **once** in the root layout:
```tsx
// app/layout.tsx (App Router)
import './styles/globals.scss';
export default function RootLayout({ children }) {
  return (<html lang="en"><body>{children}</body></html>);
}
```
App Router: mark files using interactive Carbon components with `"use client"` (they use hooks/context).

### Vite (`vite.config.js`)
```js
export default {
  css: { preprocessorOptions: { scss: { loadPaths: ['node_modules'] } } },
};
```
Import `globals.scss` in `main.tsx`.

---

## 4. Theming

```jsx
import { GlobalTheme, Theme, useTheme } from '@carbon/react';

function App() {
  return (
    <GlobalTheme theme="g100">             {/* white | g10 | g90 | g100 */}
      <Header />
      <Theme theme="white" as="section">   {/* inline override for one region */}
        <MainContent />
      </Theme>
    </GlobalTheme>
  );
}

function Widget() {
  const { theme } = useTheme();            // -> "g100"
  return <span>{theme}</span>;
}
```
- `GlobalTheme` = app-wide; `Theme` = inline zone; `useTheme` reads the current theme.
- Inline `Theme` zones need `@use '@carbon/react/scss/zone';` in Sass so their token CSS is emitted.
- Default global theme is `white`. Setting `theme="g100"` **does nothing without the Sass styles loaded.**
- Use `Layer` to step a region to the next layer token (`$layer-01 → $layer-02 …`) without manual color.

---

## 5. Grid in markup

React components (preferred):
```jsx
import { Grid, Column } from '@carbon/react';
<Grid>
  <Column sm={4} md={8} lg={16}>Full-width header</Column>
  <Column sm={4} md={4} lg={8}>Half</Column>
  <Column sm={4} md={4} lg={8}>Half</Column>
</Grid>
```
Raw CSS-grid classes (v11 default): `cds--css-grid` > `cds--css-grid-column cds--col-span-4`. Flexbox grid is opt-in (`$use-flexbox-grid: true`) and uses different classes (`cds--row` / `cds--col`).

---

## 6. Design tokens in code

See `tokens.md` for the full tables. Sass usage:
```scss
@use '@carbon/styles/scss/spacing';
@use '@carbon/styles/scss/theme';
@use '@carbon/styles/scss/type';
@use '@carbon/styles/scss/motion' as *;

.panel {
  padding: spacing.$spacing-05;
  background: theme.$layer;            // var(--cds-layer-01) — reacts to theme
  color: theme.$text-primary;
  @include type.type-style('body-01');
  transition: opacity $duration-fast-02 motion(standard, productive);
}
```
JS: `import { white, g100, spacing, blue50 } from '@carbon/elements';`

---

## 7. Versions, TypeScript, migration

- v11 line: `@carbon/react` 1.x (its own semver), token packages `@carbon/elements`/`colors`/`type` are `11.x`, `@carbon/web-components` is `2.x`.
- TypeScript types ship but are incomplete → set `"skipLibCheck": true` in `tsconfig.json`.
- **v10 → v11**: renames (`carbon-components` → `@carbon/styles`, `carbon-components-react` → `@carbon/react`); default class prefix `bx` → **`cds`** (`.bx--btn` is v10, `.cds--btn` is v11); Sass moved to Dart Sass `@use`/`@forward`; prop normalization (`small` → `size="sm"`). Run codemods: `npx @carbon/upgrade`.

---

## 8. Minimal working example (Next.js App Router)

```scss
/* app/globals.scss */
@use '@carbon/react' with ($font-path: '@ibm/plex');
```
```tsx
/* app/layout.tsx */
import './globals.scss';
import { GlobalTheme } from '@carbon/react';
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body><GlobalTheme theme="white">{children}</GlobalTheme></body></html>);
}
```
```tsx
/* app/page.tsx */
'use client';
import { Grid, Column, Button, Tile } from '@carbon/react';
import { Add } from '@carbon/react/icons';
export default function Page() {
  return (
    <Grid>
      <Column sm={4} md={8} lg={16}>
        <Tile>
          <h1 className="cds--type-heading-05">Dashboard</h1>
          <Button kind="primary" size="lg" renderIcon={Add}>Create</Button>
        </Tile>
      </Column>
    </Grid>
  );
}
```
