# Deploying the dashboard

The dashboard deploys itself: a push to `main` that passes CI builds a
standalone bundle on GitHub Actions, uploads it to the server over SSH and
switches to it with a health check and automatic rollback. This file is the
server side of that: what has to exist on the box, once, by hand.

## How a deploy works

1. `.github/workflows/ci.yml` runs on every push and pull request: `npm ci`,
   lint, `tsc --noEmit`, `next build` -- all with placeholder environment
   values, because nothing in this app needs a secret at build time.
2. When CI passes on `main`, `.github/workflows/deploy.yml` checks out that
   same commit, runs `next build` (with `output: "standalone"`, so Next emits
   `.next/standalone/server.js` and only the `node_modules` it traced) and
   assembles a release directory:

   ```
   release/
     server.js            the standalone server
     node_modules/        only what server.js needs
     .next/               the build, plus .next/static copied in
     public/              copied in (widget.js, logos, …)
     deploy-dashboard.sh  copy of scripts/deploy-dashboard.sh
     RELEASE              the git SHA
   ```

   Next leaves `public/` and `.next/static` out of the standalone folder on
   purpose (they're candidates for a CDN); copied in next to `server.js` it
   serves them itself.
3. The release is rsynced to `/opt/codeora/dashboard-releases/<sha>/`.
4. `deploy-dashboard.sh <sha>` runs on the server. It links the release's
   `.env.local` to `/opt/codeora/dashboard/.env.local`, repoints the
   `current` symlink atomically, restarts `codeora-dashboard`, and waits up
   to 30 s for `GET http://127.0.0.1:3001/login` to return 200. If it does,
   all but the three newest releases are deleted. If it doesn't, `current`
   goes back to the previous release, the service restarts again, the last
   40 journal lines are printed and the job fails.

Deploys run one at a time (`concurrency: deploy-dashboard`) and a running one
is never cancelled.

## GitHub secrets

| Secret | Value |
| --- | --- |
| `DEPLOY_HOST` | The server's hostname or IP. |
| `DEPLOY_USER` | The SSH user the workflow connects as (see below). |
| `SSH_PRIVATE_KEY` | A private key whose public half is in that user's `~/.ssh/authorized_keys`. Make one just for this: `ssh-keygen -t ed25519 -C codeora-dashboard-deploy -f deploy_key`. |
| `SSH_KNOWN_HOSTS` | The server's host key line(s): `ssh-keyscan -H <host>`. Pins the host so the workflow can't be redirected elsewhere. |

The app's own environment is **not** a GitHub secret. It lives on the server
in `/opt/codeora/dashboard/.env.local` and is never part of a release or of
the repository.

## Server setup (once)

Node 22 is expected at `/opt/node22/bin/node`; the app runs as the `codeora`
user. The simplest arrangement is for `DEPLOY_USER` to *be* `codeora`, so
uploaded files are already owned by the user that runs them. The steps below
assume that; if you use a separate deploy user, give it write access to
`/opt/codeora/dashboard-releases` and make sure `codeora` can read the files
(the workflow uploads them world-readable, `D755,F644`).

```bash
# Directories
sudo mkdir -p /opt/codeora/dashboard /opt/codeora/dashboard-releases
sudo chown -R codeora:codeora /opt/codeora

# The one real env file, outside every release. Fill it from .env.example.
sudo -u codeora install -m 600 /dev/null /opt/codeora/dashboard/.env.local
sudoedit -u codeora /opt/codeora/dashboard/.env.local
```

### Passwordless sudo for the deploy user

`deploy-dashboard.sh` restarts the unit and reads its journal through
`sudo`. Grant exactly those two commands and nothing else:

```
# /etc/sudoers.d/codeora-dashboard-deploy  (install with visudo -f)
codeora ALL=(root) NOPASSWD: /usr/bin/systemctl restart codeora-dashboard, /usr/bin/journalctl -u codeora-dashboard *
```

(Replace `codeora` with `DEPLOY_USER` if they differ. Check the binary paths
with `command -v systemctl journalctl`.)

### systemd unit

`/etc/systemd/system/codeora-dashboard.service`:

```ini
[Unit]
Description=Codeora Vision voice agent dashboard
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=codeora
Group=codeora
# `current` is a symlink that the deploy script repoints atomically; the unit
# never has to change between releases.
WorkingDirectory=/opt/codeora/dashboard-releases/current
ExecStart=/opt/node22/bin/node server.js
Environment=PORT=3001
Environment=HOSTNAME=127.0.0.1
Environment=NODE_ENV=production
Restart=always
RestartSec=2
# The reverse proxy in front of this (nginx/Caddy) is what the public reaches;
# the app only listens on loopback.

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable codeora-dashboard
```

Don't start it yet: there is no `current` until the first deploy has run.
The first push to `main` after this setup creates it. (If you'd rather not
wait for a push, build locally, rsync a release to
`/opt/codeora/dashboard-releases/<any-sha>/` and run `deploy-dashboard.sh`
from it.)

**Why the `.env.local` symlink:** Next's standalone `server.js` changes into
its own directory on start and loads `.env.local` from there. The real file
has to stay in one place outside the releases, so the deploy script drops a
symlink to it inside each release. `WorkingDirectory=…/current` is what makes
that directory the one Next reads.

### Reverse proxy

Whatever fronts port 3001 must pass `X-Forwarded-For` (the widget's per-IP
limit reads it) and `Host`/`X-Forwarded-Host` (the widget session route
compares them to tell its own iframe page from a cross-origin caller).
WebSocket traffic goes to LiveKit, not here, so no upgrade handling is
needed.

## Day to day

| Task | How |
| --- | --- |
| Deploy | Merge or push to `main`. Watch the **Deploy** workflow. |
| See what's live | `cat /opt/codeora/dashboard-releases/current/RELEASE` |
| Logs | `sudo journalctl -u codeora-dashboard -f` |
| Roll back by hand | `bash /opt/codeora/dashboard-releases/<older-sha>/deploy-dashboard.sh <older-sha>` -- any of the three kept releases. |
| Change the env | Edit `/opt/codeora/dashboard/.env.local`, then `sudo systemctl restart codeora-dashboard`. Provider keys can also be set from the Integrations page, which stores them in Supabase. |
| Re-run a deploy | Re-run the Deploy workflow from the Actions tab. It rebuilds the same commit. |

## If a deploy fails

The job output ends with the last 40 journal lines from the server and the
service is back on the previous release. The failed release directory is
left in place for inspection. The usual causes:

- `.env.local` missing or incomplete -- `/login` returns 500, the health
  check never sees 200.
- Port 3001 held by something else.
- A migration the new code expects hasn't been applied to Supabase yet.
