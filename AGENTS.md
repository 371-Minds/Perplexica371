# AGENTS.md

Use `CONTRIBUTING.md` as the primary contributor reference.

## Project map

- `src/app`: Next.js app routes, pages, and API route handlers
- `src/components`: reusable UI components
- `src/lib`: search agents, models, prompts, database code, uploads, and integrations
- `docs/architecture`: architecture and request-flow documentation
- `akash.yaml`: Akash deployment manifest for the bundled container image

## Local workflow

1. Install dependencies with `npm install`.
2. Start the app locally with `npm run dev`.
3. Validate with `npm run build` and `npm run lint` when the environment supports them.
4. Keep `README.md`, `AGENTS.md`, Docker files, and `akash.yaml` aligned when deployment behavior changes.

## Change guidance

- Prefer small, focused changes that match the existing structure.
- This fork periodically pulls changes from upstream `ItzCrazyKns/Vane`; preserve fork-specific integrations unless the task says otherwise.
- Update the nearest relevant documentation when behavior or developer workflows change.
- If you are unsure where to make a change, start with `CONTRIBUTING.md`.
