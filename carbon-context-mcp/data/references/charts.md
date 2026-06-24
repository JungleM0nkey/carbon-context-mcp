# Carbon Charts (data visualization)

IBM Carbon's charting system is **`@carbon/charts`** (D3-based core) with framework wrappers —
**`@carbon/charts-react` is primary** for us. It is the data-viz half of Carbon: same four themes
(white/g10/g90/g100), the Carbon categorical color palettes, IBM Plex, and built-in accessibility.
Use the `carbon_chart` MCP tool for the live catalog, data shapes, and runnable React snippets.

## Setup

```bash
npm i @carbon/charts-react @carbon/charts d3
```
```jsx
import '@carbon/charts-react/styles.css';   // required
import { DonutChart } from '@carbon/charts-react';
```
- **SSR (Next.js App Router):** charts need `window` — put them in a `'use client'` file, or
  `dynamic(() => import(...), { ssr: false })`. They are client components.
- Every chart is `<XChart data={data} options={options} />`. Set an explicit `height`; width fills
  the container. Charts re-render on prop change.

## The data model (this is the part people get wrong)

Carbon Charts take a **flat, tabular data array** — one row per datum, NOT nested series objects.
Key fields: **`group`** (series → color + legend), **`key`** (the x category), **`value`** (the
measure), **`date`** (time series). The chart learns the layout from `options.axes.<side>.mapsTo`
(which field that axis reads) and **`scaleType`**: `'labels' | 'linear' | 'time' | 'log'`.

```jsx
const data = [
  { group: 'Dataset 1', key: 'Qty', value: 65000 },
  { group: 'Dataset 2', key: 'Qty', value: 32000 },
];
const options = {
  theme: 'white', height: '400px', title: 'Grouped bar',
  axes: { left: { mapsTo: 'value' }, bottom: { mapsTo: 'key', scaleType: 'labels' } },
};
```
Hierarchy/flow/geo charts use specialized shapes: treemap/circle-pack/tree use `children[]`,
alluvial uses `{ source, target, value }`, choropleth needs a topojson `options.geoData`.

## Pick the right chart (intent → type)

| The data should show… | Use |
|---|---|
| Compare discrete categories | **SimpleBarChart**; multiple series → **GroupedBarChart**; ranked, lighter → **LollipopChart** |
| Composition / part-to-whole | **StackedBarChart**, **DonutChart** (center total), **PieChart** (≤5 slices), **TreemapChart** |
| Trend over time | **LineChart**; magnitude → **AreaChart**; composition over time → **StackedAreaChart** |
| Correlation between measures | **ScatterChart**; third dimension as size → **BubbleChart** |
| Distribution / spread | **HistogramChart** (one var), **BoxplotChart** (per category), **HeatmapChart** (two dims) |
| A single KPI / status | **GaugeChart** (% of target + delta), **MeterChart** (vs peak), **BulletChart** |
| Hierarchy or flow | **TreeChart**, **CirclePackChart**, **AlluvialChart** (sankey), **TreemapChart** |
| Values by region | **ChoroplethChart** | 
| Multiple encodings on shared axes | **ComboChart** (e.g. bars + line) |
| Multivariate profile across metrics | **RadarChart** |

25 chart components in total — ask `carbon_chart` with no args for the full family overview.

## Theming, color & accessibility

- **Theme** matches the app: `options.theme: 'white' | 'g10' | 'g90' | 'g100'`. Don't hand-pick
  colors — Carbon's default categorical palette is accessible. Only override `options.color.scale`
  ({ '<group>': '#hex' }) for semantic meaning (e.g. status), using Carbon palette values.
- Charts are **accessible by default**: keyboard navigation, a screen-reader data view, and
  redundant/pattern encodings for color-vision deficiency. Always set a meaningful `title` and axis
  `title`s — they are the chart's accessible name.
- `options.data.loading = true` shows the Carbon skeleton/loading state.

## "Fake Carbon charts" — avoid

- ❌ Reaching for Recharts/Chart.js/visx in a Carbon app → inconsistent theme, type, and a11y. Use
  `@carbon/charts-react`.
- ❌ Hand-picking hex colors per series instead of the themed palette.
- ❌ Nesting data as `{ series: [...] }` — Carbon wants a flat array + `axes.mapsTo`.
- ❌ Forgetting `import '@carbon/charts-react/styles.css'` (renders unstyled).
- ❌ Hardcoding a light chart inside a g90/g100 app — pass the matching `theme`.
- ❌ Pie/donut with many slices, or 3D/donut-as-gauge hacks — pick the chart that fits the intent.
