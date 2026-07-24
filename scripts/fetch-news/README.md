# Independent News Pipeline

Zero-cost news ingestion using GitHub Actions + jsDelivr CDN, so the app is not
bottlenecked by Lovable Cloud / Supabase free-tier limits.

## How it works

```
Sources (Supabase news_sources)
        │
        ▼
GitHub Action  (cron */5 min + manual dispatch)
        │
        ├─ fetch RSS/Atom with retry + timeout
        ├─ classify + dedupe (fingerprint = sha1(title||url))
        └─ commit JSON shards to /data
                │
                ▼
      jsDelivr CDN  (global, gzipped, free)
                │
                ▼
      Front-end  (useArticles → fetchFromCdn)
```

## One-time setup

### 1. Connect the Lovable project to GitHub
Plus (+) menu → GitHub → Connect project. Note the resulting `owner/repo`.

### 2. Add GitHub repository secrets
In the GitHub repo → Settings → Secrets and variables → Actions → New repository secret:

| Name | Value |
|------|-------|
| `SUPABASE_URL` | `https://twqwwtgayqhjuyzngejr.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (Backend → Secrets in Lovable) |

### 3. Tell the front-end where the CDN lives
Add to `.env` (or Vercel/Lovable env vars):

```
VITE_CDN_REPO=owner/repo
VITE_CDN_BRANCH=main   # optional, defaults to main
```

### 4. (Optional) Enable admin "Fetch Now" button
Add two backend secrets (Backend → Secrets):

| Name | Value |
|------|-------|
| `GITHUB_REPO` | `owner/repo` |
| `GITHUB_DISPATCH_TOKEN` | fine-grained PAT, Actions: read/write on the repo |

## Data layout

```
data/
  status.json                  # last run, per-language totals, errors
  AR/
    latest.json                # newest 500 AR articles
    by-cat/<category>.json     # per-category shard
    archive/YYYY-Www.json      # weekly append-only archive
  EN/
    latest.json
    by-cat/<category>.json
    archive/YYYY-Www.json
```

## Local test

```
cd scripts/fetch-news
npm install
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node fetch.mjs
```

Then inspect `data/status.json`.
