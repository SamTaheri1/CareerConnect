# Registration backend (updated October 23, 2026)

This update replaces the original browser-only registration and login. Older frontend-only descriptions in the project notes describe the previous implementation.

## Run

Install Node.js (version 24 or newer). Copy the example configuration and set values appropriate to the local machine:

```sh
copy .env.example .env
```

Then run from the project folder:

```sh
node server.js
```

Open the address printed by the server (the default is http://127.0.0.1:3000). Use this Node server instead of opening index.html directly, Live Server, or the previous Python server. No npm install or external packages are needed.

## Configuration

The server reads `.env` at startup. Do not commit a local `.env`; use `.env.example` as the documented safe template. `HOST`, `PORT`, `API_BASE_PATH`, `DATABASE_FILE`, `USER_DATA_FILE`, `PASSWORD_SCRYPT_N`, `PASSWORD_KEY_LENGTH`, `AUTH_MAX_ATTEMPTS`, `AUTH_WINDOW_MS`, and `REQUEST_MAX_BYTES` are configuration values, not hard-coded application settings. Keep the account file outside publicly served files and restrict access to it.

The browser receives only `API_BASE_PATH` through `/config.js`; it never receives storage paths or password-hashing settings. Restart the server after changing `.env`.

### Resume feedback configuration

The optional resume-feedback feature calls the OpenAI Responses API from the server. Set `OPENAI_API_KEY` only in the untracked `.env` file, select its model with `OPENAI_MODEL`, and set `AI_REQUEST_TIMEOUT_MS` to cap an upstream wait. The browser sends resume text to the local server, which forwards it to OpenAI only when the user asks for feedback; the request explicitly disables OpenAI response storage and the application does not save feedback. The API key is never sent to the browser. Test the feature with the team's own API key before demonstrating it.

## Task status

| Task | Before this update | Now |
| --- | --- | --- |
| 1.3 Add form validation | Browser validation implemented | Browser validation plus backend validation |
| 1.4 Create backend registration endpoint | Not implemented | POST `{API_BASE_PATH}/register` implemented |
| 1.5 Connect frontend to backend | Not implemented | Registration and login use the configured Node API path |
| 1.6 Store user information in database | Browser storage only, no server database | SQLite account storage with automatic JSON import |
| 1.7 Test successful registration | Browser-only flow tested | Backend automated tests and connected browser flow passed |
| 1.8 Test invalid registration | Browser validation tested | Backend rejection tests and connected browser error checks passed |

## Endpoints

POST `{API_BASE_PATH}/register` accepts JSON fields name, email, password, and role (seeker or recruiter). Success returns HTTP 201 with public user details. Invalid fields return 400, duplicate emails return 409, unsupported content type returns 415, and oversized requests return 413. Names and email addresses are trimmed; email matching is case-insensitive. Passwords are 8–128 characters and cannot be entirely whitespace.

POST `{API_BASE_PATH}/login` accepts email and password. Success returns 200 with public account details; incorrect credentials return 401. Repeated failures for the same IP address and email return 429 until the configured time window expires. Registration and login handlers are separate modules and have independent validation and error handling.

## Account storage

Accounts are stored in SQLite. The server creates the database and tables at startup and imports existing JSON accounts once. Password hashing and validation are unchanged. Registration and login set an HttpOnly session cookie; session records are stored in SQLite and expire after seven days. Logout removes the session.

Profiles, resumes, jobs, applications, saved jobs, and preparation checklists now use the server API. The server enforces account ownership and recruiter/job-seeker permissions. See [database setup and relationships](database.md) for configuration, endpoints, and migration details.

## Tests

```sh
node --test tests/*.test.js
```

Automated tests cover both roles, normalization, missing/blank/invalid/oversized fields, invalid roles, duplicate emails, malformed JSON, wrong methods/content types, request size limit, successful/failed login, persistence between server instances, absence of plaintext passwords in storage, configurable API paths, and static-file allowlisting.

SQLite integration tests also cover a complete server shutdown and restart, profile and job saves, resume replacement and deletion, immutable submitted copies, application history, transaction rollback, logout, and access restrictions. The existing resume workflow and preview tests remain in place.
