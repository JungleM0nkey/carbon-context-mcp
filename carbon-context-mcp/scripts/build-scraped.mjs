// Build-time: turn data/scraped/**/*.mdx (authored Carbon docs from carbon-website)
// into data/scraped-index.json: prose chunks (for carbon_docs_search) + code blocks
// (for carbon_code_search). Strips MDX noise (frontmatter/imports/exports/JSX tags).
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRAPED = join(__dirname, "..", "data", "scraped");
const OUT = join(__dirname, "..", "data", "scraped-index.json");

function walk(dir) {
  const out = [];
  // sort for deterministic corpus order — the vector index pairs by position,
  // so unsorted readdir would silently mispair vectors with chunks across rebuilds.
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".mdx")) out.push(p);
  }
  return out;
}

// Strip MDX/JSX noise from a whole prose block (not line-by-line): [^>] spans
// newlines, so multi-line opening tags (<ResourceCard\n  href="...">) are removed too.
function cleanProse(text) {
  return text
    .replace(/<\/?[A-Za-z][^>]*?>/g, "") // strip JSX/HTML tags, keep inner text
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/[ \t]+$/gm, "");
}

const docs = []; // { group, name, tab, heading, text }
const code = []; // { group, name, tab, heading, lang, code }

for (const file of walk(SCRAPED)) {
  const rel = file.slice(SCRAPED.length + 1); // e.g. components/button/usage.mdx
  const parts = rel.split("/");
  if (parts.length < 3) { console.warn(`skip (unexpected path depth): ${rel}`); continue; }
  const group = parts[0]; // components | foundations
  const name = parts[1];
  const tab = parts[2].replace(/\.mdx$/, "");
  const raw = readFileSync(file, "utf8");
  const lines = raw.split("\n");

  let i = 0;
  // frontmatter -> capture title/description into a synthetic intro chunk
  let title = name, description = "";
  if (lines[0]?.trim() === "---") {
    let fm = [];
    i = 1;
    while (i < lines.length && lines[i].trim() !== "---") fm.push(lines[i++]);
    i++; // skip closing ---
    const fmText = fm.join("\n");
    const tm = /title:\s*(.+)/.exec(fmText);
    const dm = /description:\s*([\s\S]*?)(?:\ntabs:|\n[a-z]+:|$)/.exec(fmText);
    if (tm) title = tm[1].trim();
    if (dm) description = dm[1].replace(/\n\s+/g, " ").trim();
  }
  if (description) docs.push({ group, name, tab, heading: title, text: description });

  let heading = title;
  let buf = [];
  const flush = () => {
    const text = cleanProse(buf.join("\n")).replace(/\n{3,}/g, "\n\n").trim();
    if (text.length > 12) docs.push({ group, name, tab, heading, text });
    buf = [];
  };

  for (; i < lines.length; i++) {
    let line = lines[i];
    if (/^\s*(import|export)\s/.test(line)) continue;
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) { flush(); heading = h[2].trim(); continue; }
    const fence = /^```(\w+)?/.exec(line.trim());
    if (fence) {
      const lang = fence[1] || "text";
      const block = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) block.push(lines[i++]);
      const snippet = block.join("\n").trim();
      if (snippet) code.push({ group, name, tab, heading, lang, code: snippet });
      continue;
    }
    buf.push(line);
  }
  flush();
}

const out = {
  generatedFrom: "carbon-design-system/carbon-website @ main src/pages/{components,elements}",
  componentCount: new Set(docs.filter((d) => d.group === "components").map((d) => d.name)).size,
  docChunks: docs.length,
  codeBlocks: code.length,
  docs,
  code,
};
writeFileSync(OUT, JSON.stringify(out));
console.log(`components: ${out.componentCount}`);
console.log(`doc chunks: ${out.docChunks}`);
console.log(`code blocks: ${out.codeBlocks} (langs: ${[...new Set(code.map((c) => c.lang))].join(", ")})`);
console.log(`-> ${OUT} (${(JSON.stringify(out).length / 1024).toFixed(0)} KB)`);
