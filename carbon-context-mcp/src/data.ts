// Data layer: loads the bundled, self-contained Carbon reference data and provides
// full-text doc search + code search over a merged corpus:
//   - the hand-authored reference pack (data/references/*.md)
//   - the scraped authored docs from carbon-website (data/scraped-index.json)
//   - structured tokens (data/tokens.json) + resolved per-theme hex (data/themes-resolved.json)
//   - structured component APIs (data/components.json)
// No network access — everything ships in ../data.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.CARBON_DOCS_DIR || join(__dirname, "..", "data");
const REFS_DIR = join(DATA_DIR, "references");

function loadJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, file), "utf8")) as T;
}

// ---- structured data ----

export interface TokensData {
  spacing: Array<{ token: string; rem: number; px: number; use: string }>;
  type: Array<Record<string, unknown>>;
  typeSets: Record<string, unknown>;
  colorTokenGroups: Array<{ group: string; tokens: string[]; purpose: string }>;
  themes: Array<{ name: string; mode: string; background: string }>;
  layeringModel: string;
  motion: Record<string, unknown>;
  grid: Record<string, unknown>;
  rules: Record<string, string>;
}
export interface ComponentEntry {
  name: string;
  import: string;
  summary: string;
  props: Record<string, string>;
  rules: string[];
  example: string;
}
export interface ComponentsData {
  catalog: string[];
  packages: Record<string, string>;
  components: ComponentEntry[];
  patterns: string[];
}
export interface ThemeTokenValue { value: string | null; ref: string }
export interface ThemesResolved {
  generatedFrom: string;
  primitiveCount: number;
  primitives: Record<string, string>;
  tokenNames: string[];
  themes: Record<string, Record<string, ThemeTokenValue>>;
}
interface ScrapedIndex {
  generatedFrom: string;
  componentCount: number;
  docs: Array<{ group: string; name: string; tab: string; heading: string; text: string }>;
  code: Array<{ group: string; name: string; tab: string; heading: string; lang: string; code: string }>;
}
interface StorybookIndex {
  generatedFrom: string;
  componentCount: number;
  snippetCount: number;
  imports: Record<string, string>;
  snippets: Array<{ component: string; story: string; code: string; variant?: string }>;
}
export interface ChartEntry {
  name: string;
  aka: string[];
  family: string;
  intent: string;
  tags: string[];
  dataShape: string;
  when: string;
  avoidWhen: string;
  example: string;
  docNote?: string;
}
export interface ChartsData {
  generatedFrom: string;
  docsBase: string;
  packages: Record<string, string>;
  setup: Record<string, string>;
  dataModel: string;
  themes: string[];
  scaleTypes: string[];
  optionsReference: Record<string, string>;
  families: Array<{ family: string; intent: string; charts: string[] }>;
  charts: ChartEntry[];
}
export interface AiChatTopic {
  topic: string;
  aka: string[];
  summary: string;
  detail?: string;
  example?: string;
  docNote?: string;
}
export interface AiChatResponseType {
  type: string;
  item: string;
  fields: string;
  use: string;
  example?: string;
}
export interface AiChatExample {
  name: string;
  lang: string;
  title: string;
  code: string;
}
export interface AiChatData {
  generatedFrom: string;
  package: string;
  version: string;
  license: string;
  docsBase: string;
  repo: string;
  summary: string;
  packages: Record<string, string>;
  peerDeps: Record<string, string>;
  setup: Record<string, string>;
  themes: string[];
  responseTypeNames: string[];
  configFields: Array<{ field: string; type: string; purpose: string }>;
  events: string[];
  instanceApi: Record<string, string>;
  antiPatterns: string[];
  topics: AiChatTopic[];
  responseTypes: AiChatResponseType[];
  examples: AiChatExample[];
}
export interface LabsPackage {
  name: string;
  dir: string;
  framework: string;
  status: string;
  version: string;
  purpose: string;
  install: string;
  components: string;
  dependsOn: string[];
  gap: string | null;
  aka: string[];
  tags: string[];
  storybook: string | null;
  deprecatedBy: string | null;
  note: string | null;
}
export interface LabsData {
  generatedFrom: string;
  repo: string;
  docsBase: string;
  npmScope: string;
  license: string;
  versionsAsOf: string;
  summary: string;
  relationToCore: string;
  stabilityWarning: string;
  apiCaveat: string;
  disambiguation: Array<{ topic: string; note: string }>;
  frameworks: string[];
  statuses: string[];
  packages: LabsPackage[];
}

export const tokens = loadJson<TokensData>("tokens.json");
export const components = loadJson<ComponentsData>("components.json");
export const themesResolved: ThemesResolved | null = existsSync(join(DATA_DIR, "themes-resolved.json"))
  ? loadJson<ThemesResolved>("themes-resolved.json")
  : null;
const scraped: ScrapedIndex | null = existsSync(join(DATA_DIR, "scraped-index.json"))
  ? loadJson<ScrapedIndex>("scraped-index.json")
  : null;
const storybook: StorybookIndex | null = existsSync(join(DATA_DIR, "storybook-index.json"))
  ? loadJson<StorybookIndex>("storybook-index.json")
  : null;
export const charts: ChartsData | null = existsSync(join(DATA_DIR, "charts.json"))
  ? loadJson<ChartsData>("charts.json")
  : null;
export const aiChat: AiChatData | null = existsSync(join(DATA_DIR, "ai-chat.json"))
  ? loadJson<AiChatData>("ai-chat.json")
  : null;
export const labs: LabsData | null = existsSync(join(DATA_DIR, "labs.json"))
  ? loadJson<LabsData>("labs.json")
  : null;

export const THEME_NAMES = ["white", "g10", "g90", "g100"] as const;

// ---- doc corpus (reference pack + scraped docs) ----

export interface DocChunk { source: string; heading: string; text: string }

function chunkMarkdown(source: string, md: string): DocChunk[] {
  const chunks: DocChunk[] = [];
  let heading = source.replace(/\.md$/, "");
  let buf: string[] = [];
  const flush = () => {
    const text = buf.join("\n").trim();
    if (text) chunks.push({ source, heading, text });
    buf = [];
  };
  for (const line of md.split("\n")) {
    const m = /^(#{1,4})\s+(.*)$/.exec(line);
    if (m) { flush(); heading = m[2].trim(); } else buf.push(line);
  }
  flush();
  return chunks;
}

let _chunks: DocChunk[] | null = null;
export function docChunks(): DocChunk[] {
  if (_chunks) return _chunks;
  const out: DocChunk[] = [];
  // reference pack
  if (existsSync(REFS_DIR)) {
    for (const file of readdirSync(REFS_DIR).sort()) {
      if (file.endsWith(".md")) out.push(...chunkMarkdown(file, readFileSync(join(REFS_DIR, file), "utf8")));
    }
  }
  // scraped authored docs
  if (scraped) {
    for (const d of scraped.docs) {
      out.push({ source: `${d.group}/${d.name}/${d.tab}`, heading: d.heading, text: d.text });
    }
  }
  _chunks = out;
  return out;
}

export interface SearchHit { source: string; heading: string; score: number; snippet: string }

// shared keyword scorer (term frequency + heading bonus + whole-phrase bonus)
export function termScore(heading: string, body: string, query: string): number {
  const q = query.toLowerCase().trim();
  const terms = q.split(/\s+/).filter((t) => t.length > 1);
  const hLower = heading.toLowerCase();
  const hay = `${hLower}\n${body}`.toLowerCase();
  let score = 0;
  for (const t of terms) {
    const inHead = hLower.includes(t);
    const bodyCount = hay.split(t).length - 1;
    if (bodyCount > 0) score += bodyCount + (inHead ? 5 : 0);
  }
  if (q && hay.includes(q)) score += 10;
  return score;
}

export function inScope(source: string, scope?: string): boolean {
  if (!scope) return true;
  const sc = scope.toLowerCase();
  return source.toLowerCase().includes(sc) || `${sc}.md`.includes(source.toLowerCase());
}

export function searchDocs(query: string, scope?: string, limit = 5): SearchHit[] {
  const hits: SearchHit[] = [];
  for (const c of docChunks()) {
    if (!inScope(c.source, scope)) continue;
    const score = termScore(c.heading, c.text, query);
    if (score > 0) {
      hits.push({ source: c.source, heading: c.heading, score, snippet: c.text.length > 600 ? c.text.slice(0, 600) + "…" : c.text });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

// ---- code corpus (scraped code + reference fences + component examples) ----

export interface CodeBlock { source: string; component: string; lang: string; heading: string; code: string }

function extractFences(source: string, md: string): CodeBlock[] {
  const out: CodeBlock[] = [];
  const lines = md.split("\n");
  let heading = source;
  for (let i = 0; i < lines.length; i++) {
    const h = /^(#{1,4})\s+(.*)$/.exec(lines[i]);
    if (h) { heading = h[2].trim(); continue; }
    const f = /^```(\w+)?/.exec(lines[i].trim());
    if (f) {
      const lang = f[1] || "text";
      const block: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) block.push(lines[i++]);
      const code = block.join("\n").trim();
      if (code) out.push({ source, component: "", lang, heading, code });
    }
  }
  return out;
}

let _code: CodeBlock[] | null = null;
export function codeCorpus(): CodeBlock[] {
  if (_code) return _code;
  const out: CodeBlock[] = [];
  if (scraped) {
    for (const c of scraped.code) {
      out.push({ source: `${c.group}/${c.name}/${c.tab}`, component: c.name, lang: c.lang, heading: c.heading, code: c.code });
    }
  }
  // reference-pack fenced blocks (setup/components/tokens carry rich examples)
  if (existsSync(REFS_DIR)) {
    for (const file of readdirSync(REFS_DIR).sort()) {
      if (file.endsWith(".md")) out.push(...extractFences(file, readFileSync(join(REFS_DIR, file), "utf8")));
    }
  }
  // hand-authored component examples
  for (const c of components.components) {
    if (c.example) out.push({ source: "components.json", component: c.name, lang: "jsx", heading: `${c.name} example`, code: c.example });
  }
  // canonical Storybook story snippets + per-component import blocks
  if (storybook) {
    for (const [component, imp] of Object.entries(storybook.imports)) {
      out.push({ source: `storybook/${component}`, component, lang: "jsx", heading: `${component} imports`, code: imp });
    }
    for (const s of storybook.snippets) {
      const label = s.variant ? `${s.component} (${s.variant}) — ${s.story}` : `${s.component} — ${s.story}`;
      out.push({ source: `storybook/${s.component}`, component: s.component, lang: "jsx", heading: label, code: s.code });
    }
  }
  // @carbon/charts data-viz examples (one runnable React snippet per chart type)
  if (charts) {
    for (const c of charts.charts) {
      out.push({
        source: `charts/${c.name}`,
        component: c.name,
        lang: "jsx",
        heading: `${c.name} (${c.family}) — ${c.intent}`,
        code: c.example,
      });
    }
  }
  // @carbon/ai-chat examples + per-topic snippets (folded in so code/semantic search surfaces them)
  if (aiChat) {
    for (const ex of aiChat.examples) {
      out.push({ source: `ai-chat/${ex.name}`, component: "ai-chat", lang: ex.lang, heading: ex.title, code: ex.code });
    }
    for (const t of aiChat.topics) {
      if (t.example) out.push({ source: `ai-chat/${t.topic}`, component: "ai-chat", lang: "tsx", heading: `Carbon AI Chat — ${t.topic}`, code: t.example });
    }
  }
  _code = out;
  return out;
}

// ---- @carbon/charts catalog lookup + recommendation ----

export function findCharts(query: string): ChartEntry[] {
  if (!charts) return [];
  const q = query.toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const nq = norm(query);
  if (!nq) return []; // empty / punctuation-only -> no match (never dump the whole catalog)
  // exact name or alias match first
  const exact = charts.charts.filter(
    (c) => norm(c.name) === nq || c.aka.some((a) => norm(a) === nq)
  );
  if (exact.length) return exact;
  // substring / token match — require >=2 chars so a stray letter can't match everything,
  // and drop the universal token "chart" (every component name ends in "Chart").
  const tokens = q.split(/\s+/).filter((t) => t.length > 2 && t !== "chart");
  return charts.charts.filter((c) => {
    if (nq.length >= 2 && nq !== "chart" && (norm(c.name).includes(nq) || c.aka.some((a) => norm(a).includes(nq) || nq.includes(norm(a)))))
      return true;
    return tokens.some((t) => c.name.toLowerCase().includes(t) || c.aka.some((a) => a.includes(t)));
  });
}

// score charts by a free-text data-viz intent (keyword overlap over intent/tags/family/when)
export function recommendCharts(intent: string, limit = 4): Array<ChartEntry & { score: number }> {
  if (!charts) return [];
  const terms = intent.toLowerCase().split(/\s+/).filter((t) => t.length > 2 && t !== "chart");
  const scored = charts.charts.map((c) => {
    // score over meaning fields only — NOT c.name (every name ends in "Chart", which would skew)
    const hay = `${c.intent} ${c.tags.join(" ")} ${c.family} ${c.when} ${c.aka.join(" ")}`.toLowerCase();
    let score = 0;
    for (const t of terms) {
      const n = hay.split(t).length - 1;
      if (n > 0) score += Math.min(n, 3) + (c.tags.some((tag) => tag.includes(t)) ? 2 : 0); // cap per-term
    }
    return { ...c, score };
  });
  return scored.filter((c) => c.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

// ---- @carbon/ai-chat catalog lookup ----

// Find topic entries by free-text query over topic/aka/summary (specific-first).
export function findAiChatTopics(query: string): Array<AiChatTopic & { score: number }> {
  if (!aiChat) return [];
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const nq = norm(query);
  if (!nq) return [];
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const scored = aiChat.topics.map((t) => {
    let score = 0;
    if (norm(t.topic) === nq || t.aka.some((a) => norm(a) === nq)) score += 50; // exact topic/alias
    // near-miss in BOTH directions (mirrors findAiChatResponses) so a plural/superset
    // query like "layouts" still resolves the "layout" topic.
    if (norm(t.topic).includes(nq) || nq.includes(norm(t.topic)) || t.aka.some((a) => norm(a).includes(nq) || nq.includes(norm(a)))) score += 10;
    const hay = `${t.topic} ${t.aka.join(" ")} ${t.summary} ${t.detail ?? ""}`.toLowerCase();
    for (const term of terms) {
      const n = hay.split(term).length - 1;
      if (n > 0) score += Math.min(n, 3) + (t.aka.some((a) => a.includes(term)) ? 3 : 0);
    }
    return { ...t, score };
  });
  return scored.filter((t) => t.score > 0).sort((a, b) => b.score - a.score);
}

// Find response-type entries by name/keyword (e.g. 'card', 'user_defined', 'rag').
export function findAiChatResponses(query: string): Array<AiChatResponseType & { score: number }> {
  if (!aiChat) return [];
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const nq = norm(query);
  if (!nq) return [];
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const scored = aiChat.responseTypes.map((r) => {
    let score = 0;
    if (norm(r.type) === nq) score += 50;
    if (norm(r.type).includes(nq) || nq.includes(norm(r.type))) score += 10;
    const hay = `${r.type} ${r.item} ${r.use} ${r.fields}`.toLowerCase();
    for (const term of terms) {
      const n = hay.split(term).length - 1;
      if (n > 0) score += Math.min(n, 3);
    }
    return { ...r, score };
  });
  return scored.filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
}

// ---- @carbon-labs catalog lookup + gap recommendation ----

// Find labs packages by free-text name/alias query (specific-first; never dumps the catalog).
export function findLabsPackages(query: string): Array<LabsPackage & { score: number }> {
  if (!labs) return [];
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const nq = norm(query);
  if (!nq) return [];
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const scored = labs.packages.map((p) => {
    let score = 0;
    const short = p.name.replace("@carbon-labs/", "");
    if (norm(p.name) === nq || norm(short) === nq || p.aka.some((a) => norm(a) === nq)) score += 50; // exact name/alias
    if (norm(short).includes(nq) || nq.includes(norm(short)) || p.aka.some((a) => norm(a).includes(nq) || nq.includes(norm(a)))) score += 10;
    const hay = `${short} ${p.aka.join(" ")} ${p.purpose} ${p.tags.join(" ")} ${p.gap ?? ""}`.toLowerCase();
    for (const t of terms) {
      const n = hay.split(t).length - 1;
      if (n > 0) score += Math.min(n, 3) + (p.aka.some((a) => a.includes(t)) ? 3 : 0) + (p.tags.some((tag) => tag.includes(t)) ? 2 : 0);
    }
    return { ...p, score };
  });
  return scored.filter((p) => p.score > 0).sort((a, b) => b.score - a.score);
}

// Score labs packages by a free-text gap/intent ("I need X that core Carbon lacks").
// Scores over meaning fields (purpose/gap/tags/aka), never the package name alone.
export function recommendLabs(intent: string, framework?: string, limit = 5): Array<LabsPackage & { score: number }> {
  if (!labs) return [];
  const terms = intent.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const scored = labs.packages
    .filter((p) => !framework || p.framework === framework)
    .map((p) => {
      const hay = `${p.purpose} ${p.gap ?? ""} ${p.tags.join(" ")} ${p.aka.join(" ")}`.toLowerCase();
      let score = 0;
      for (const t of terms) {
        const n = hay.split(t).length - 1;
        if (n > 0) score += Math.min(n, 3) + (p.tags.some((tag) => tag.includes(t)) ? 2 : 0);
      }
      // experimental/usable packages rank above deprecated/example/infra for an intent query
      if (score > 0 && (p.status === "deprecated" || p.status === "example" || p.status === "infra")) score -= 1;
      return { ...p, score };
    });
  return scored.filter((p) => p.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

export function codeMatchesComponent(b: CodeBlock, component?: string): boolean {
  if (!component) return true;
  const comp = component.toLowerCase().replace(/[^a-z]/g, "");
  const bc = b.component.toLowerCase().replace(/[^a-z]/g, "");
  return !!bc && (bc.includes(comp) || comp.includes(bc));
}

// lang filter that treats "js" and "javascript" as one bucket in BOTH directions
// (the scraped corpus tags some blocks "js" and others "javascript").
export function langMatches(blockLang: string, want?: string): boolean {
  if (!want) return true;
  const norm = (l: string) => (l === "javascript" ? "js" : l);
  return norm(blockLang) === norm(want);
}

export function searchCode(query: string, lang?: string, component?: string, limit = 6): CodeBlock[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter((t) => t.length > 1);
  return codeCorpus()
    .filter((b) => langMatches(b.lang, lang))
    .filter((b) => codeMatchesComponent(b, component))
    .map((b) => ({ b, score: termScore(`${b.heading} ${b.component}`, b.code, query) }))
    .filter((x) => x.score > 0 || (!terms.length && (component || lang)))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.b);
}

// ---- resolved theme color lookup ----

export function resolveColor(tokenName: string, theme?: string): Array<{ token: string; theme: string; value: string | null; ref: string }> {
  if (!themesResolved) return [];
  const want = tokenName.replace(/^\$/, "").toLowerCase();
  const themesToScan = theme ? [theme] : Object.keys(themesResolved.themes);
  const out: Array<{ token: string; theme: string; value: string | null; ref: string }> = [];
  for (const th of themesToScan) {
    const map = themesResolved.themes[th];
    if (!map) continue;
    for (const [name, v] of Object.entries(map)) {
      if (name === want || name.includes(want)) out.push({ token: `$${name}`, theme: th, value: v.value, ref: v.ref });
    }
  }
  return out;
}

export const SECTIONS = ["tokens", "components", "setup", "anti-patterns", "sources", "charts", "ai-chat"] as const;

// Content fingerprint over the FULL corpus in iteration order. The embedding build
// stamps this into embeddings-meta.json; the runtime recomputes it and refuses a
// stale/misordered index. Catches the silent failure where the corpus is regenerated
// (e.g. on a different machine) and vectors mispair with chunks while counts still match.
export function corpusFingerprint(): string {
  const h = createHash("sha256");
  for (const d of docChunks()) h.update(`D ${d.source} ${d.heading} ${d.text} `);
  for (const c of codeCorpus())
    h.update(`C ${c.source} ${c.component} ${c.lang} ${c.heading} ${c.code} `);
  return h.digest("hex");
}
