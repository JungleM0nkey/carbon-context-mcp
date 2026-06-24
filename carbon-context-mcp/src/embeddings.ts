// Optional local semantic layer. Loads a bundled ONNX model (all-MiniLM-L6-v2) and the
// prebuilt vector index (data/embeddings.bin) to provide HYBRID search = semantic + keyword.
// Fully offline (allowRemoteModels=false). If the model, index, or transformers dep is
// missing, or counts don't match the current corpus, everything degrades to keyword search.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  docChunks,
  codeCorpus,
  termScore,
  inScope,
  codeMatchesComponent,
  langMatches,
  corpusFingerprint,
  searchDocs as searchKeywordDocs,
  searchCode as searchKeywordCode,
  type SearchHit,
  type CodeBlock,
} from "./data.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.CARBON_DOCS_DIR || join(__dirname, "..", "data");
const BIN = join(DATA_DIR, "embeddings.bin");
const META = join(DATA_DIR, "embeddings-meta.json");

interface Meta { model: string; dim: number; quantized: boolean; nDocs: number; nCode: number; total: number; fingerprint?: string }

let meta: Meta | null = null;
let vectors: Float32Array | null = null;
let extractor: ((t: string[], o: object) => Promise<{ data: Float32Array }>) | null = null;
let semanticEnabled = true; // flips false on any failure -> keyword fallback
let loadPromise: Promise<void> | null = null;

function loadIndex(): boolean {
  if (vectors && meta) return true;
  if (!existsSync(BIN) || !existsSync(META)) return false;
  try {
    meta = JSON.parse(readFileSync(META, "utf8")) as Meta;
    // validate the index still matches the live corpus (counts first — cheap fast path)
    if (docChunks().length !== meta.nDocs || codeCorpus().length !== meta.nCode) {
      console.error("[carbon-mcp] embedding index stale (corpus count changed) -> keyword fallback");
      meta = null;
      return false;
    }
    // then content+order fingerprint — catches reordered/edited corpora that counts miss
    if (meta.fingerprint && meta.fingerprint !== corpusFingerprint()) {
      console.error("[carbon-mcp] embedding index fingerprint mismatch (corpus changed) -> keyword fallback");
      meta = null;
      return false;
    }
    const buf = readFileSync(BIN);
    vectors = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    return true;
  } catch (e) {
    console.error("[carbon-mcp] failed to load embedding index:", e);
    return false;
  }
}

async function ensureModel(): Promise<boolean> {
  if (extractor) return true;
  if (!semanticEnabled) return false;
  if (!loadIndex()) { semanticEnabled = false; return false; }
  if (!loadPromise) {
    loadPromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.cacheDir = join(DATA_DIR, "model-cache");
      env.allowRemoteModels = false; // offline only
      env.allowLocalModels = true;
      extractor = (await pipeline("feature-extraction", meta!.model, { dtype: meta!.quantized ? "q8" : "fp32" })) as unknown as typeof extractor;
    })().catch((e) => {
      console.error("[carbon-mcp] embedding model unavailable -> keyword fallback:", e?.message || e);
      semanticEnabled = false;
      extractor = null;
    });
  }
  await loadPromise;
  return !!extractor;
}

async function embed(query: string): Promise<Float32Array | null> {
  if (!(await ensureModel())) return null;
  const ex = extractor; // capture: module global can be cleared by a concurrent failure
  if (!ex) return null;
  const out = await ex([query], { pooling: "mean", normalize: true });
  return out.data as Float32Array;
}

// cosine on L2-normalized vectors == dot product
function simAt(q: Float32Array, row: number, dim: number): number {
  let s = 0;
  const off = row * dim;
  for (let k = 0; k < dim; k++) s += q[k] * vectors![off + k];
  return s;
}

// blend: normalize keyword to [0,1] over candidates, semantic cosine clamped to [0,1]
function blend(sem: number, kw: number, kwMax: number): number {
  const k = kwMax > 0 ? kw / kwMax : 0;
  const s = Math.max(0, sem);
  return 0.6 * s + 0.4 * k;
}

export async function hybridDocs(query: string, scope?: string, limit = 5): Promise<{ mode: string; results: SearchHit[] }> {
  const chunks = docChunks();
  const cand: number[] = [];
  for (let i = 0; i < chunks.length; i++) if (inScope(chunks[i].source, scope)) cand.push(i);

  const qv = await embed(query);
  if (!qv || !vectors || !meta) {
    return { mode: "keyword", results: searchKeywordDocs(query, scope, limit) };
  }
  const dim = meta.dim;
  const kw = cand.map((i) => termScore(chunks[i].heading, chunks[i].text, query));
  const kwMax = Math.max(1, ...kw);
  const scored = cand
    .map((i, n) => ({ i, score: blend(simAt(qv, i, dim), kw[n], kwMax) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ i, score }) => {
      const c = chunks[i];
      return { source: c.source, heading: c.heading, score: Math.round(score * 1000) / 1000, snippet: c.text.length > 600 ? c.text.slice(0, 600) + "…" : c.text };
    });
  return { mode: "hybrid", results: scored };
}

export async function hybridCode(
  query: string,
  lang?: string,
  component?: string,
  limit = 6
): Promise<{ mode: string; results: CodeBlock[] }> {
  const blocks = codeCorpus();
  const cand: number[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (!langMatches(b.lang, lang)) continue;
    if (!codeMatchesComponent(b, component)) continue;
    cand.push(i);
  }
  const qv = await embed(query);
  if (!qv || !vectors || !meta) {
    return { mode: "keyword", results: searchKeywordCode(query, lang, component, limit) };
  }
  const dim = meta.dim;
  const base = meta.nDocs; // code vectors follow doc vectors in the .bin
  const kw = cand.map((i) => termScore(`${blocks[i].heading} ${blocks[i].component}`, blocks[i].code, query));
  const kwMax = Math.max(1, ...kw);
  const results = cand
    .map((i, n) => ({ i, score: blend(simAt(qv, base + i, dim), kw[n], kwMax) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ i }) => blocks[i]);
  return { mode: "hybrid", results };
}
