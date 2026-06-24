# Carbon Context MCP

> **Unofficial. Not affiliated with or endorsed by IBM**, and distinct from IBM's official
> [Carbon MCP](https://carbondesignsystem.com/developing/carbon-mcp/overview/). See [Disclaimer](#disclaimer).

A local MCP server for the IBM Carbon Design System. It serves Carbon docs, design tokens, component
APIs, `@carbon/charts` specs, and `@carbon/ai-chat` guidance from a bundled corpus. No network or
token required.

It pairs with the `carbon-design-engineer` agent and `carbon-design-system` skill: those carry the
design judgment, while this server supplies the facts (exact token values, component APIs, guidelines).

## Tools

Nine read-only tools, each returning human-readable text plus `structuredContent`. `carbon_docs_search`
and `carbon_code_search` use a bundled offline embedding model for semantic search and fall back to
keyword matching if the index is unavailable.

| Tool | What it does |
|------|--------------|
| `carbon_docs_search` | Hybrid (semantic + keyword) search across the doc corpus: the reference pack plus authored usage/style/accessibility docs for 43 components and foundations. Args: `query`, optional `scope`, `limit`. |
| `carbon_token_lookup` | Token lookup by `category` and/or name `query`. For color tokens, returns the resolved hex/rgba per theme (white/g10/g90/g100); optional `theme` filter. |
| `carbon_component` | `@carbon/react` API for a component (fuzzy `name`): import, props/variants, rules, example, plus highlights from the authored docs. |
| `carbon_code_search` | Hybrid search over the code corpus: Storybook snippets, import blocks, reference fences, `@carbon/charts` examples, and curated examples. Args: `query`, optional `lang`, `component`, `limit`. |
| `carbon_chart` | `@carbon/charts` data-viz. Look up a chart by `name` for component, data shape, options, and a runnable example, or pass an `intent` for recommended types. Covers 25 chart types. |
| `carbon_ai_chat` | `@carbon/ai-chat`. Build a Carbon AI chat UI. Pass a `topic` or `responseType` for focused guidance and a snippet. Backend-agnostic (you wire `customSendMessage`); not a watsonx SDK. |
| `carbon_labs` | `@carbon-labs/*` experimental packages. Look up by `name` or by a `gap`/intent (optional `framework`). Curated catalog, not a scraped prop reference; verify exact APIs at the linked Storybook. |
| `carbon_list` | Enumerate `components` / `tokens` / `themes` / `patterns` / `packages` / `charts` / `ai-chat` / `labs`. |
| `carbon_guidelines` | Carbon guidance plus "fake Carbon" anti-patterns for a `topic`; core non-negotiables by default. |

## Setup

Requires Node >= 20.

```bash
npm install
npm run build      # tsc -> dist/
npm run smoke      # optional: initialize + list + call all 9 tools
```

Register in Claude Code:

- **Project-scoped:** a `.mcp.json` is already provided; Claude Code picks it up when run from this directory.
- **User-scoped** (available everywhere):

  ```bash
  claude mcp add carbon -- node /ABSOLUTE/PATH/TO/ibm-carbon/carbon-context-mcp/dist/index.js
  ```

Once registered, the `carbon-design-engineer` agent and `carbon-design-system` skill prefer the
`mcp__carbon__*` tools and fall back to the bundled reference pack when the server isn't present.

### Claude Desktop extension

Pack as a local extension (no proxy or token), then install via Settings → Extensions → Install Extension:

```bash
npm ci --omit=dev
npm run build
npx @anthropic-ai/mcpb pack   # -> carbon-context-mcp.mcpb
```

## Data

The bundled corpus (tokens, docs, component APIs, chart/AI-chat catalogs, and an offline semantic
index) lives in `data/`. Rebuild it with `npm run build:index`. Set `CARBON_DOCS_DIR` to point at a
different data directory.

## Disclaimer

This is an unofficial, community project. It is not affiliated with, endorsed by, or supported by IBM,
and is distinct from IBM's official [Carbon MCP](https://carbondesignsystem.com/developing/carbon-mcp/overview/).
"IBM", "Carbon", "Carbon Design System", and "IBM Plex" are trademarks of International Business
Machines Corporation, used here only to describe compatibility, not to imply endorsement.

## License

Apache-2.0 for this project's original code. Bundled third-party material (IBM Carbon sources and docs,
and the `all-MiniLM-L6-v2` model) is also Apache-2.0; see [`../NOTICE`](../NOTICE) and
[`../THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) for attribution.
