# Run CareerConnect on a teammate's computer

Use Node.js **24 or newer**. Open the cloned repository folder containing
`package.json` in VS Code or Codex, then run:

```sh
npm ci
npm run setup
```

The setup command creates your local `.env` from `.env.example`. It never
overwrites an existing `.env`. Git ignores `.env`, but the app and Codex can
read it locally.

Obtain `DATABASE_URL` from a trusted team member through a private channel.
Put the real value in `.env` (not `.env.example`):

```dotenv
DATABASE_URL="the team's actual private PostgreSQL connection string"
DATABASE_CA_FILE=prod-ca-2021.crt
OPENAI_API_KEY="your OpenAI API key, if testing live AI feedback"
```

The public CA certificate is included in the repository. Use the relative path
shown above, not another member's `C:\...` path. Leave `OPENAI_API_KEY` blank if
you do not need live AI feedback. The public Supabase URL and publishable key
do not replace the PostgreSQL connection string for this backend.

Save `.env`, then run:

```sh
npm run doctor
npm start
```

Open http://127.0.0.1:3000 and sign in. Existing accounts are shared through
Supabase. **Do not run `db:import` again or create a new database.** Restart the
server whenever you change `.env`.

`doctor` verifies the configured certificate and live database access without
changing data or exposing credentials. It checks whether an AI key is present,
but does not validate that key or send a paid AI request. If it fails, share
only the error message with the team, not your `.env` contents.

## Using Codex

Open this repository as Codex's workspace and ask:

> Follow TEAM_SETUP.md. Preserve my existing .env and never print its secrets.
> Run npm run doctor and npm test, then start the website. Test the API and, if
> browser tools are available, the website interface. Use designated test
> accounts and preserve existing data. Do not run db:import or commit secrets.

If local network access is blocked by Codex's sandbox, permit the specific
database/server test through its normal approval flow. UI tests need browser
tools; API tests do not. `npm test` uses isolated test data; interacting with
the running website changes the shared Supabase database.

Only trusted developers should receive direct database credentials. Regular
users should use a deployed website instead.
