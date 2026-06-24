# IBM Carbon for Claude

Tooling that helps Claude build and review application UIs with the IBM Carbon Design System: a local
MCP server that serves Carbon facts, a Claude Code agent that builds Carbon UIs, and two Claude skills.

## Components

- **MCP server** (`carbon-context-mcp/`): a local, offline MCP server exposing 9 read-only tools for Carbon
  docs, design tokens, component APIs, `@carbon/charts`, and `@carbon/ai-chat`, over a bundled corpus.
  Full details in [`carbon-context-mcp/README.md`](carbon-context-mcp/README.md).
- **Agent** (`agents/carbon-design-engineer.md`): a Claude Code subagent that builds and reviews
  Carbon application interfaces (tokens, the 2x Grid, IBM Plex, four-theme support, WCAG 2.1 AA).
- **Skills** (`skills/`):
  - `carbon-design-system/`: guidance and a reference pack for building idiomatic Carbon.
  - `multi-agent-audit/`: a process skill that fans out adversarial reviewers to catch fabricated APIs
    and other defects before merge.

### How they fit together

The agent and the `carbon-design-system` skill carry the design judgment. The MCP server provides the
facts (exact token values, component APIs, chart and AI-chat specs). When the MCP is registered, the
agent and skill prefer its `mcp__carbon__*` tools for authoritative lookups and fall back to the
bundled reference pack when it isn't present.

## Quickstart

```bash
git clone <repo-url> ibm-carbon
cd ibm-carbon

# 1. Register the agent and skills with Claude Code (creates symlinks under ~/.claude).
./link-into-claude.sh           # ./link-into-claude.sh --check to preview, --unlink to remove

# 2. Build and register the MCP server.
cd carbon-context-mcp
npm install
npm run build
claude mcp add carbon -- node /ABSOLUTE/PATH/TO/ibm-carbon/carbon-context-mcp/dist/index.js
```

`link-into-claude.sh` is idempotent and refuses to clobber existing real files. The MCP is optional;
the agent and skill work from the reference pack without it. See
[`carbon-context-mcp/README.md`](carbon-context-mcp/README.md) for project-scoped registration, the `.mcpb` Claude
Desktop extension, and rebuilding the corpus.

## Repo layout

```
ibm-carbon/
├── agents/
│   └── carbon-design-engineer.md     # Claude Code agent
├── skills/
│   ├── carbon-design-system/         # Carbon build/review skill + reference pack
│   └── multi-agent-audit/            # adversarial review process skill
├── carbon-context-mcp/               # local MCP server (see its README)
├── link-into-claude.sh               # register agent + skills with Claude Code
└── README.md
```

## Disclaimer

This is an unofficial, community project. It is not affiliated with, endorsed by, sponsored by, or
supported by IBM. The bundled MCP server is distinct from IBM's official
[Carbon MCP](https://carbondesignsystem.com/developing/carbon-mcp/overview/).

IBM and Carbon are trademarks of International Business Machines Corporation, registered in many
jurisdictions worldwide. "IBM Carbon", "Carbon Design System", and "IBM Plex" are likewise IBM
trademarks. They are used here only to describe what this tooling is compatible with, not to imply
any endorsement.

## License

Apache-2.0 for this project's original code. See [`LICENSE`](LICENSE).

This repository also bundles and derives from third-party material (IBM Carbon sources and
documentation, and the `all-MiniLM-L6-v2` model), all under Apache-2.0. See [`NOTICE`](NOTICE) and
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for attribution and the modifications made.
