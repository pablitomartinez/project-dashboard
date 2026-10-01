<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project Dashboard — Agent Guidelines

## Source of truth

Before implementing changes, read the relevant project documentation:

- `docs/PRODUCT.md` defines the V1 product scope.
- `docs/ARCHITECTURE.md` defines the current architecture and data model.
- `docs/ROADMAP.md` tracks implementation progress.

If a requested change conflicts with these documents, do not silently expand the scope.

## V1 scope discipline

The priority is to finish and deploy V1.

Do not implement features listed under "Fuera del alcance de V1" or "Después de V1" unless explicitly requested.

Prefer the simplest implementation that satisfies the current requirement.

Do not introduce unnecessary dependencies, abstractions, state-management libraries, or infrastructure.

## Working rules

- Do not work directly on `main` when implementing features.
- Keep changes focused on the requested task.
- Do not refactor unrelated code.
- Preserve existing behavior unless the task requires changing it.
- Never commit secrets, passwords, tokens, API keys, or real credentials.
- Use environment variables for configuration that must remain private.
- Update project documentation when a change makes it inaccurate.

## Verification

Before considering an implementation complete:

1. Review the resulting diff.
2. Run the relevant lint checks.
3. Run the production build when appropriate.
4. Report any warnings, failures, or unverified behavior.
5. Clearly summarize what changed and what remains pending.

Do not claim something works unless it was actually verified.

<!-- END:nextjs-agent-rules -->
