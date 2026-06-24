# Carbon Sources & Authoritative Doc Map

> The reference pack in this directory is self-contained — you don't need the network to build
> correct Carbon UIs. Use the URLs below only when you need to go deeper than the pack (a rare
> component, an exact prop signature, the latest release notes). Carbon publishes a machine-readable
> `llms.txt` manifest specifically for agents.

---

## Primary entry points

- **Manifest for LLMs:** https://carbondesignsystem.com/llms.txt (flat link map; no `llms-full.txt` exists — returns 404)
- Site home: https://carbondesignsystem.com/
- Developer get-started: https://carbondesignsystem.com/developing/get-started/
- Designer get-started: https://carbondesignsystem.com/designing/get-started/

## Foundations (tokens & system rules)

- Color: https://carbondesignsystem.com/foundations/color/overview/
- 2x Grid: https://carbondesignsystem.com/foundations/2x-grid/overview/ · Grid: https://carbondesignsystem.com/foundations/grid/overview/
- Spacing: https://carbondesignsystem.com/foundations/spacing/overview/
- Typography: https://carbondesignsystem.com/foundations/typography/overview/
- Themes: https://carbondesignsystem.com/foundations/themes/overview/
- Motion: https://carbondesignsystem.com/foundations/motion/overview/
- Icons: https://carbondesignsystem.com/foundations/icons/library/

## Components & patterns

- Component index: https://carbondesignsystem.com/components/overview/components/
- Per-component usage: `https://carbondesignsystem.com/components/<name>/usage/`
- Pattern index (forms, login, empty states, notifications, status indicators, …): `https://carbondesignsystem.com/patterns/<name>/`
- **Live React Storybook (canonical prop/API reference):** https://react.carbondesignsystem.com/
- IBM Products Storybook: https://ibm-products.carbondesignsystem.com/

## Frameworks

- React: https://carbondesignsystem.com/developing/frameworks/react/
- Web Components: https://carbondesignsystem.com/developing/frameworks/web-components/
- Angular: https://angular.carbondesignsystem.com/documentation/
- Vue (community): https://carbondesignsystem.com/developing/frameworks/vue/

## Source & data (machine-readable tokens)

- Monorepo: https://github.com/carbon-design-system/carbon (Apache-2.0, Lerna + Yarn workspaces)
- Themes (authoritative semantic token names): https://github.com/carbon-design-system/carbon/tree/main/packages/themes (`white.ts`, `g10.ts`, `g90.ts`, `g100.ts`, `component-tokens/`)
- Colors (primitive hex palette): https://github.com/carbon-design-system/carbon/tree/main/packages/colors
- Layout/spacing & grid: …/packages/layout · Type: …/packages/type · Motion: …/packages/motion
- Releases / changelog: https://github.com/carbon-design-system/carbon/releases
- Data viz: https://charts.carbondesignsystem.com/

---

## The official Carbon MCP

Carbon ships an official hosted MCP server at `https://mcp.carbondesignsystem.com/mcp`, reachable via a
Claude Desktop extension that bridges stdio to the hosted HTTPS endpoint (authenticated with a Bearer
token). Its server-side tools include `docs_search` and `code_search` for semantic search over Carbon
docs and code.

This local server is an offline alternative that needs no network or hosted endpoint. It serves docs,
tokens, component APIs, charts, and AI-chat specs from a bundled reference pack plus a scraped/indexed
copy of the docs and token JSON from the Carbon monorepo.

If a hosted Carbon MCP is available in your session (tools named `mcp__*carbon*` such as `docs_search`
/ `code_search`), prefer it for version-current lookups and fall back to this pack.
