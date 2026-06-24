// Minimal stdio JSON-RPC smoke test for carbon-mcp.
// Spawns the built server, runs initialize + tools/list + a few tools/call, prints results.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const server = join(__dirname, "..", "dist", "index.js");

const child = spawn("node", [server], { stdio: ["pipe", "pipe", "inherit"] });

let buf = "";
const pending = new Map();
child.stdout.on("data", (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

let id = 0;
function rpc(method, params) {
  const myId = ++id;
  return new Promise((resolve) => {
    pending.set(myId, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: myId, method, params }) + "\n");
  });
}
function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

const ok = (label, cond) => console.log(`${cond ? "✅" : "❌"} ${label}`);

// Full build ships the semantic index (mode=hybrid); a lean keyword-only build
// (no @huggingface/transformers / embeddings.bin) correctly returns mode=keyword.
// Default accepts either; set SMOKE_FULL=1 to require the semantic index.
const requireHybrid = process.env.SMOKE_FULL === "1";
const modeOk = (m) => (requireHybrid ? m === "hybrid" : m === "hybrid" || m === "keyword");

const init = await rpc("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "smoke", version: "1.0.0" },
});
ok(`initialize -> ${init.result?.serverInfo?.name}`, init.result?.serverInfo?.name === "carbon-context-mcp");
notify("notifications/initialized", {});

const list = await rpc("tools/list", {});
const names = (list.result?.tools || []).map((t) => t.name);
ok(`tools/list -> ${names.join(", ")}`, names.length === 9 && names.includes("carbon_chart") && names.includes("carbon_ai_chat") && names.includes("carbon_labs"));

async function call(name, args) {
  const r = await rpc("tools/call", { name, arguments: args });
  return r.result?.structuredContent ?? r.result;
}

const sp = await call("carbon_token_lookup", { category: "spacing", query: "spacing-05" });
ok(`carbon_token_lookup spacing-05 -> ${sp.spacing?.[0]?.px}px`, sp.spacing?.[0]?.px === 16);

const ty = await call("carbon_token_lookup", { category: "type", query: "body-01" });
ok(`carbon_token_lookup body-01 lh -> ${ty.type?.[0]?.lineHeight}`, ty.type?.[0]?.lineHeight === 20);

const cmp = await call("carbon_component", { name: "data table" });
ok(`carbon_component 'data table' -> ${cmp.component?.name}`, cmp.component?.name === "DataTable");

// resolved per-theme hex from Carbon source
const hex = await call("carbon_token_lookup", { category: "color", query: "support-error", theme: "g100" });
const g100err = hex.colorValues?.find((v) => v.token === "$support-error" && v.theme === "g100");
ok(`carbon_token_lookup support-error @g100 -> ${g100err?.value}`, g100err?.value === "#fa4d56");

const layer = await call("carbon_token_lookup", { category: "color", query: "layer-01" });
ok(`carbon_token_lookup layer-01 -> ${layer.colorValues?.length} theme values`, (layer.colorValues?.length ?? 0) >= 4);

// scraped docs now searchable (component usage/accessibility)
const ds = await call("carbon_docs_search", { query: "batch action selection", scope: "data-table", limit: 3 });
ok(`carbon_docs_search 'batch action' scope=data-table -> ${ds.count} hits (top: ${ds.results?.[0]?.source})`, ds.count > 0 && /data-table/.test(ds.results?.[0]?.source || ""));

// SEMANTIC: natural-language query with few exact keyword overlaps
const sem = await call("carbon_docs_search", { query: "warn the user before they delete something irreversible", limit: 5 });
const semHit = (sem.results || []).some((r) => /modal|notification|danger|delete|destructive/i.test(`${r.source} ${r.heading} ${r.snippet}`));
ok(`carbon_docs_search semantic 'warn before delete' -> mode=${sem.mode}, relevant=${semHit}`, modeOk(sem.mode) && semHit);

const semCode = await call("carbon_code_search", { query: "apply a dark theme across the whole application", limit: 5 });
const themeHit = (semCode.results || []).some((r) => /theme/i.test(`${r.heading} ${r.code}`));
ok(`carbon_code_search semantic 'dark theme app' -> mode=${semCode.mode}, themeHit=${themeHit}`, modeOk(semCode.mode) && themeHit);

const a11y = await call("carbon_docs_search", { query: "keyboard", scope: "accessibility", limit: 5 });
ok(`carbon_docs_search keyboard scope=accessibility -> ${a11y.count} hits`, a11y.count > 0);

// new code_search tool
const cs = await call("carbon_code_search", { query: "GlobalTheme theme", lang: "jsx", limit: 4 });
ok(`carbon_code_search 'GlobalTheme' jsx -> ${cs.count} blocks`, cs.count > 0);

// storybook-sourced snippets now in the corpus
const sb = await call("carbon_code_search", { query: "selection", component: "DataTable", limit: 5 });
const fromSb = (sb.results || []).some((r) => /storybook\/DataTable/.test(r.source));
ok(`carbon_code_search DataTable 'selection' -> ${sb.count} (storybook: ${fromSb})`, sb.count > 0 && fromSb);

const imp = await call("carbon_code_search", { query: "import Dropdown", limit: 5 });
ok(`carbon_code_search 'import Dropdown' -> ${imp.count} blocks`, imp.count > 0);

const cmpDocs = await call("carbon_component", { name: "modal" });
ok(`carbon_component modal -> ${cmpDocs.component?.name}, ${cmpDocs.docHighlights?.length ?? 0} highlights`, cmpDocs.component?.name === "Modal");

const ls = await call("carbon_list", { kind: "themes" });
ok(`carbon_list themes -> ${ls.items?.map((t) => t.name).join("/")}`, ls.items?.length === 4);

const gl = await call("carbon_guidelines", { topic: "shadows" });
ok(`carbon_guidelines shadows -> ${gl.nonNegotiables?.length} non-negotiables, ${gl.guidance?.length} guidance`, gl.nonNegotiables?.length === 7 && gl.guidance?.length > 0);

// error/empty path: unknown component returns matched:false + suggestions (not a crash)
const miss = await call("carbon_component", { name: "zzznotacomponent" });
ok(`carbon_component unknown -> matched=${miss.matched}, ${miss.suggestions?.length ?? 0} suggestions`, miss.matched === false && (miss.suggestions?.length ?? 0) > 0);

// carbon_chart: lookup by name -> resolves to DonutChart with a runnable example + import
const chDonut = await call("carbon_chart", { name: "donut" });
const donut = (chDonut.results || []).find((r) => r.name === "DonutChart");
ok(`carbon_chart name=donut -> mode=${chDonut.mode}, ${donut?.name} (import: ${!!donut?.import})`, chDonut.mode === "lookup" && donut?.name === "DonutChart" && /@carbon\/charts-react/.test(donut?.import || "") && /donut: \{ center/.test(donut?.example || ""));

// carbon_chart: recommend by intent -> a time-series query surfaces LineChart
const chRec = await call("carbon_chart", { intent: "show a trend over time for several series", limit: 4 });
const recLine = (chRec.results || []).some((r) => r.name === "LineChart");
ok(`carbon_chart intent='trend over time' -> mode=${chRec.mode}, ${chRec.count} recs, LineChart=${recLine}`, chRec.mode === "recommend" && chRec.count > 0 && recLine);

// carbon_chart: overview (no args) -> families + 25 charts + setup
const chOv = await call("carbon_chart", {});
ok(`carbon_chart overview -> mode=${chOv.mode}, ${chOv.count} charts, ${chOv.families?.length} families`, chOv.mode === "overview" && chOv.count === 25 && (chOv.families?.length ?? 0) >= 8 && !!chOv.setup?.css);

// robustness: punctuation-only and the bare token 'chart' must NOT dump the whole catalog
const chJunk = await call("carbon_chart", { name: "???" });
const chBare = await call("carbon_chart", { name: "chart" });
ok(`carbon_chart name='???'/'chart' -> ${chJunk.count}/${chBare.count} (must be 0, not 25)`, chJunk.count === 0 && chBare.count === 0);

// setup CSS path must be the exports-map subpath, not the non-exported dist/ path
ok(`carbon_chart setup.css -> ${chOv.setup?.css}`, /@carbon\/charts-react\/styles\.css/.test(chOv.setup?.css || "") && !/dist\/styles/.test(chOv.setup?.css || ""));

// carbon_code_search now covers chart snippets (folded into the corpus + semantic index)
const chCode = await call("carbon_code_search", { query: "stacked bar chart with axes mapsTo", component: "StackedBarChart", limit: 4 });
const fromCharts = (chCode.results || []).some((r) => /charts\/StackedBarChart/.test(r.source));
ok(`carbon_code_search StackedBarChart -> ${chCode.count} (charts corpus: ${fromCharts})`, chCode.count > 0 && fromCharts);

// carbon_list charts -> all chart types enumerated
const lc = await call("carbon_list", { kind: "charts" });
ok(`carbon_list charts -> ${lc.items?.length} charts`, (lc.items?.length ?? 0) === 25);

// ---- branch-coverage assertions: exercise every heterogeneous/conditional
// output-schema branch against a real payload (server safeParses on each call).
const tlAll = await call("carbon_token_lookup", { category: "all" });
ok(`carbon_token_lookup all -> rules + spacing present`, !!tlAll.rules && Array.isArray(tlAll.spacing) && tlAll.spacing.length > 0);

const tlMotion = await call("carbon_token_lookup", { category: "motion" });
ok(`carbon_token_lookup motion -> motion present`, !!tlMotion.motion);

const tlColor = await call("carbon_token_lookup", { category: "color", query: "text-primary" });
const cv0 = tlColor.colorValues?.[0];
ok(`carbon_token_lookup color text-primary -> ${tlColor.colorValues?.length} resolved`, Array.isArray(tlColor.colorValues) && tlColor.colorValues.length > 0 && !!cv0?.token && !!cv0?.theme && "value" in (cv0 ?? {}) && !!cv0?.ref);

const liTokens = await call("carbon_list", { kind: "tokens" });
ok(`carbon_list tokens -> ${liTokens.items?.length} items`, liTokens.items?.length === 5);

const liComponents = await call("carbon_list", { kind: "components" });
ok(`carbon_list components -> ${liComponents.items?.length} items`, liComponents.items?.length === 2);

const liPackages = await call("carbon_list", { kind: "packages" });
ok(`carbon_list packages -> ${liPackages.items?.length} (first: ${liPackages.items?.[0]?.name})`, (liPackages.items?.length ?? 0) > 0 && !!liPackages.items?.[0]?.name);

const chCorr = await call("carbon_chart", { intent: "correlation" });
ok(`carbon_chart intent=correlation -> results[0].score=${chCorr.results?.[0]?.score}`, (chCorr.results?.length ?? 0) > 0 && typeof chCorr.results?.[0]?.score === "number");

// ---- carbon_ai_chat (@carbon/ai-chat) ----
// overview (no args) -> package + setup + PublicConfig fields + response-type names + topics
const acOv = await call("carbon_ai_chat", {});
ok(`carbon_ai_chat overview -> mode=${acOv.mode}, ${acOv.package}@${acOv.version}, ${acOv.count} topics`,
  acOv.mode === "overview" && acOv.package === "@carbon/ai-chat" && acOv.count >= 8 &&
  Array.isArray(acOv.config) && acOv.config.length > 0 && Array.isArray(acOv.responseTypeNames) &&
  acOv.responseTypeNames.includes("user_defined") && !!acOv.setup?.install);

// topic lookup -> messaging guidance carries the customSendMessage snippet
const acMsg = await call("carbon_ai_chat", { topic: "messaging" });
const msgHit = (acMsg.results || []).find((r) => r.topic === "messaging");
ok(`carbon_ai_chat topic=messaging -> mode=${acMsg.mode}, customSendMessage snippet=${/customSendMessage/.test(msgHit?.example || "")}`,
  acMsg.mode === "topic" && !!msgHit && /addMessage/.test(msgHit?.example || "") && typeof msgHit?.score === "number");

// streaming topic surfaces addMessageChunk
const acStream = await call("carbon_ai_chat", { topic: "streaming" });
ok(`carbon_ai_chat topic=streaming -> addMessageChunk present`,
  acStream.mode === "topic" && (acStream.results || []).some((r) => /addMessageChunk/.test(r.example || "")));

// response-type lookup -> user_defined resolves to UserDefinedItem
const acResp = await call("carbon_ai_chat", { responseType: "user_defined" });
const ud = (acResp.results || []).find((r) => r.type === "user_defined");
ok(`carbon_ai_chat responseType=user_defined -> mode=${acResp.mode}, ${ud?.item}`,
  acResp.mode === "response" && ud?.item === "UserDefinedItem" && typeof ud?.score === "number");

// robustness: punctuation-only topic must NOT dump the whole catalog
const acJunk = await call("carbon_ai_chat", { topic: "???" });
ok(`carbon_ai_chat topic='???' -> ${acJunk.count} (must be 0)`, acJunk.mode === "topic" && acJunk.count === 0);

// recall: a plural/superset query must still resolve its topic (findAiChatTopics both-direction fix)
const acPlural = await call("carbon_ai_chat", { topic: "layouts" });
ok(`carbon_ai_chat topic='layouts' -> resolves 'layout'`, acPlural.mode === "topic" && (acPlural.results || []).some((r) => r.topic === "layout"));

// overview surfaces the previously-unreachable instanceApi + antiPatterns + docsBase
ok(`carbon_ai_chat overview -> instanceApi + antiPatterns present`,
  !!acOv.instanceApi && !!acOv.instanceApi["messaging.addMessage"] && Array.isArray(acOv.antiPatterns) && acOv.antiPatterns.length > 0 && !!acOv.docsBase);

// every advertised response_type name must resolve to a detailed entry (no dead names)
const acSystem = await call("carbon_ai_chat", { responseType: "system" });
ok(`carbon_ai_chat responseType=system -> SystemMessageItem`, acSystem.mode === "response" && (acSystem.results || []).some((r) => r.type === "system" && r.item === "SystemMessageItem"));
const allResolve = [];
for (const t of acOv.responseTypeNames) {
  const r = await call("carbon_ai_chat", { responseType: t });
  if (!(r.results || []).some((x) => x.type === t)) allResolve.push(t);
}
ok(`carbon_ai_chat: all ${acOv.responseTypeNames.length} advertised response types resolve (unresolved: ${allResolve.join(",") || "none"})`, allResolve.length === 0);

// fabrication fixes: card uses 'body' not 'items'; connect_to_agent uses CONNECT_TO_HUMAN_AGENT
const acCard = await call("carbon_ai_chat", { responseType: "card" });
const cardEx = (acCard.results || []).find((r) => r.type === "card")?.example || "";
ok(`carbon_ai_chat card example -> uses body, not items`, /body:/.test(cardEx) && !/items:/.test(cardEx));
const acAgent = await call("carbon_ai_chat", { responseType: "connect_to_agent" });
const agentEx = (acAgent.results || []).find((r) => r.type === "connect_to_agent")?.example || "";
// must use the real enum member CONNECT_TO_HUMAN_AGENT (not the fabricated CONNECT_TO_AGENT)
ok(`carbon_ai_chat connect_to_agent -> CONNECT_TO_HUMAN_AGENT enum member`, /MessageResponseTypes\.CONNECT_TO_HUMAN_AGENT/.test(agentEx) && !/MessageResponseTypes\.CONNECT_TO_AGENT\b/.test(agentEx));

// carbon_list ai-chat -> topics enumerated
const lac = await call("carbon_list", { kind: "ai-chat" });
ok(`carbon_list ai-chat -> ${lac.items?.length} topics (first: ${lac.items?.[0]?.name})`,
  (lac.items?.length ?? 0) >= 8 && !!lac.items?.[0]?.name && !!lac.items?.[0]?.desc);

// ---- carbon_labs (@carbon-labs/* experimental incubation) ----
// overview (no args) -> summary + relationToCore + stability warning + ai-chat disambiguation + package list
const lbOv = await call("carbon_labs", {});
ok(`carbon_labs overview -> mode=${lbOv.mode}, ${lbOv.count} packages`,
  lbOv.mode === "overview" && lbOv.count >= 20 && !!lbOv.relationToCore && /0\.x/.test(lbOv.stabilityWarning || "") &&
  Array.isArray(lbOv.disambiguation) && lbOv.disambiguation.some((d) => d.topic === "ai-chat") &&
  Array.isArray(lbOv.results) && lbOv.results.every((r) => !!r.name && !!r.framework && !!r.status));

// name lookup -> 'network graph' resolves the force-directed graph package
const lbNg = await call("carbon_labs", { name: "network graph" });
const ng = (lbNg.results || []).find((r) => r.name === "@carbon-labs/network-graph");
ok(`carbon_labs name='network graph' -> mode=${lbNg.mode}, ${ng?.name} (${ng?.framework})`,
  lbNg.mode === "lookup" && !!ng && ng.framework === "web-component" && /force-directed/i.test(ng.purpose || "") &&
  /npm i @carbon-labs\/network-graph/.test(ng.install || "") && typeof ng.score === "number");

// gap/intent -> 'collapsing header on scroll' surfaces the animated header
const lbGap = await call("carbon_labs", { gap: "collapsing header that animates on scroll", framework: "react" });
const ah = (lbGap.results || []).some((r) => r.name === "@carbon-labs/react-animated-header");
ok(`carbon_labs gap='collapsing header' framework=react -> mode=${lbGap.mode}, ${lbGap.count} recs, animated-header=${ah}`,
  lbGap.mode === "recommend" && lbGap.count > 0 && ah && (lbGap.results || []).every((r) => r.framework === "react"));

// deprecation signal preserved: split-panel is flagged and points to the resizer
const lbDep = await call("carbon_labs", { name: "split panel" });
const sp2 = (lbDep.results || []).find((r) => r.name === "@carbon-labs/react-split-panel");
ok(`carbon_labs split-panel -> deprecated, deprecatedBy=${sp2?.deprecatedBy}`,
  !!sp2 && sp2.status === "deprecated" && /react-resizer/.test(sp2.deprecatedBy || ""));

// robustness: punctuation-only name must NOT dump the catalog
const lbJunk = await call("carbon_labs", { name: "???" });
ok(`carbon_labs name='???' -> ${lbJunk.count} (must be 0)`, lbJunk.mode === "lookup" && lbJunk.count === 0);

// carbon_list labs -> packages enumerated with framework + status
const llabs = await call("carbon_list", { kind: "labs" });
ok(`carbon_list labs -> ${llabs.items?.length} packages (first: ${llabs.items?.[0]?.name})`,
  (llabs.items?.length ?? 0) >= 20 && !!llabs.items?.[0]?.name && !!llabs.items?.[0]?.framework);

// carbon_code_search now covers @carbon/ai-chat snippets (folded into corpus + semantic index)
const acCode = await call("carbon_code_search", { query: "wire a customSendMessage handler to my backend", component: "ai-chat", limit: 5 });
const fromAiChat = (acCode.results || []).some((r) => /ai-chat\//.test(r.source));
ok(`carbon_code_search ai-chat -> ${acCode.count} (ai-chat corpus: ${fromAiChat})`, acCode.count > 0 && fromAiChat);

child.kill();
console.log("\nsmoke complete");
process.exit(0);
