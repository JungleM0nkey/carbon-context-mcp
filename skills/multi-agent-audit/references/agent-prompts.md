# Audit prompt templates

Copy/adapt these. Replace `{{SCOPE}}`, `{{ROOT}}`, `{{GROUND_TRUTH}}`, `{{LIBRARY@VERSION}}` etc.
Dispatch the agents in a single message so they run in parallel.

---

## The master prompt (context-engineered)

This is the improved version of the bare *"perform another review pass using multiple agents… look
for gaps, mock code, bugs, technical debt, incorrect assumed and/or guessed solutioning"* request.
The upgrades: explicit **objective + scope**, a stated **ground-truth source**, a **role**, a
**method**, a hard **output contract**, and **guardrails** (default-skeptical, report-only).

> Run an **adversarial multi-agent audit** of `{{SCOPE}}` (default: the diff since `{{REF}}`, or the
> most recently added capability). Fan out **3+ independent reviewers in parallel**, each with a
> distinct lens: (1) **ground-truth verifier**, (2) **runtime/logic auditor**, (3)
> **consistency/packaging auditor**.
>
> **Method.** Use semantic codebase search (warpgrep / morph `codebase_search`) to map flows, and
> **authoritative source** — the real upstream code at `{{LIBRARY@VERSION}}`, official docs, the type
> definitions — to verify every *concrete* claim. Do not trust memory or research summaries.
>
> **Hunt specifically for:** fabricated or guessed APIs/shapes/enum-members/signatures; assumed
> behavior; mock/stub/placeholder/dead code; logic bugs and unhandled edges; technical debt; and drift
> (stale counts, out-of-sync copies, advertised-but-unresolvable surface, uncovered new branches).
>
> **Output contract — every agent must:** cite `source:line` (local) or `file·symbol` (upstream) for
> each finding; classify severity **CRITICAL / HIGH / MEDIUM / LOW / NIT**; keep **CONFIRMED** separate
> from **UNVERIFIABLE**; include a short "verified-correct / no action" section; and **REPORT ONLY — do
> not edit any file.**
>
> **Stance:** default-skeptical. Treat any unverified concrete claim as **wrong until proven against
> source**. Plausibility is not evidence. Member/enum names are NOT just the uppercased string value —
> read the actual declaration.
>
> Return a triaged findings list. I will verify-before-fix.

---

## Template 1 — Ground-truth verifier (highest value for "guessed solutioning")

> You are a skeptical API auditor hunting **fabricated / guessed** facts in `{{TARGET_FILE_OR_SCOPE}}`,
> which describes/uses `{{LIBRARY@VERSION}}`. Any invented name, wrong enum member, or non-existent
> shape is a **CRITICAL** bug — this artifact emits code/facts to others. Assume claims are wrong until
> the real source proves them right; a prior research summary is NOT proof.
>
> **Ground truth** = the real source at `{{UPSTREAM_REPO@REF}}`. Read the actual `.ts`/`.py`/`.go`
> type/decl files. Tools: `gh api repos/{{OWNER_REPO}}/contents/<path> -H "Accept: application/vnd.github.raw"`,
> WebFetch on raw.githubusercontent.com, and `github_codebase_search`. Cross-check ≥2 files.
>
> Read `{{TARGET_FILE_OR_SCOPE}}` first. Then VERIFY each concrete claim it makes — names, enum
> members AND their string values, field shapes, function signatures, config keys, import paths,
> version/peer-deps, and **every example code block** (do its fields/methods exist?).
>
> For each claim emit a row: **CLAIM | VERDICT (CONFIRMED/WRONG/UNVERIFIABLE) | source `file·symbol`**.
> Then a clearly-labeled **FABRICATIONS** list (the WRONG rows) with the corrected shape, and an
> **UNVERIFIABLE** list. Be exhaustive — this table is the deliverable. **Do not edit any file.**

## Template 2 — Runtime / logic auditor

> Audit the code of `{{ROOT}}` for real bugs, dead code, technical debt, edge cases, and
> incorrect/guessed logic. Focus on `{{RECENT_SCOPE}}` but review holistically.
>
> Read `{{KEY_FILES}}` fully; use morph `codebase_search` (repo_path `{{ROOT}}`) to trace flows. **Run
> the build/typecheck and the test/smoke suite and report actual results** (e.g. `{{BUILD_CMD}}`,
> `{{TEST_CMD}}`).
>
> Scrutinize: control-flow/precedence in new handlers; null/empty/punctuation edge cases (trace them,
> don't assume); off-by-one; output-schema correctness (too strict → runtime throw, too loose → junk
> accepted) given any per-call validation; symmetry with sibling/established code; dead branches; unused
> exports; resource/dup-key issues. For libraries/APIs, flag any usage that contradicts the real
> contract.
>
> Output findings grouped **CRITICAL / HIGH / MEDIUM / LOW / NIT**, each with `file:line`, the concrete
> problem, and a recommended fix. Add a "looks correct / no action" section listing what you verified is
> fine (so I know coverage). **Report only — do not edit.**

## Template 3 — Consistency / packaging auditor

> Audit `{{ROOT}}` for **drift, sync, and coverage gaps** after `{{CHANGE_SUMMARY}}`. Use Read/Grep/Glob/
> Bash; report exact `file:line` for each item as **PASS** or a specific **FAIL + fix**.
>
> Check: (1) count drift — anything still saying the old number of tools/items/etc.; (2) manifests/
> registries list the new surface with accurate names matching the implementation; (3) duplicated files
> are byte-identical across their locations (`diff` them); (4) bundle/ignore rules still ship what must
> ship and exclude build-only inputs; (5) tests/smoke cover every new branch (enumerate any uncovered);
> (6) docs/README/eval numbers and tables match reality; (7) advertised surface is fully resolvable (no
> "lists X but X returns nothing"); (8) anything generated isn't accidentally hand-edited or vice-versa.
>
> Output a checklist, each PASS or FAIL-with-fix. **Report only — do not edit.**

---

## Optional add-ons for "be thorough / exhaustive"

- **Second ground-truth verifier** on a *different* authoritative source (official docs vs raw source),
  to catch single-source errors.
- **Completeness critic:** *"Given the audit so far, list every concrete claim, branch, file, or
  external dependency that was NOT verified, ranked by risk. Propose the next checks. Do not re-report
  known findings."* What it surfaces becomes the next round.
- **Adversarial re-verify of fixes:** after fixing, run the ground-truth verifier once more against only
  the changed lines.
