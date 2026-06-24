// Tool registrations for the Carbon MCP server.
// All tools are read-only and operate over the bundled reference data (no network).

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  tokens,
  components,
  themesResolved,
  THEME_NAMES,
  searchDocs,
  resolveColor,
  charts,
  findCharts,
  recommendCharts,
  aiChat,
  findAiChatTopics,
  findAiChatResponses,
  labs,
  findLabsPackages,
  recommendLabs,
  type ComponentEntry,
} from "./data.js";
import { hybridDocs, hybridCode } from "./embeddings.js";
import * as S from "./schemas.js";

const readOnly = { readOnlyHint: true, openWorldHint: false } as const;

function jsonText(obj: unknown) {
  return [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }];
}

export function registerTools(server: McpServer): void {
  // 1) carbon_docs_search — full-text search over the merged Carbon doc corpus
  //    (hand-authored reference pack + scraped authored docs for 43 components & foundations).
  server.registerTool(
    "carbon_docs_search",
    {
      title: "Search Carbon docs",
      description:
        "Semantic + keyword (hybrid) search across the bundled IBM Carbon documentation: the reference pack PLUS the authored usage/style/accessibility docs for 43 components and the foundations. Handles natural-language/conceptual queries ('how do I keep nested cards distinct', 'warn before a destructive action', 'make a long form less overwhelming') as well as exact terms. Returns the best-matching doc chunks with source (e.g. 'components/modal/usage') and heading. 'mode' indicates whether the semantic index was used (hybrid) or it fell back to keyword.",
      inputSchema: {
        query: z.string().min(2).describe("Natural-language or keyword query, e.g. 'data table loading state' or 'how to warn before deleting'"),
        scope: z
          .string()
          .optional()
          .describe("Optional source filter (substring): a reference file ('tokens', 'anti-patterns'), a component name ('modal', 'data-table'), a tab ('accessibility', 'usage'), or group ('components', 'foundations')"),
        limit: z.number().int().min(1).max(20).optional().describe("Max results (default 5)"),
      },
      outputSchema: S.DocsSearchOutput.shape,
      annotations: { ...readOnly, title: "Search Carbon docs" },
    },
    async ({ query, scope, limit }) => {
      const { mode, results } = await hybridDocs(query, scope, limit ?? 5);
      const out = { query, mode, count: results.length, results } satisfies z.infer<typeof S.DocsSearchOutput>;
      return { content: jsonText(out), structuredContent: out };
    }
  );

  // 2) carbon_token_lookup — structured design-token lookup, incl. RESOLVED per-theme hex.
  server.registerTool(
    "carbon_token_lookup",
    {
      title: "Look up Carbon design tokens",
      description:
        "Look up IBM Carbon design tokens with their values. Filter by category (spacing, type, color, motion, grid, breakpoint, theme) and/or a name substring. For color tokens you get the RESOLVED hex/rgba for each theme (white/g10/g90/g100) straight from the Carbon source — e.g. ask category=color query=text-primary, or query=layer-01 theme=g100. Use to answer 'what px is $spacing-05', 'what hex is $support-error in g100', 'body-01 line height'. Emit the token, not the hardcoded value.",
      inputSchema: {
        category: z
          .enum(["spacing", "type", "color", "motion", "grid", "breakpoint", "theme", "all"])
          .optional()
          .describe("Token category (default: all)"),
        query: z.string().optional().describe("Name/keyword filter, e.g. 'spacing-05', 'heading', 'text-primary', 'support-error'"),
        theme: z.enum(THEME_NAMES).optional().describe("For color tokens: restrict resolved values to one theme"),
      },
      outputSchema: S.TokenLookupOutput.shape,
      annotations: { ...readOnly, title: "Look up Carbon design tokens" },
    },
    async ({ category, query, theme }) => {
      const cat = category ?? "all";
      const q = (query ?? "").toLowerCase();
      const match = (s: string) => !q || s.toLowerCase().includes(q);
      const out: Record<string, unknown> = { category: cat, query: query ?? null };

      if (cat === "spacing" || cat === "all")
        out.spacing = tokens.spacing.filter((t) => match(t.token) || match(t.use) || match(String(t.px)));
      if (cat === "type" || cat === "all")
        out.type = tokens.type.filter((t) => match(String((t as { token?: string }).token ?? "")));
      if (cat === "color" || cat === "all") {
        out.colorGroups = tokens.colorTokenGroups.filter((g) => match(g.group) || g.tokens.some((t) => match(t)) || match(g.purpose));
        // resolved per-theme hex (authoritative, from Carbon source)
        if (query && themesResolved) {
          out.colorValues = resolveColor(query, theme);
        } else if (cat === "color" && themesResolved && !query) {
          out.colorValues = [{ note: "Pass a 'query' (token name) to get resolved per-theme hex, e.g. query='text-primary'." }];
        }
      }
      if (cat === "motion" || cat === "all") out.motion = tokens.motion;
      if (cat === "grid" || cat === "all") out.grid = tokens.grid;
      if (cat === "breakpoint" || cat === "all")
        out.breakpoints = (tokens.grid as { breakpoints: Array<{ key: string }> }).breakpoints.filter((b) => match(b.key));
      if (cat === "theme" || cat === "all") out.themes = tokens.themes.filter((t) => match(t.name) || match(t.mode));
      out.rules = tokens.rules;
      return { content: jsonText(out), structuredContent: out };
    }
  );

  // 3) carbon_component — API + usage rules + live doc highlights for a component.
  server.registerTool(
    "carbon_component",
    {
      title: "Get Carbon component API",
      description:
        "Get the @carbon/react cheatsheet for a component: import, key props/variants, usage rules, a code example, PLUS highlights from the authored docs (variant/anatomy/accessibility headings). Accepts fuzzy names ('table' -> DataTable, 'dropdown', 'modal', 'shell'). Use before writing a Carbon component to get correct props and avoid gotchas.",
      inputSchema: {
        name: z.string().min(2).describe("Component name or keyword, e.g. 'Button', 'data table', 'dropdown'"),
      },
      outputSchema: S.ComponentOutput.shape,
      annotations: { ...readOnly, title: "Get Carbon component API" },
    },
    async ({ name }) => {
      const q = name.toLowerCase().replace(/[^a-z]/g, "");
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
      let found: ComponentEntry | undefined =
        components.components.find((c) => norm(c.name) === q) ||
        components.components.find((c) => norm(c.name).includes(q) || q.includes(norm(c.name))) ||
        components.components.find((c) => norm(c.summary).includes(q) || c.rules.some((r) => norm(r).includes(q)));

      // pull a few authored-doc highlights for the resolved (or queried) component
      const slug = found ? norm(found.name) : q;
      const highlights = searchDocs(name, "components/", 4)
        .filter((h) => norm(h.source).includes(slug) || slug.includes(norm(h.source.split("/")[1] ?? "")))
        .slice(0, 3)
        .map((h) => ({ source: h.source, heading: h.heading, snippet: h.snippet }));

      const out = found
        ? ({ matched: true, component: found, docHighlights: highlights } satisfies z.infer<typeof S.ComponentOutput>)
        : ({ matched: false, component: null, docHighlights: highlights, suggestions: components.components.map((c) => c.name) } satisfies z.infer<typeof S.ComponentOutput>);
      return { content: jsonText(out), structuredContent: out };
    }
  );

  // 4) carbon_code_search — search the bundled Carbon code corpus.
  server.registerTool(
    "carbon_code_search",
    {
      title: "Search Carbon code examples",
      description:
        "Semantic + keyword (hybrid) search over bundled Carbon CODE: ~520 blocks of canonical Storybook story snippets, @carbon/react import blocks, Sass/reference fences, and curated examples. Filter by lang (jsx, scss, css, bash, js) and/or component. Use to find a working snippet — 'render a DataTable with selection', 'apply a dark theme', 'set up Sass theme zones', 'import an icon'. Returns code blocks with source and heading. 'mode' = hybrid (semantic index used) or keyword (fallback).",
      inputSchema: {
        query: z.string().min(2).describe("What you want to do, e.g. 'data table selection', 'theme zone sass', 'icon import'"),
        lang: z.enum(["jsx", "scss", "css", "bash", "js", "javascript", "html", "text"]).optional().describe("Filter by code language"),
        component: z.string().optional().describe("Filter to a component, e.g. 'modal', 'data-table'"),
        limit: z.number().int().min(1).max(15).optional().describe("Max results (default 6)"),
      },
      outputSchema: S.CodeSearchOutput.shape,
      annotations: { ...readOnly, title: "Search Carbon code examples" },
    },
    async ({ query, lang, component, limit }) => {
      const { mode, results } = await hybridCode(query, lang, component, limit ?? 6);
      const out = { query, mode, count: results.length, results } satisfies z.infer<typeof S.CodeSearchOutput>;
      return { content: jsonText(out), structuredContent: out };
    }
  );

  // 5) carbon_chart — @carbon/charts data-viz: pick a chart by name or by intent.
  server.registerTool(
    "carbon_chart",
    {
      title: "Carbon Charts (data viz)",
      description:
        "Design data visualizations with @carbon/charts(-react). Look up a chart by NAME ('donut', 'stacked bar', 'heatmap', 'gauge') to get its component, import, data shape, options, and a runnable React example — OR pass a data-viz INTENT ('show a trend over time', 'part to whole', 'correlation between two measures', 'a single KPI vs target', 'flow between stages') to get recommended chart types. With neither, returns the chart families + setup (install, CSS, SSR) and the options/data model. Carbon Charts use a flat tabular data array ({group,key,value,date}) with axes.mapsTo; themes are white/g10/g90/g100.",
      inputSchema: {
        name: z.string().optional().describe("Chart name or alias, e.g. 'donut', 'stacked bar', 'line', 'heatmap', 'gauge'. Takes precedence over 'intent' if both are given."),
        intent: z.string().optional().describe("What the data should communicate, e.g. 'trend over time', 'part to whole', 'correlation', 'KPI vs target'"),
        limit: z.number().int().min(1).max(10).optional().describe("Max results for intent recommendation (default 4)"),
      },
      outputSchema: S.ChartOutput.shape,
      annotations: { ...readOnly, title: "Carbon Charts (data viz)" },
    },
    async ({ name, intent, limit }) => {
      const cat = charts; // local const narrows cleanly across the closures below
      if (!cat) {
        const out = { mode: "unavailable", query: name ?? intent ?? null, note: "Chart catalog (charts.json) is not bundled in this data dir.", count: 0, results: [] } satisfies z.infer<typeof S.ChartOutput>;
        return { content: jsonText(out), structuredContent: out };
      }
      const enrich = <T extends { name: string }>(c: T) => ({
        ...c,
        import: `import { ${c.name} } from '@carbon/charts-react';`,
        docs: cat.docsBase,
      });
      const setup = { ...cat.setup, themes: cat.themes, scaleTypes: cat.scaleTypes };

      if (name && name.trim()) {
        const hits = findCharts(name).map(enrich);
        const out = { mode: "lookup", query: name, setup, count: hits.length, results: hits } satisfies z.infer<typeof S.ChartOutput>;
        return { content: jsonText(out), structuredContent: out };
      }
      if (intent && intent.trim()) {
        const recs = recommendCharts(intent, limit ?? 4).map(enrich);
        const out = { mode: "recommend", query: intent, setup, count: recs.length, results: recs } satisfies z.infer<typeof S.ChartOutput>;
        return { content: jsonText(out), structuredContent: out };
      }
      const out = {
        mode: "overview",
        query: null,
        setup,
        dataModel: cat.dataModel,
        families: cat.families,
        optionsReference: cat.optionsReference,
        count: cat.charts.length,
        results: cat.charts.map((c) => ({ name: c.name, family: c.family, intent: c.intent, aka: c.aka })),
      } satisfies z.infer<typeof S.ChartOutput>;
      return { content: jsonText(out), structuredContent: out };
    }
  );

  // 6) carbon_ai_chat — @carbon/ai-chat: how to build a Carbon AI chat UI.
  server.registerTool(
    "carbon_ai_chat",
    {
      title: "Carbon AI Chat (@carbon/ai-chat)",
      description:
        "Build an IBM Carbon AI chat interface with @carbon/ai-chat (the PRODUCTIZED package — React <ChatContainer>/<ChatCustomElement> or web components). NOTE: this is NOT @carbon-labs/ai-chat (the experimental labs Lit web component with built-in chart answers — that one is in the carbon_labs tool). It is a BACKEND-AGNOSTIC UI: you wire your own LLM/server inside messaging.customSendMessage and push replies via instance.messaging.addMessage/addMessageChunk — it is NOT a watsonx SDK. Pass a TOPIC ('setup', 'messaging', 'streaming', 'responses', 'user-defined', 'theming', 'layout', 'nextjs', 'instance', 'events', 'service-desk') for focused guidance + a runnable snippet, OR a RESPONSE TYPE ('text', 'card', 'carousel', 'option', 'user_defined', 'conversational_search'…) to get that GenericItem's shape. With neither, returns setup (install, imports, no-CSS/shadow-DOM note, Next.js SSR caveat), the PublicConfig fields, response-type names, and key events. Themes: white/g10/g90/g100.",
      inputSchema: {
        topic: z
          .string()
          .optional()
          .describe("Topic, e.g. 'setup', 'messaging', 'streaming', 'theming', 'nextjs', 'service-desk'. Takes precedence over responseType."),
        responseType: z
          .string()
          .optional()
          .describe("A bot response_type to look up, e.g. 'text', 'card', 'option', 'user_defined', 'conversational_search'"),
        limit: z.number().int().min(1).max(12).optional().describe("Max results for topic/responseType lookup (default 4)"),
      },
      outputSchema: S.AiChatOutput.shape,
      annotations: { ...readOnly, title: "Carbon AI Chat (@carbon/ai-chat)" },
    },
    async ({ topic, responseType, limit }) => {
      const cat = aiChat; // local const narrows across the closures below
      if (!cat) {
        const out = { mode: "unavailable", query: topic ?? responseType ?? null, note: "AI-chat catalog (ai-chat.json) is not bundled in this data dir.", count: 0, results: [] } satisfies z.infer<typeof S.AiChatOutput>;
        return { content: jsonText(out), structuredContent: out };
      }
      const n = limit ?? 4;
      if (topic && topic.trim()) {
        const hits = findAiChatTopics(topic).slice(0, n);
        const out = { mode: "topic", query: topic, count: hits.length, results: hits } satisfies z.infer<typeof S.AiChatOutput>;
        return { content: jsonText(out), structuredContent: out };
      }
      if (responseType && responseType.trim()) {
        const hits = findAiChatResponses(responseType).slice(0, n);
        const out = { mode: "response", query: responseType, count: hits.length, results: hits } satisfies z.infer<typeof S.AiChatOutput>;
        return { content: jsonText(out), structuredContent: out };
      }
      const out = {
        mode: "overview",
        query: null,
        package: cat.package,
        version: cat.version,
        summary: cat.summary,
        docsBase: cat.docsBase,
        setup: cat.setup,
        peerDeps: cat.peerDeps,
        themes: cat.themes,
        config: cat.configFields,
        responseTypeNames: cat.responseTypeNames,
        events: cat.events,
        instanceApi: cat.instanceApi,
        antiPatterns: cat.antiPatterns,
        count: cat.topics.length,
        results: cat.topics.map((t) => ({ topic: t.topic, summary: t.summary })),
      } satisfies z.infer<typeof S.AiChatOutput>;
      return { content: jsonText(out), structuredContent: out };
    }
  );

  // 7) carbon_labs — @carbon-labs/* experimental incubation packages.
  server.registerTool(
    "carbon_labs",
    {
      title: "Carbon Labs (@carbon-labs experimental packages)",
      description:
        "Discover IBM Carbon Labs — the EXPERIMENTAL incubation tier (@carbon-labs/* packages) that sits above stable @carbon/react & @carbon/ibm-products and prototypes components core Carbon doesn't ship yet (e.g. force-directed network graph, extended UI shell, animated header, empty-state, AI-label tag, first-time onboarding, resizable panels). Pass a NAME ('network graph', 'ui shell', 'animated header', 'ai-chat', 'empty state') to look up a package (purpose, framework react/web-component, status, install, deps, gap it fills), OR a GAP/INTENT ('I need a graph of relationships', 'collapsing header', 'onboarding tour', 'resizable split layout') optionally with framework='react'|'web-component' to get recommendations. With neither, returns the overview: how labs relates to core Carbon, the stability warning (every package is 0.x and churns on every merge — PIN versions), the @carbon/ai-chat-vs-@carbon-labs/ai-chat disambiguation, and the full package list. Curated catalog (purpose/status/install/gap), NOT a scraped prop reference — confirm exact APIs at labs.carbondesignsystem.com. Reach for labs ONLY when core Carbon and ibm-products lack what you need.",
      inputSchema: {
        name: z.string().optional().describe("Package name or alias, e.g. 'network graph', 'ui shell', 'animated header', 'empty state', 'ai-chat'. Takes precedence over 'gap' if both are given."),
        gap: z.string().optional().describe("A need core Carbon lacks, e.g. 'relationship graph', 'collapsing header on scroll', 'onboarding tour', 'resizable panels', 'mark AI content'"),
        framework: z.enum(["react", "web-component"]).optional().describe("Filter recommendations to a framework"),
        limit: z.number().int().min(1).max(12).optional().describe("Max results for name/gap lookup (default 5)"),
      },
      outputSchema: S.LabsOutput.shape,
      annotations: { ...readOnly, title: "Carbon Labs (@carbon-labs experimental packages)" },
    },
    async ({ name, gap, framework, limit }) => {
      const cat = labs;
      if (!cat) {
        const out = { mode: "unavailable", query: name ?? gap ?? null, note: "Labs catalog (labs.json) is not bundled in this data dir.", count: 0, results: [] } satisfies z.infer<typeof S.LabsOutput>;
        return { content: jsonText(out), structuredContent: out };
      }
      const n = limit ?? 5;
      if (name && name.trim()) {
        const hits = findLabsPackages(name).slice(0, n);
        const out = { mode: "lookup", query: name, count: hits.length, results: hits } satisfies z.infer<typeof S.LabsOutput>;
        return { content: jsonText(out), structuredContent: out };
      }
      if (gap && gap.trim()) {
        const recs = recommendLabs(gap, framework, n);
        const out = { mode: "recommend", query: gap, count: recs.length, results: recs } satisfies z.infer<typeof S.LabsOutput>;
        return { content: jsonText(out), structuredContent: out };
      }
      const out = {
        mode: "overview",
        query: null,
        summary: cat.summary,
        relationToCore: cat.relationToCore,
        stabilityWarning: cat.stabilityWarning,
        apiCaveat: cat.apiCaveat,
        docsBase: cat.docsBase,
        npmScope: cat.npmScope,
        versionsAsOf: cat.versionsAsOf,
        disambiguation: cat.disambiguation,
        frameworks: cat.frameworks,
        statuses: cat.statuses,
        count: cat.packages.length,
        results: cat.packages.map((p) => ({ name: p.name, framework: p.framework, status: p.status, purpose: p.purpose })),
      } satisfies z.infer<typeof S.LabsOutput>;
      return { content: jsonText(out), structuredContent: out };
    }
  );

  // 8) carbon_list — enumerate catalogs.
  server.registerTool(
    "carbon_list",
    {
      title: "List Carbon catalog",
      description:
        "Enumerate Carbon catalogs: 'components' (full v11 list + which have detailed API entries + which have scraped docs), 'tokens' (categories), 'themes', 'patterns', 'packages', 'charts' (the @carbon/charts data-viz types), 'ai-chat' (the @carbon/ai-chat topics), or 'labs' (the experimental @carbon-labs/* incubation packages). Use to discover what exists before drilling in with carbon_component / carbon_token_lookup / carbon_docs_search / carbon_chart / carbon_ai_chat / carbon_labs.",
      inputSchema: {
        kind: z.enum(["components", "tokens", "themes", "patterns", "packages", "charts", "ai-chat", "labs"]).describe("Which catalog to list"),
      },
      outputSchema: S.ListOutput.shape,
      annotations: { ...readOnly, title: "List Carbon catalog" },
    },
    async ({ kind }) => {
      let items: unknown[] = [];
      switch (kind) {
        case "components":
          items = [
            { fullCatalog: components.catalog },
            { detailedEntries: components.components.map((c) => ({ name: c.name, summary: c.summary })) },
          ];
          break;
        case "tokens":
          items = [
            { spacing: tokens.spacing.map((t) => t.token) },
            { type: tokens.type.map((t) => (t as { token: string }).token) },
            { colorGroups: tokens.colorTokenGroups.map((g) => g.group) },
            { resolvedColorTokens: themesResolved ? themesResolved.tokenNames.length : 0 },
            { motionDuration: (tokens.motion as { duration: Array<{ token: string }> }).duration.map((d) => d.token) },
          ];
          break;
        case "themes":
          items = tokens.themes;
          break;
        case "patterns":
          items = components.patterns;
          break;
        case "packages":
          items = Object.entries(components.packages).map(([name, desc]) => ({ name, desc }));
          break;
        case "charts":
          items = charts
            ? charts.charts.map((c) => ({ name: c.name, family: c.family, intent: c.intent, aka: c.aka }))
            : [];
          break;
        case "ai-chat":
          items = aiChat ? aiChat.topics.map((t) => ({ name: t.topic, desc: t.summary })) : [];
          break;
        case "labs":
          items = labs
            ? labs.packages.map((p) => ({ name: p.name, framework: p.framework, status: p.status, purpose: p.purpose }))
            : [];
          break;
      }
      const out = { kind, items };
      return { content: jsonText(out), structuredContent: out };
    }
  );

  // 9) carbon_guidelines — anti-slop / do-don't guidance.
  server.registerTool(
    "carbon_guidelines",
    {
      title: "Carbon guidelines & anti-patterns",
      description:
        "Return IBM Carbon design guidance and 'fake Carbon' anti-patterns for a topic (color, spacing, type, motion, buttons, tables, content/copy, accessibility, theming, shadows/depth). Use before delivering to self-check for themed-generic drift. Without a topic, returns the core non-negotiables.",
      inputSchema: {
        topic: z.string().optional().describe("Topic, e.g. 'buttons', 'shadows', 'content casing', 'accessibility', 'tokens'"),
      },
      outputSchema: S.GuidelinesOutput.shape,
      annotations: { ...readOnly, title: "Carbon guidelines & anti-patterns" },
    },
    async ({ topic }) => {
      const nonNegotiables = [
        "Tokens, never literals ($spacing-05 not 16px; $text-primary not #161616).",
        "Depth = layer tokens ($layer-01/02/03), not drop shadows. Carbon is flat.",
        "Lay out on the 2x Grid (<Grid>/<Column>, 4/8/16 cols, 8px mini-unit).",
        "IBM Plex + the type scale; never Inter/Roboto/system-ui.",
        "Sentence case, no trailing periods; verb+noun buttons.",
        "Use real Carbon components; icons only from @carbon/icons.",
        "Accessible (WCAG 2.1 AA): labelText/id, visible $focus, 44px targets, prefers-reduced-motion.",
      ];
      const guidance = topic
        ? searchDocs(topic, "anti-patterns", 4)
            .concat(searchDocs(topic, undefined, 3))
            .filter((v, i, a) => a.findIndex((x) => x.heading === v.heading && x.source === v.source) === i)
            .slice(0, 5)
            .map((h) => ({ source: h.source, heading: h.heading, snippet: h.snippet }))
        : [];
      const out = { topic: topic ?? null, nonNegotiables, guidance } satisfies z.infer<typeof S.GuidelinesOutput>;
      return { content: jsonText(out), structuredContent: out };
    }
  );
}
