# Perplexica371 🔍

Perplexica371 is the 371 Minds fork of the upstream [Vane](https://github.com/ItzCrazyKns/Vane) project (formerly Perplexica). This branch now tracks the latest upstream updates while keeping fork-specific integrations and deployment notes in place.

![preview](.assets/vane-screenshot.png)

## ✨ Features

- Support for local and hosted AI providers, including Ollama, OpenAI, Claude, Gemini, Groq, and more
- Multiple search modes for fast answers or deeper research
- Web, discussion, academic, image, and video search flows
- File uploads for document question answering
- Widgets for weather, stocks, calculations, and other structured results
- Locally stored search history and configurable provider settings

## Installation

### Docker

Run the bundled image with the embedded SearXNG instance:

```bash
docker run -d -p 3000:3000 -v vane-data:/home/vane/data --name vane itzcrazykns1337/vane:latest
```

If you already run SearXNG separately, use the slim image instead:

```bash
docker run -d -p 3000:3000 -e SEARXNG_API_URL=http://your-searxng-url:8080 -v vane-data:/home/vane/data --name vane itzcrazykns1337/vane:slim-latest
```

### Local development

```bash
npm install
npm run dev
```

For production-style validation, use:

```bash
npm run build
npm run lint
```

## Akash deployment

This repository now includes `akash.yaml`, a starter Akash SDL for running the bundled container with a persistent `/home/vane/data` volume.

1. Publish the image you want Akash to run, or swap the image reference in `akash.yaml` to a registry you control.
2. Adjust the compute, storage, and pricing values for your Akash provider.
3. Deploy with the Akash CLI:

```bash
provider-services tx deployment create akash.yaml --from <key-name>
```

## Architecture and docs

- Contributor guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Architecture overview: [docs/architecture/README.md](docs/architecture/README.md)
- Search API docs: [docs/API/SEARCH.md](docs/API/SEARCH.md)
- Update notes: [docs/installation/UPDATING.md](docs/installation/UPDATING.md)

## Contribution

If you want to contribute, start with [CONTRIBUTING.md](CONTRIBUTING.md). Keep deployment-facing changes in sync across the Docker files, `README.md`, `AGENTS.md`, and `akash.yaml`.
