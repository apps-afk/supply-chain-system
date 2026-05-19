# Supabase Setup — Initial Estate Supply Chain

This app works in 2 modes:
- **In-memory (default)** — no setup needed, but data resets when the Vercel function goes cold (~5 min idle).
- **Supabase-backed** — persistent users, settings, and DSAR queue. Recommended for real use.

To switch on Supabase, follow these 4 steps. Takes ~5 minutes.

## 1. Create a Supabase project

1. Go to **<https://supabase.com>** → Sign up (free tier is enough).
2. Click **New project**:
   - Name: `initial-estate` (or anything)
   - Database password: pick something strong, save it
   - Region: `Southeast Asia (Singapore)` for lowest latency
3. Wait ~1 minute for the project to provision.

## 2. Create the database tables

1. In your Supabase project → left sidebar → **SQL Editor**.
2. Click **New query**.
3. Open `supabase/schema.sql` in this repo, copy ALL of it, paste into the SQL editor.
4. Click **Run** (or `Ctrl+Enter`).
5. You should see **Success. No rows returned**. The `users`, `workspace_settings`, `dsar_requests`, `forgot_password_queue`, and `audit_log` tables now exist.

## 3. Grab your project credentials

1. Left sidebar → **Settings** (gear icon) → **API**.
2. Copy these 2 values:

   | What | Where | Variable name |
   |------|-------|---------------|
   | **Project URL** | "Project URL" box | `NEXT_PUBLIC_SUPABASE_URL` |
   | **service_role secret** | "Project API keys" → **service_role** (click "Reveal") | `SUPABASE_SERVICE_KEY` |

   > ⚠ Use the **service_role** key, NOT the anon key. The server needs to write to the DB without going through Row Level Security. Never expose this key to the browser.

## 4. Add the env vars to Vercel

1. Vercel project → **Settings** → **Environment Variables**.
2. Add both:

   ```
   NEXT_PUBLIC_SUPABASE_URL  = https://xxxxxxxxxxxx.supabase.co
   SUPABASE_SERVICE_KEY      = eyJhbGciOiJI...   (long, starts with eyJ)
   ```

3. Trigger a redeploy (push any commit, or go to Deployments → click "Redeploy" on the latest).

## Verify it's working

After redeploy:
1. Sign in as `admin@initialestate.com` / `Admin1234!` (the built-in admin always works, no DB row needed).
2. Go to **ทีมงานและสิทธิ์** → click **+ เพิ่ม User** and create a new user.
3. Wait 10+ minutes (let the Vercel function go cold).
4. Try logging in as that user. **If the login succeeds**, Supabase is working ✓. If you get "อีเมลหรือรหัสผ่านไม่ถูกต้อง", env vars aren't being read — re-check step 4.

## What's stored where

| Data | Storage |
|------|---------|
| Built-in `admin@initialestate.com` | Code (always available, password from `ADMIN_PASSWORD` env var) |
| Registered users (from /register or admin "+ เพิ่ม User") | `users` table |
| Workspace settings (org info, AI defaults, security, …) | `workspace_settings` table |
| DSAR queue | `dsar_requests` table |
| Audit log | `audit_log` table |
| Forgot-password requests | `forgot_password_queue` table |

## Optional: tighter security

For production, also set:

```
ADMIN_PASSWORD     = <strong random password, different from default>
NEXTAUTH_SECRET    = <32+ random chars — generate with: openssl rand -base64 32>
NEXTAUTH_URL       = https://your-real-domain.com
```

And in Google Cloud Console add to OAuth redirect URIs:
```
https://your-real-domain.com/api/auth/callback/google
```
