# Carbon Components Reference (`@carbon/react`, v11)

> Always reach for a Carbon component before reinventing one. Import from `@carbon/react`;
> icons from `@carbon/react/icons` (or `@carbon/icons-react`). Components are PascalCase. In
> Next.js App Router, interactive Carbon components need `"use client"` (they use hooks/context).

---

## Full component catalog (v11, ~63)

Accordion · AI Label · AI Skeleton · Breadcrumb · Button · Button (icon) · Checkbox · Code Snippet · Combo Box · Content Switcher · Context Menu · Data Table · Date Picker · Dropdown · File Uploader · Fluid inputs · Form · Inline Loading · Link · List · Loading (spinner) · Menu · Menu Button / Combo Button · Modal · Multiselect · Notification (inline / toast / actionable / callout) · Number Input · Overflow Menu · Pagination · Popover · Progress Bar · Progress Indicator (stepper) · Radio Button · Search · Select · Side Panel · Skeleton · Slider · Stack · Structured List · Tabs · Tag · Text Area · Text Input · Tile · Time Picker · Toggle · Toggletip · Toolbar · Tooltip · Tree View · UI Shell (Header / SideNav / Switcher) · Pictograms.

**Higher-level patterns** (page header, side panel, tearsheet, advanced data-table toolbars) live in **`@carbon/ibm-products`** — a separate, version-aligned package, not `@carbon/react`. **Charts** live in `@carbon/charts-react` (D3-based). Reach for these instead of hand-rolling enterprise layouts.

---

## Layout primitives

`Stack` (vertical/horizontal rhythm), `Grid`/`Column`, `Layer` (bumps children to the next layer token), `Theme` (inline theme zone), `FlexGrid`. Prefer `Stack gap={5}` over manual margins.

```jsx
import { Stack } from '@carbon/react';
<Stack gap={6}>{/* gap maps to $spacing-06 */}</Stack>
```

---

## Detailed API + rules for the components you'll use most

### Button
```jsx
import { Button } from '@carbon/react';
import { Add } from '@carbon/react/icons';
<Button kind="primary" size="lg" renderIcon={Add} onClick={fn}>Create</Button>
```
- `kind`: `primary | secondary | tertiary | ghost | danger | danger--tertiary | danger--ghost`
- `size`: `xs | sm | md | lg | xl | 2xl` (`lg` is the common productive size; `2xl` = full-width for modals/side panels)
- Icon-only: `hasIconOnly iconDescription="Add" renderIcon={Add}` (tooltip required for a11y)
- **Pass icon as a component** (`renderIcon={Add}`), not `renderIcon={<Add/>}`.
- Rules: **one primary per screen**; secondary only paired with a primary (never alone); labels **left-aligned**, verb+noun ("Save changes"), sentence case, no truncation; max 2–3 buttons in a group (4+ → menu/overflow); don't mix sizes.

### Text input & form fields
```jsx
import { TextInput } from '@carbon/react';
<TextInput id="email" labelText="Email address" placeholder="name@example.com"
  value={email} onChange={(e) => setEmail(e.target.value)}
  invalid={hasError} invalidText="Enter a valid email" />
```
- `labelText` and `id` are **required** (a11y). `helperText` is persistent; `invalidText`/`warnText` replace it on validation.
- Controlled: passing `value` requires `onChange` or the field is read-only.
- Labels: sentence case, brief, no colons. Mark `(optional)` on simple forms or `(required)` on enterprise forms — be consistent within a form.
- Default field heights 32/40/48px; **fluid** variant is 64px and stacks flush (0px). Don't mix default and fluid in one form.

### Dropdown / Multiselect / Combo Box
```jsx
import { Dropdown } from '@carbon/react';
const items = [{ id: 'opt-1', text: 'Option 1' }, { id: 'opt-2', text: 'Option 2' }];
<Dropdown id="dd" titleText="Choose an option" label="Select…" items={items}
  itemToString={(i) => (i ? i.text : '')} selectedItem={selected}
  onChange={({ selectedItem }) => setSelected(selectedItem)} />
```
- `onChange` returns `{ selectedItem }`, **not a DOM event** — common mistake.
- Types: `Dropdown` (single), `MultiSelect` (+ filter, select-all), `ComboBox` (select or type custom).
- Styles: default (label above), `type="inline"` (label left); `<FluidDropdown>` for fluid.
- Rules: use **radio buttons for ≤2–3 options**, not a dropdown. Always include a label (never placeholder-as-label). Alphabetize options. Don't nest dropdowns.

### Modal
```jsx
import { Modal } from '@carbon/react';
<Modal open={open} modalHeading="Confirm action" primaryButtonText="Confirm"
  secondaryButtonText="Cancel" danger={false} size="sm"
  onRequestClose={() => setOpen(false)} onRequestSubmit={handleSubmit}>
  <p>Are you sure you want to continue?</p>
</Modal>
```
- Use `ComposedModal` + `ModalHeader`/`ModalBody`/`ModalFooter` for custom layouts.
- Types: passive (`passiveModal`, info only), transactional (cancel + primary), `danger` (destructive), acknowledgment (single button), progress (multi-step).
- `size`: `xs | sm | md | lg`. Button placement is automatic: secondary left, primary right.
- Use modals only for critical/blocking moments. Non-critical → toast or inline notification.

### Data Table
```jsx
import { DataTable, Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@carbon/react';
const headers = [{ key: 'name', header: 'Name' }, { key: 'role', header: 'Role' }];
const rows = [{ id: '1', name: 'Alice', role: 'Engineer' }, { id: '2', name: 'Bob', role: 'Designer' }];
<DataTable rows={rows} headers={headers}>
  {({ rows, headers, getHeaderProps, getRowProps, getTableProps }) => (
    <Table {...getTableProps()}>
      <TableHead><TableRow>
        {headers.map((h) => <TableHeader {...getHeaderProps({ header: h })}>{h.header}</TableHeader>)}
      </TableRow></TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow {...getRowProps({ row })}>
            {row.cells.map((cell) => <TableCell key={cell.id}>{cell.value}</TableCell>)}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )}
</DataTable>
```
- **Render-prop pattern.** The `rows` inside the render prop are *transformed* (each has a `.cells` array) — not your raw rows. Every raw row needs a unique `id`.
- Spread `getTableProps`/`getHeaderProps`/`getRowProps` or sorting/selection/a11y break.
- 5 row heights: XS/S/M/L/XL — **header row height must match body row height.**
- Features: sorting, selection (checkbox=multi, radio=single), batch actions (`TableBatchActions`, appears on selection), expandable rows, `TableToolbar` (≤5 actions + overflow), pagination.
- **Use skeleton loading, not spinners**, for tables.

### Notifications
```jsx
import { InlineNotification, ToastNotification, ActionableNotification } from '@carbon/react';
<InlineNotification kind="error" title="Upload failed" subtitle="Check the file size and try again." />
```
- `kind`: `info | success | warning | error`.
- Inline (in task flow, persists until resolved); Toast (top-right, auto-dismiss ~5s); Actionable (adds a button); **Callout** (contextual, loads with page, never dismissible — guidance not feedback).
- Title has **no trailing period**; body ≤2 lines; include next steps in errors. Never rely on color alone (status icon carries meaning too).

### Tabs
```jsx
import { Tabs, TabList, Tab, TabPanels, TabPanel } from '@carbon/react';
<Tabs>
  <TabList aria-label="Settings"><Tab>Account</Tab><Tab>Billing</Tab></TabList>
  <TabPanels><TabPanel>…</TabPanel><TabPanel>…</TabPanel></TabPanels>
</Tabs>
```
- Variants: line (standalone), contained (`contained`, attached to a panel on the same layer), vertical.
- One tab selected at a time; prefer ≤4 (max 8 at large breakpoints, else scroll). Align tab *labels* to the grid, not the tab container.

### Tile / Accordion
- `Tile` variants: base (read-only), `ClickableTile` (whole tile navigates), `SelectableTile` / `TileGroup` (single/multi-select), `ExpandableTile`. Match variants within a group; **no drop shadows** (Carbon tiles are flat — border via feature flag, not shadow).
- `Accordion`/`AccordionItem`: chevron end-aligned by default (titles align to page type). Use to shorten pages; don't use for content users must read fully (use scrolling) or deep nesting (use `TreeView`).

### Icons & loading
```jsx
import { Add, TrashCan, ChevronRight } from '@carbon/react/icons';
import { Loading, InlineLoading, SkeletonText, SkeletonPlaceholder } from '@carbon/react';
```
- Icons are components; common sizes 16/20/24/32. Interactive icon touch target **≥44px** (pad with CSS). Never use emoji as icons.
- Prefer **skeletons** over spinners for content placeholders.

### UI Shell (app frame)
`Header`, `HeaderName`, `HeaderNavigation`, `HeaderMenuItem`, `HeaderGlobalBar`, `HeaderGlobalAction`, `SideNav`, `SideNavItems`, `SideNavLink`, `SkipToContent`, `Content`. Use this for the global app chrome rather than a custom navbar.

---

## Web Components (non-React fallback)

`@carbon/web-components` (Lit, v2.x, **separate package & major**). Custom elements use `cds-` prefix: `<cds-button>`, `<cds-modal>`, `<cds-data-table>`. Not interchangeable with `@carbon/react` imports. Use for Vue/Angular/no-framework when you want official support.
