// Reusable Zod schemas for MCP tool outputSchema + inferred types.
// Pass `XOutput.shape` to registerTool's outputSchema. Open/config blobs use
// z.record/passthrough so the client's (closed-by-default) JSON-Schema validator
// accepts forwarded keys. See src/tools.ts handlers for the matching returns.
import { z } from "zod";

// open JSON object of arbitrary keys (forwarded config blobs)
export const OpenObject = z.record(z.string(), z.unknown());

// doc/code search elements
export const DocHighlight = z.object({ source: z.string(), heading: z.string(), snippet: z.string() });
export const SearchHit = DocHighlight.extend({ score: z.number() });
export const CodeBlock = z.object({
  source: z.string(), component: z.string(), lang: z.string(), heading: z.string(), code: z.string(),
});

// token elements
export const SpacingToken = z.object({ token: z.string(), rem: z.number(), px: z.number(), use: z.string() });
export const ColorTokenGroup = z.object({ group: z.string(), tokens: z.array(z.string()), purpose: z.string() });
export const ThemeEntry = z.object({ name: z.string(), mode: z.string(), background: z.string() });
export const ColorValue = z.object({ token: z.string(), theme: z.string(), value: z.string().nullable(), ref: z.string() });
export const ColorValueNote = z.object({ note: z.string() });
export const TypeToken = OpenObject;                       // type tokens have variable internal shape
export const Breakpoint = z.object({ key: z.string() }).passthrough(); // key + arbitrary grid fields

// component
export const ComponentEntry = z.object({
  name: z.string(), import: z.string(), summary: z.string(),
  props: z.record(z.string(), z.string()), rules: z.array(z.string()), example: z.string(),
});

// charts
export const ChartFamily = z.object({ family: z.string(), intent: z.string(), charts: z.array(z.string()) });
export const ChartOverviewEntry = z.object({ name: z.string(), family: z.string(), intent: z.string(), aka: z.array(z.string()) });
export const ChartLookupEntry = z.object({
  name: z.string(), aka: z.array(z.string()), family: z.string(), intent: z.string(),
  tags: z.array(z.string()), dataShape: z.string(), when: z.string(), avoidWhen: z.string(),
  example: z.string(), docNote: z.string().optional(),
  import: z.string(), docs: z.string(), score: z.number().optional(),
});
export const ChartSetup = z.object({ themes: z.array(z.string()), scaleTypes: z.array(z.string()) }).passthrough();

// @carbon/ai-chat
export const AiChatConfigField = z.object({ field: z.string(), type: z.string(), purpose: z.string() });
export const AiChatTopicEntry = z.object({
  topic: z.string(), aka: z.array(z.string()), summary: z.string(),
  detail: z.string().optional(), example: z.string().optional(),
  docNote: z.string().optional(), score: z.number().optional(),
});
export const AiChatResponseEntry = z.object({
  type: z.string(), item: z.string(), fields: z.string(), use: z.string(),
  example: z.string().optional(), score: z.number().optional(),
});
export const AiChatOverviewEntry = z.object({ topic: z.string(), summary: z.string() });

// @carbon-labs
export const LabsPackageEntry = z.object({
  name: z.string(), dir: z.string(), framework: z.string(), status: z.string(), version: z.string(),
  purpose: z.string(), install: z.string(), components: z.string(), dependsOn: z.array(z.string()),
  gap: z.string().nullable(), aka: z.array(z.string()), tags: z.array(z.string()),
  storybook: z.string().nullable(), deprecatedBy: z.string().nullable(), note: z.string().nullable(),
  score: z.number().optional(),
});
export const LabsOverviewEntry = z.object({ name: z.string(), framework: z.string(), status: z.string(), purpose: z.string() });

// carbon_list item union (element shape depends on `kind`; components/tokens mix positional shapes)
export const ListItem = z.union([
  z.string(),
  z.object({ fullCatalog: z.array(z.string()) }),
  z.object({ detailedEntries: z.array(z.object({ name: z.string(), summary: z.string() })) }),
  z.object({ spacing: z.array(z.string()) }),
  z.object({ type: z.array(z.string()) }),
  z.object({ colorGroups: z.array(z.string()) }),
  z.object({ resolvedColorTokens: z.number() }),
  z.object({ motionDuration: z.array(z.string()) }),
  ThemeEntry,
  z.object({ name: z.string(), desc: z.string() }),
  ChartOverviewEntry,
  LabsOverviewEntry,
]);

// ---- per-tool output schemas (pass `.shape` to registerTool) ----
export const DocsSearchOutput = z.object({ query: z.string(), mode: z.string(), count: z.number(), results: z.array(SearchHit) });
export const CodeSearchOutput = z.object({ query: z.string(), mode: z.string(), count: z.number(), results: z.array(CodeBlock) });
export const TokenLookupOutput = z.object({
  category: z.string(),
  query: z.string().nullable(),
  spacing: z.array(SpacingToken).optional(),
  type: z.array(TypeToken).optional(),
  colorGroups: z.array(ColorTokenGroup).optional(),
  colorValues: z.array(z.union([ColorValue, ColorValueNote])).optional(),
  motion: OpenObject.optional(),
  grid: OpenObject.optional(),
  breakpoints: z.array(Breakpoint).optional(),
  themes: z.array(ThemeEntry).optional(),
  rules: z.record(z.string(), z.string()),
});
export const ComponentOutput = z.object({
  matched: z.boolean(),
  component: ComponentEntry.nullable(),
  docHighlights: z.array(DocHighlight),
  suggestions: z.array(z.string()).optional(),
});
export const ChartOutput = z.object({
  mode: z.string(),
  query: z.string().nullable(),
  note: z.string().optional(),
  setup: ChartSetup.optional(),
  dataModel: z.string().optional(),
  families: z.array(ChartFamily).optional(),
  optionsReference: z.record(z.string(), z.string()).optional(),
  count: z.number(),
  results: z.array(z.union([ChartLookupEntry, ChartOverviewEntry])),
});
export const AiChatOutput = z.object({
  mode: z.string(),
  query: z.string().nullable(),
  note: z.string().optional(),
  package: z.string().optional(),
  version: z.string().optional(),
  summary: z.string().optional(),
  docsBase: z.string().optional(),
  setup: z.record(z.string(), z.string()).optional(),
  peerDeps: z.record(z.string(), z.string()).optional(),
  themes: z.array(z.string()).optional(),
  config: z.array(AiChatConfigField).optional(),
  responseTypeNames: z.array(z.string()).optional(),
  events: z.array(z.string()).optional(),
  instanceApi: z.record(z.string(), z.string()).optional(),
  antiPatterns: z.array(z.string()).optional(),
  count: z.number(),
  results: z.array(z.union([AiChatTopicEntry, AiChatResponseEntry, AiChatOverviewEntry])),
});
export const LabsOutput = z.object({
  mode: z.string(),
  query: z.string().nullable(),
  note: z.string().optional(),
  summary: z.string().optional(),
  relationToCore: z.string().optional(),
  stabilityWarning: z.string().optional(),
  apiCaveat: z.string().optional(),
  docsBase: z.string().optional(),
  npmScope: z.string().optional(),
  versionsAsOf: z.string().optional(),
  disambiguation: z.array(z.object({ topic: z.string(), note: z.string() })).optional(),
  frameworks: z.array(z.string()).optional(),
  statuses: z.array(z.string()).optional(),
  count: z.number(),
  results: z.array(z.union([LabsPackageEntry, LabsOverviewEntry])),
});
export const ListOutput = z.object({ kind: z.string(), items: z.array(ListItem) });
export const GuidelinesOutput = z.object({
  topic: z.string().nullable(),
  nonNegotiables: z.array(z.string()),
  guidance: z.array(DocHighlight),
});
