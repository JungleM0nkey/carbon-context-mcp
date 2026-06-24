---
name: multi-agent-audit
description: >
  Use for any review/audit pass — "do another review pass", "audit this before I ship", "look for
  bugs / gaps / mock code / tech debt", and especially "find any guessed or assumed solutioning /
  fabricated APIs". Runs a fan-out of parallel, adversarial reviewers that VERIFY every concrete
  claim against authoritative source, triage findings by severity, then verify-before-fix. Reach for
  it after building or changing a feature and before merging/delivering, or whenever you want an
  independent second look that is hard to fool. Process skill — follow the phases in order.
---

# Multi-Agent Audit

A way to find what's actually wrong with recent work: fan out independent reviewers with distinct
lenses, make each one cite authoritative source for every claim, triage by severity, and verify each
fix before applying it. It targets the failure mode that generic review misses: plausible-but-fabricated
"guessed solutioning" (invented API shapes, assumed behavior, mock code left in) that looks right and
reads right but does not exist in the real source.

The load-bearing idea: a single reviewer (or the author) rationalizes. N skeptical reviewers, each
forced to ground claims in source and to separate CONFIRMED from UNVERIFIABLE, do not.

## When to use

- After completing a feature/capability, before merge or delivery ("review pass").
- When integrating a third-party library/API and you wrote example/config code from memory or a summary.
- When the user says: audit, second look, find bugs/gaps/tech debt/mock code, or "did we guess anything".
- Before trusting any artifact that *emits code or facts to others* (an MCP catalog, codegen, docs, a schema).

If the change is a trivial one-line mechanical edit, skip this; it's for substantive work.

## Context-engineering patterns this skill applies

You don't need to memorize these, but they're why the steps below are shaped this way:

| Pattern | How it shows up here |
|---|---|
| **Role / persona** | Each agent gets a sharp, skeptical persona ("you are auditing for fabrications"). |
| **Decomposition + diverse lenses** | Reviewers split by concern (ground-truth / logic / consistency), not by file. |
| **Grounding (cite-or-it-didn't-happen)** | Every finding must carry a `source:line` or upstream `file·symbol` citation. |
| **Adversarial / default-skeptical** | "Assume WRONG until proven against source." Plausibility is not evidence. |
| **Structured output contract** | Fixed severity taxonomy + a verdict table (CONFIRMED / WRONG / UNVERIFIABLE). |
| **Separation of phases** | find → verify → fix are distinct; auditors report only, never edit. |
| **Verify-before-fix** | Re-ground each fix in source so you don't patch one guess with another. |
| **Completeness critic** | A final "what did we NOT check?" pass before declaring done. |

## The workflow (turn each phase into todos)

### Phase 0 — Scope and ground rules (you, ~2 min)
1. Name the **scope**: default to the most recently added/changed capability, but state the blast radius
   (which files, which data, which external library + version). Highest-risk = newest + anything that
   emits code/facts to others.
2. Pin the **ground truth**: what is authoritative for this scope? (real upstream source at a specific
   ref/version, official docs, the type definitions — not a model's memory or a research summary).
3. State the **non-goals**: auditors report only; no edits during the audit.

### Phase 1 — Cheap self-scan first (you, before spawning anyone)
Run the mechanical sweeps yourself; they're fast and focus the agents:
- Debt/mock markers: grep for `TODO|FIXME|HACK|XXX|placeholder|mock|stub|dummy|as any|@ts-ignore|@ts-nocheck|z\.any\(|console\.log|NotImplemented|throw new Error\("not`.
- Size/shape: line counts, new exports, new public surface.
- Use **semantic codebase search** (morph `codebase_search` / warpgrep via airis) to map the new flow:
  *"trace how <new feature> loads its data, validates output, and is exercised by tests"*.
Note what you find — it seeds the agent prompts and prevents them re-discovering the obvious.

### Phase 2 — Fan out parallel reviewers (the core)
Dispatch **3+ agents in one message** (so they run concurrently), each a distinct lens. Use the
ready-made templates in `references/agent-prompts.md`. The default trio:

1. **Ground-truth verifier** (the most valuable for "guessed solutioning"). Re-checks every *concrete*
   claim — API names, enum members, field shapes, signatures, config keys, example code — against the
   real upstream source via `gh api` / WebFetch / `github_codebase_search`. Output: a CONFIRMED /
   WRONG / UNVERIFIABLE table with a `file·symbol` citation per row, then an explicit "fabrications"
   list. Tell it: member/enum names ≠ uppercased string values; assume wrong until the source proves it.
2. **Runtime / logic auditor.** Reads the code (+ semantic search) for real bugs, dead code, unhandled
   nulls/edges, off-by-one, schema-too-strict/too-loose, type-safety gaps, and inconsistency with sibling
   code. Must run the build/typecheck and tests and report actual results. Severity-tagged. Report only.
3. **Consistency / packaging auditor.** Drift and coverage: stale counts, out-of-sync copies, missing
   test/smoke coverage for new branches, manifest/docs/eval mismatch, things advertised but not resolvable.

Scale the fan-out to the ask: a quick check = the trio with single-pass verification; "be thorough /
exhaustive" = add a 2nd ground-truth verifier on a different source, and a **completeness critic** whose
only job is to list what was *not* verified.

Every agent prompt must demand: (a) a citation per finding, (b) the severity taxonomy below, (c)
CONFIRMED vs UNVERIFIABLE separated, (d) report only — do not edit, (e) a short "verified-correct /
no action" section so you know what was actually checked vs skipped.

### Phase 3 — Triage (you)
Collect results. De-dupe across agents. Sort into the taxonomy. For each item decide: fix now / fix
later / won't-fix (with reason). Treat any UNVERIFIABLE concrete claim as a finding, not a pass.

### Phase 4 — Verify-before-fix, then lock it (you)
For each fix:
1. **Re-ground it.** Pull the exact source/symbol again before editing — don't fix a guess with another
   guess. (This is where you catch "the corrected shape was also wrong".)
2. Apply the minimal idiomatic edit.
3. **Add a regression lock**: a test/smoke assertion that would have caught the bug, so it can't silently
   return.
4. Rebuild/re-typecheck/re-run tests; re-verify clean.
5. Update any memory/changelog with what was fabricated/fixed and the source you verified against.

## Severity taxonomy (use these exact labels)

- **CRITICAL** — wrong/fabricated output, crash, security exposure, data loss. (Fabricated API that
  emits broken code lives here.)
- **HIGH** — real bug with a plausible trigger; recall/correctness hole.
- **MEDIUM** — completeness gap, advertised-but-unresolvable, dead data, weak validation.
- **LOW** — consistency nit, mild mis-rank, missing guard that's currently harmless.
- **NIT** — cosmetic, naming, redundant code.

## Red flags — stop and run the audit properly

| Thought | Reality |
|---|---|
| "The research agent said it's verified." | A summary is not source. The verifier re-reads source itself. |
| "This API shape looks right." | Plausibility ≠ existence. Cite `file·symbol` or it's UNVERIFIABLE. |
| "One reviewer is enough." | One reviewer rationalizes. Diverse lenses catch what one misses. |
| "I'll just fix as I find." | Auditing and fixing in one pass hides findings and skips verification. |
| "No findings, so it's clean." | Did you check what was *not* covered? Run the completeness critic. |
| "The fix is obvious." | Re-ground it anyway — fixing a guess with a guess is the classic trap. |

## Worked example

Building an MCP catalog for `@carbon/ai-chat`, three research agents "verified" the API. The audit's
ground-truth verifier still caught two fabrications by re-reading the actual `.ts` source:
`MessageResponseTypes.CONNECT_TO_AGENT` does not exist (the member is `CONNECT_TO_HUMAN_AGENT`;
member names ≠ uppercased string values), and `CardItem` used an invented `items` field (real shape is
`body` + `footer`). Both would have emitted broken code. The fix phase then pulled the real enum and
interfaces again before editing, and added smoke assertions locking both.

## Reusable prompt

An upgrade of the bare "do a review pass" request, plus the three agent-dispatch templates, live in
**`references/agent-prompts.md`**. Read it when you spin up the agents.
