# AGENTS.md

This repository already has contributor guidance in `/CONTRIBUTING.md`. Use that file as the primary reference when making code changes.

## Project map

- `src/app`: Next.js app routes, pages, and API route handlers
- `src/components`: reusable UI components
- `src/lib`: search agents, models, prompts, database code, uploads, and integrations
- `docs/architecture`: high-level architecture and request flow documentation

## Local workflow

1. Install dependencies with `npm install`.
2. Start the app locally with `npm run dev`.
3. Use `npm run build` and `npm run lint` for repository validation when the environment supports them.

## Change guidance

- Prefer small, focused changes that match the existing structure.
- Update the nearest relevant documentation when behavior or developer workflows change.
- If you are unsure where to make a change, start with `/CONTRIBUTING.md`.
