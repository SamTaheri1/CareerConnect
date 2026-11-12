# Shared Supabase PostgreSQL storage

The website uses Supabase PostgreSQL through the Node server and the `pg` driver.
There is no local database fallback. Cloning GitHub downloads code, not records;
each checkout connects to the same Supabase project to see the same saved data.

## First-time setup

### Teammates joining the existing shared database

For the short, cross-platform walkthrough and Codex instructions, see
[TEAM_SETUP.md](../TEAM_SETUP.md). `npm run setup` creates a missing `.env` safely;
`npm run doctor` verifies configuration and remote connectivity without writes.

Install Node.js 24 or newer, pull the latest code and public `prod-ca-2021.crt`
certificate, then run `npm ci` from the folder containing `package.json`.
Copy `.env.example` to `.env` only if you do not already have an `.env`.
Obtain the project's `DATABASE_URL` privately from a trusted team member and
save it in your own `.env`. Keep the certificate setting relative:

```dotenv
DATABASE_URL="your-private-Supabase-PostgreSQL-connection-string"
DATABASE_CA_FILE=prod-ca-2021.crt
```

Do not copy another developer's absolute `C:\...` certificate path. The public
Supabase URL/key alone are not enough for this backend. Removing `.gitignore`
rules does not distribute local files or configure another computer.

Run `npm run db:check`, then `npm start`, and open `http://127.0.0.1:3000`.
Existing accounts are in the shared database. Do not run `db:import` again.
If either command fails, share just the error text, never the connection string.
The OpenAI key is optional and only needed for the resume feedback feature.

### Creating a new database (project maintainer only)

1. Install Node.js 24+ and run `npm ci` in the repository root.
2. Copy `.env.example` to `.env` only if `.env` does not already exist.
3. In Supabase, select **Connect > Session pooler**. Put that connection string
   in `.env` as `DATABASE_URL`, replacing the password placeholder. URL-encode
   special characters in the password. Never share this value in Git or chat.
4. Connections require verified TLS. The existing project uses the public
   `prod-ca-2021.crt` certificate in the repository. For another project, obtain
   its CA from Supabase database settings and set `DATABASE_CA_FILE` accordingly.
   Certificate verification is not disabled.
5. Run `npm run db:setup` once to create the private `careerconnect` schema.
   Re-running it preserves records. It does not insert sample jobs.
6. To transfer the existing SQLite records, stop the old server and run
   `npm run db:import -- data/careerconnect.sqlite` once, before new users start
   using the empty target. Keep the source file and WAL companions as backup.
7. Run `npm run db:check`, then `npm start`.

For subsequent checkouts: `npm ci`, provide the same project's private database
configuration through a trusted channel, then `npm start`. Do not re-import data.
For deployments, set these values in the hosting service's secret settings.
The Supabase GitHub connection does not supply credentials to local clones.

The public URL/key and `@supabase/supabase-js` are for Supabase's HTTP APIs; they
cannot replace `DATABASE_URL` in this server-side architecture. The existing login
system is retained, so accounts are in `careerconnect.users`, not Supabase Auth.
The frontend remains plain HTML, CSS and JavaScript. The previously installed
Supabase JavaScript/SSR packages are not used by this PostgreSQL backend.

## Data and security

Select the `careerconnect` schema in Supabase's Table Editor to inspect records.
It is intentionally excluded from the public Data API. Browser roles `anon` and
`authenticated` have no schema/table access. All website access goes through the
Node API's session and ownership checks. Do not expose this schema through the
Data API: it includes password hashes, private resumes, and session tokens.

| Table | Contents |
| --- | --- |
| users | Account ID, name, normalized unique email, role, salt, password hash |
| profiles | Contact details, biography, skills, preparation checklists |
| jobs | Recruiter owner, job details, salary, status, deadline |
| resumes | Owner, name, size, binary file bytes, listing flag |
| applications | Job, applicant, immutable resume copy, profile snapshot, status/history |
| application_notes | Private seeker notes associated with an application |
| saved_jobs | User/job bookmarks |
| sessions | Hashed session tokens and expiry |
| migrations | Schema initialization and one-time legacy import marker |

Resume bytes use PostgreSQL `BYTEA`; they are remote, not local files. List and
snapshot fields remain JSON-encoded text to preserve existing API behavior.
Profile/job/application saves use one transaction. A database advisory lock
serializes state/file writes across server instances to preserve ownership and
submitted-resume checks. This favors correctness over high write throughput.

## Legacy import

Only `scripts/import-sqlite.js` reads SQLite, in read-only mode with a consistent
snapshot. It transfers users, profiles, jobs, resume bytes, applications, notes,
and saved jobs atomically. Existing password hashes remain valid. Sessions are
not migrated; sign in again. A marker prevents repeated imports, and a nonempty
target is rejected rather than merging IDs or overwriting data. Failed imports
roll back. Old ownerless demo jobs are preserved if present in the source; no
new ones are generated automatically. Old browser-only data is not imported.

## API and validation

API paths and response shapes are unchanged: registration/login, logout,
`/state`, `/files`, and private `/application-notes`. AI feedback remains unsaved.
`DATABASE_FILE` and `USER_DATA_FILE` are no longer used.

Run `npm test`. Tests use an isolated PostgreSQL engine (PGlite) and never connect
to the shared project. They cover persistence across API server instances,
registration/login, access restrictions, notes, resume copies, rollback, and
import behavior. `npm run db:check` separately verifies the real remote connection
without printing credentials or personal records. Apply future schema changes
through explicit versioned migrations; changing CREATE TABLE IF NOT EXISTS does
not alter existing columns.
