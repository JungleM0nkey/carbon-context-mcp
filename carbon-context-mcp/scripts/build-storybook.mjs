// Build-time: parse Carbon React Storybook story sources
// (data/source-raw/stories/*.stories.js) into data/storybook-index.json —
// canonical named-story JSX snippets per component, for carbon_code_search.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORIES = join(__dirname, "..", "data", "source-raw", "stories");
const OUT = join(__dirname, "..", "data", "storybook-index.json");

const MAX = 2000; // cap per-snippet length

function extractImports(src) {
  const m = src.match(/^import[\s\S]*?from\s+['"][^'"]+['"];/gm) || [];
  // keep @carbon imports (the instructive ones), cap a few
  const carbon = m.filter((s) => /@carbon|carbon-components/.test(s));
  return (carbon.length ? carbon : m).slice(0, 8).join("\n");
}

// find boundaries of top-level `export const Name =` / `export default` / `export function`.
// Match ANY identifier case: Carbon ships camelCase story exports (e.g. `withAILabel`)
// that must be their own boundary, else they get merged into the preceding story.
function splitStories(component, src) {
  const re = /\nexport\s+(?:const\s+(\w+)\s*=|default\b|function\s+(\w+))/g;
  const marks = [];
  let m;
  while ((m = re.exec(src))) {
    marks.push({ idx: m.index + 1, name: m[1] || m[2] || null, isDefault: /default/.test(m[0]) });
  }
  marks.push({ idx: src.length, name: null });
  const out = [];
  for (let i = 0; i < marks.length - 1; i++) {
    const cur = marks[i];
    if (cur.isDefault || !cur.name) continue; // skip meta/default config
    let chunk = src.slice(cur.idx, marks[i + 1].idx);
    // drop trailing CSF config (Name.args = ..., Name.parameters = ..., Name.story = ...)
    const cfg = new RegExp(`\\n${cur.name}\\.(args|argTypes|parameters|story|storyName|decorators)\\b`);
    const cut = chunk.search(cfg);
    if (cut > 0) chunk = chunk.slice(0, cut);
    chunk = chunk.trim();
    // skip pure skeleton/no-op one-liners that aren't instructive
    if (chunk.length < 24) continue;
    if (chunk.length > MAX) chunk = chunk.slice(0, MAX) + "\n// …(truncated)";
    out.push({ component, story: cur.name, code: chunk });
  }
  return out;
}

// "DataTable-batch-actions.stories.js" -> { component:"DataTable", variant:"batch-actions" }
// "ActionableNotification.featureflag.stories.js" -> { component:"ActionableNotification", variant:"featureflag" }
function nameOf(file) {
  let base = file.replace(/\.stories\.js$/, "");
  let variant = "";
  const ff = base.match(/^(.+)\.(featureflag|unstable|feature-flag)$/i);
  if (ff) { base = ff[1]; variant = ff[2].toLowerCase(); }
  const dash = base.match(/^([A-Za-z]+)-(.+)$/);
  if (dash) { base = dash[1]; variant = variant ? `${dash[2]}/${variant}` : dash[2]; }
  return { component: base, variant };
}

const imports = {};
const snippets = [];
for (const file of readdirSync(STORIES).sort()) {
  if (!file.endsWith(".stories.js")) continue;
  const { component, variant } = nameOf(file);
  const src = readFileSync(join(STORIES, file), "utf8");
  const imp = extractImports(src);
  if (imp && !imports[component]) imports[component] = imp;
  for (const s of splitStories(component, src)) {
    snippets.push(variant ? { ...s, variant } : s);
  }
}

const out = {
  generatedFrom: "carbon-design-system/carbon @ main packages/react/src/components/*/*.stories.js",
  componentCount: Object.keys(imports).length,
  snippetCount: snippets.length,
  imports,
  snippets,
};
writeFileSync(OUT, JSON.stringify(out));
console.log(`story files: ${Object.keys(imports).length}`);
console.log(`snippets: ${snippets.length}`);
const byComp = {};
for (const s of snippets) byComp[s.component] = (byComp[s.component] || 0) + 1;
const top = Object.entries(byComp).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c, n]) => `${c}:${n}`);
console.log(`top components: ${top.join(", ")}`);
console.log(`-> ${OUT} (${(JSON.stringify(out).length / 1024).toFixed(0)} KB)`);
