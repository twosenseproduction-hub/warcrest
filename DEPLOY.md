# Deploy Warcrest (separate from Sift)

This game runs as its **own Fly.io app** — it does not share the `sift-twosense`
Docker image, database, or deploy pipeline.

| | Main Sift | Warcrest |
|---|-----------|----------|
| Fly app | `sift-twosense` | `exofront-game` |
| URL | `app.siftnow.io` | `exofront.siftnow.io` |
| Stack | Node + SQLite | nginx + static files |

## One-time setup

```bash
cd warcrest   # repo root after git clone

# Create the Fly app (skip if already created)
fly launch --copy-config --no-deploy --name exofront-game --region sjc

# Attach custom subdomain (run once; follow DNS instructions Fly prints)
fly certs add exofront.siftnow.io
```

Add DNS in Google Domains / Squarespace (where `siftnow.io` is managed). Either:

**Option A — CNAME** (matches `app.siftnow.io` pattern):
```
exofront  CNAME  ke1jj9o.exofront-game.fly.dev
```

**Option B — A + AAAA** (Fly’s recommended):
```
exofront  A     66.241.124.132
exofront  AAAA  2a09:8280:1::126:4ae7:0
```

Then verify: `fly certs check exofront.siftnow.io -a exofront-game`

## Deploy / update

```bash
cd warcrest
fly deploy
```

## Verify

```bash
fly status
fly logs
open https://exofront.siftnow.io
# or before DNS: https://exofront-game.fly.dev
```

## Local preview

```bash
cd warcrest
python3 -m http.server 8080
open http://localhost:8080
```
