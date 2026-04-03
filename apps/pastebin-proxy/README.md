# pastebin-proxy

Tiny proxy service for creating and reading Pastebin pastes without exposing API keys in the planner frontend.

## Environment

- `PASTEBIN_DEV_KEY` (required): your Pastebin API dev key
- `PORT` (optional): default `8787`
- `HOST` (optional): default `127.0.0.1`

## Run

```bash
pnpm --filter pastebin-proxy dev
```

Health check:

```bash
curl http://127.0.0.1:8787/health
```

## Endpoints

- `POST /api/pastebin/create`
  - body: `{ "content": "...json...", "title": "optional" }`
  - returns: `{ "key", "url", "rawUrl" }`

- `GET /api/pastebin/raw/:key`
  - returns: `{ "key", "raw" }`

- `GET /api/pastebin/raw?url=https://pastebin.com/...`
  - returns: `{ "key", "raw" }`
