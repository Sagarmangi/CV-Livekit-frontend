# Codeora Vision — Voice Agent Dashboard

The admin UI for Codeora Vision's LiveKit voice-agent platform. Use it to
configure voice agents (prompt, voice, pronunciation dictionary, tools), connect
and manage Twilio phone numbers on the shared SIP trunk, test an agent live in
the browser, and review call logs.

It is a Next.js 16 (App Router) app backed by Supabase. The voice worker that
actually answers calls lives in the backend repo:
[Sagarmangi/CV-Livekit-backend](https://github.com/Sagarmangi/CV-Livekit-backend).

## Setup

Requires Node.js 20+.

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`. Every value is server-only, and each is documented in
[.env.example](.env.example):

| Variable | What it is |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | Supabase project URL and keys (Settings → API) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Twilio console credentials |
| `TWILIO_SIP_TRUNK_SID` | The one shared Elastic SIP Trunk (`TK…`) |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | The LiveKit server, same key pair as the backend |
| `WIDGET_DAILY_CAP`, `MAX_CONCURRENT_CALLS` | Optional limits on the public web widget (defaults 200/day and 3 live calls) |

There is no public sign-up. To give someone access, create them in Supabase
Auth and add them to the `allowed_users` table.

## Development

```bash
npm run dev     # http://localhost:3000
npm run build   # production build
npm run start   # serve the production build
npm run lint
```

The in-browser agent test dispatches the `codeora-inbound-agent` worker and
listens on the `codeora.diagnostic` text-stream topic. Both names must match
the backend.

## Web widget

Each agent can be embedded on a customer's site as a floating voice widget:

```html
<script src="https://voice.codeoravision.com/widget.js" data-key="wk_…" async></script>
```

Turn it on per agent under its **Web widget** tab, add the site's origin to the
allowed list, and copy the snippet from there. `public/widget.js` renders the
launcher and opens an iframe onto `/widget/<key>`, which asks
`/api/widget/session` for a LiveKit token. That route checks the key, the
embedding origin, per-IP and per-day limits and the live-call cap before
dispatching the worker.
