// Build-time: embed the doc + code corpora with a local ONNX model (all-MiniLM-L6-v2)
// into data/embeddings.bin (Float32, doc vectors then code vectors) + data/embeddings-meta.json.
// Requires the compiled corpus (run `npm run build` first). Bundles the model into
// data/model-cache so runtime is fully offline.
import { writeFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pipeline, env } from "@huggingface/transformers";
import { docChunks, codeCorpus, corpusFingerprint } from "../dist/data.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "data");
const MODEL = "Xenova/all-MiniLM-L6-v2";
const DIM = 384;

env.cacheDir = join(DATA, "model-cache");
env.allowRemoteModels = true; // build may download; runtime is offline

const docs = docChunks();
const code = codeCorpus();
const texts = [
  ...docs.map((d) => `${d.heading}\n${d.text}`.slice(0, 1000)),
  ...code.map((c) => `${c.component} ${c.heading}\n${c.code}`.slice(0, 1000)),
];
console.log(`corpus: ${docs.length} docs + ${code.length} code = ${texts.length} items`);

const t0 = Date.now();
const extractor = await pipeline("feature-extraction", MODEL, { dtype: "q8" });
console.log(`model loaded in ${Date.now() - t0}ms`);

const buf = new Float32Array(texts.length * DIM);
const BATCH = 64;
for (let i = 0; i < texts.length; i += BATCH) {
  const batch = texts.slice(i, i + BATCH);
  const out = await extractor(batch, { pooling: "mean", normalize: true });
  buf.set(out.data, i * DIM);
  if (i % (BATCH * 8) === 0) process.stdout.write(`\r  embedded ${Math.min(i + BATCH, texts.length)}/${texts.length}`);
}
process.stdout.write("\n");

const meta = {
  model: MODEL,
  dim: DIM,
  quantized: true,
  nDocs: docs.length,
  nCode: code.length,
  total: texts.length,
  fingerprint: corpusFingerprint(), // runtime refuses the index if the live corpus differs
  note: "Row i in embeddings.bin pairs with docChunks()[i] for i<nDocs, else codeCorpus()[i-nDocs]. Rebuild after any corpus change.",
};
// write to temp files then rename — atomic, so a crash can't leave bin/meta desynced.
// rename the bin first and meta (the validator's source of truth) last.
const binTmp = join(DATA, "embeddings.bin.tmp");
const metaTmp = join(DATA, "embeddings-meta.json.tmp");
writeFileSync(binTmp, Buffer.from(buf.buffer));
writeFileSync(metaTmp, JSON.stringify(meta, null, 2));
renameSync(binTmp, join(DATA, "embeddings.bin"));
renameSync(metaTmp, join(DATA, "embeddings-meta.json"));
console.log(`wrote embeddings.bin (${(buf.byteLength / 1024 / 1024).toFixed(1)} MB) + meta in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
