# Tradestack Marketing Agent
AI-powered organic social-media marketing agent for small businesses.
Navy / Gold / Red / White brand. Local-first, zero-cost, GitHub-Pages hostable.

## What is REAL vs MANUAL (honest capability matrix)
| Platform   | Connect            | Auto-publish | Why / alternative                                   |
|------------|--------------------|--------------|-----------------------------------------------------|
| Facebook   | Official Meta OAuth| YES (text/link posts to Pages) | Official Graph API via FB SDK |
| Instagram  | Official Meta OAuth| NO (API requires hosted media URL + IG Business) | Manual publish assistant + reminders |
| LinkedIn   | Token paste        | NO (API blocks browser CORS)   | Manual assistant + copy/export |
| X          | —                  | NO (OAuth1 secrets unsafe in browser) | Manual assistant |
| TikTok / YouTube / Pinterest | — | NO | Manual assistant with deep-links |
| WhatsApp   | —                  | NO (anti-spam) | Click-to-WhatsApp CTA builder only |
We NEVER store social passwords, scrape, bot, or bypass platform limits.

## Run locally
1. Save all files keeping structure. Put supplied logo at assets/logo.png
2. `python3 -m http.server 8000` → open http://localhost:8000
## Deploy free (GitHub Pages)
Upload folder to a repo → Settings → Pages → Deploy from branch → main. Done.

## Optional: local AI (free)
Install Ollama (ollama.com), `ollama pull llama3.1`, then run:
`OLLAMA_ORIGINS=* ollama serve`  → set provider in Settings → AI.
App falls back to the built-in offline rules engine automatically when AI is unreachable.

## Optional: Meta publishing
Create a free Meta App (developers.facebook.com) → add "Facebook Login for Web" →
add your Pages URL (GitHub Pages URL) → copy App ID into Settings → Integrations.
Connect accounts in "Social Accounts". Tokens are AES-GCM encrypted at rest.

## Security
Passcode → PBKDF2(120k) hash; secrets encrypted AES-256-GCM with derived key;
org-scoped data isolation; audit log; no secrets in frontend code; no demo data.

## Tests
Open tests.html in the browser (runs unit tests for compliance, hashtags,
similarity, best-times blending, plan generation).

## Legal
AI content requires human review. You are responsible for claims you publish.
Platform APIs change; growth is never guaranteed. See Help screen.
