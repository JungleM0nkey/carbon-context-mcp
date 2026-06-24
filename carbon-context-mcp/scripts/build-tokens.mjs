// Build-time: parse the raw Carbon monorepo source (data/source-raw/*.ts) into
// data/themes-resolved.json — semantic token -> resolved hex/rgba for each of the
// four themes (white, g10, g90, g100). Reproducible: re-run after refreshing source-raw.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW = join(__dirname, "..", "data", "source-raw");
const OUT = join(__dirname, "..", "data", "themes-resolved.json");

// ---- 1. primitives (colors.ts) ----
const colorsSrc = readFileSync(join(RAW, "colors_src_colors.ts"), "utf8");
const primitives = {}; // name -> hex
const aliases = {}; // name -> referenced name
for (const line of colorsSrc.split("\n")) {
  let m = /export const (\w+)\s*=\s*'(#[0-9a-fA-F]{3,8})';/.exec(line);
  if (m) { primitives[m[1]] = m[2].toLowerCase(); continue; }
  m = /export const (\w+)\s*=\s*(\w+);/.exec(line);
  if (m) { aliases[m[1]] = m[2]; }
}
// resolve aliases (one or two hops)
for (let i = 0; i < 3; i++) {
  for (const [name, ref] of Object.entries(aliases)) {
    if (primitives[name]) continue;
    if (primitives[ref]) primitives[name] = primitives[ref];
  }
}

function hexToRgba(hex, alpha) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// camelCase token -> Carbon kebab token name (layer01 -> layer-01, textPrimary -> text-primary,
// layerHover01 -> layer-hover-01)
function toKebab(name) {
  return name
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([a-zA-Z])(\d)/g, "$1-$2")
    .toLowerCase();
}

// resolve a theme RHS expression to a value, given a context of already-resolved
// camelCase semantic tokens in the same theme (for token->token references).
function resolveExpr(expr, ctx) {
  expr = expr.trim().replace(/;$/, "");
  const lookup = (name) => primitives[name] ?? ctx[name];
  if (lookup(expr)) return { value: lookup(expr), ref: expr };
  let m = /^adjustAlpha\(\s*(\w+)\s*,\s*([\d.]+)\s*\)$/.exec(expr);
  if (m) {
    const base = lookup(m[1]);
    if (base && base.startsWith("#")) return { value: hexToRgba(base, parseFloat(m[2])), ref: `${m[1]} @ ${m[2]}` };
  }
  m = /^rgba\(\s*(\w+)\s*,\s*([\d.]+)\s*\)$/.exec(expr);
  if (m) {
    const base = lookup(m[1]);
    if (base && base.startsWith("#")) return { value: hexToRgba(base, parseFloat(m[2])), ref: `${m[1]} @ ${m[2]}` };
  }
  if (/^'(.*)'$/.test(expr)) return { value: expr.replace(/'/g, ""), ref: "literal" };
  return { value: null, ref: expr }; // unresolved (e.g. adjustLightness / cross-group import)
}

// ---- 2. each theme (iterative resolution so token->token refs collapse) ----
const themeFiles = { white: "themes_src_white.ts", g10: "themes_src_g10.ts", g90: "themes_src_g90.ts", g100: "themes_src_g100.ts" };
const themes = {};
let tokenNames = new Set();
for (const [theme, file] of Object.entries(themeFiles)) {
  const src = readFileSync(join(RAW, file), "utf8");
  // collect raw camel -> expression
  const raw = {};
  for (const line of src.split("\n")) {
    const m = /export const (\w+)\s*=\s*(.+);$/.exec(line.trim());
    if (!m) continue;
    const camel = m[1];
    if (camel === "default" || /Token|tokens/.test(camel)) continue;
    raw[camel] = m[2];
  }
  // iterate until stable: ctx maps camel -> resolved hex/rgba value
  const ctx = {};
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    for (const [camel, expr] of Object.entries(raw)) {
      if (ctx[camel]) continue;
      const r = resolveExpr(expr, ctx);
      if (r.value !== null) { ctx[camel] = r.value; changed = true; }
    }
    if (!changed) break;
  }
  // final emit (kebab keys, with ref provenance)
  const tokens = {};
  for (const [camel, expr] of Object.entries(raw)) {
    const r = resolveExpr(expr, ctx);
    const kebab = toKebab(camel);
    tokens[kebab] = r;
    tokenNames.add(kebab);
  }
  themes[theme] = tokens;
}

const out = {
  generatedFrom: "carbon-design-system/carbon @ main packages/{colors,themes}/src",
  primitiveCount: Object.keys(primitives).length,
  primitives,
  tokenNames: [...tokenNames].sort(),
  themes,
};
writeFileSync(OUT, JSON.stringify(out, null, 2));

// report
const sample = (t, k) => themes[t][k]?.value ?? "?";
console.log(`primitives: ${Object.keys(primitives).length}`);
console.log(`theme tokens: ${tokenNames.size} unique`);
console.log(`blue60 = ${primitives.blue60}`);
for (const t of Object.keys(themes)) {
  console.log(`  ${t}: background=${sample(t, "background")} text-primary=${sample(t, "text-primary")} layer-01=${sample(t, "layer-01")} support-error=${sample(t, "support-error")}`);
}
console.log(`-> ${OUT}`);
