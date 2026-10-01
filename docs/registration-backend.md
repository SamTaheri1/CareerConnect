# Registration backend (October 1, 2026)

This update replaces the original browser-only registration and login. Older frontend-only descriptions in the project notes describe the previous implementation.

## Run

Install Node.js (version 22 or newer). Copy the example configuration and set values appropriate to the local machine:

```sh
copy .env.example .env
```

Then run from the project folder:

```sh
node server.js
```

Open the address printed by the server (the default is http://127.0.0.1:3000). Use this Node server instead of opening index.html directly, Live Server, or the previous Python server. No npm install or external packages are needed.

## Configuration

The server reads `.env` at startup. Do not commit a local `.env`; use `.env.example` as the documented safe template. `HOST`, `PORT`, `API_BASE_PATH`, `USER_DATA_FILE`, `PASSWORD_SCRYPT_N`, `PASSWORD_KEY_LENGTH`, `AUTH_MAX_ATTEMPTS`, `AUTH_WINDOW_MS`, and `REQUEST_MAX_BYTES` are configuration values, not hard-coded application settings. Keep the account file outside publicly served files and restrict access to it.

The browser receives only `API_BASE_PATH` through `/config.js`; it never receives storage paths or password-hashing settings. Restart the server after changing `.env`.

### Resume feedback configuration

The optional resume-feedback feature calls the OpenAI Responses API from the server. Set `OPENAI_API_KEY` only in the untracked `.env` file, select its model with `OPENAI_MODEL`, and set `AI_REQUEST_TIMEOUT_MS` to cap an upstream wait. The browser sends resume text to the local server, which forwards it to OpenAI only when the user asks for feedback; the request explicitly disables OpenAI response storage and the application does not save feedback. The API key is never sent to the browser. Test the feature with the team's own API key before demonstrating it.

## Task status

| Task | Before this update | Now |
| --- | --- | --- |
| 1.3 Add form validation | Browser validation implemented | Browser validation plus backend validation |
| 1.4 Create backend registration endpoint | Not implemented | POST `{API_BASE_PATH}/register` implemented |
| 1.5 Connect frontend to backend | Not implemented | Registration and login use the configured Node API path |
| 1.6 Store user information in database | Browser storage only, no server database | JSON-backed server account storage implemented |
| 1.7 Test successful registration | Browser-only flow tested | Backend automated tests and connected browser flow passed |
| 1.8 Test invalid registration | Browser validation tested | Backend rejection tests and connected browser error checks passed |

## Endpoints

POST `{API_BASE_PATH}/register` accepts JSON fields name, email, password, and role (seeker or recruiter). Success returns HTTP 201 with public user details. Invalid fields return 400, duplicate emails return 409, unsupported content type returns 415, and oversized requests return 413. Names and email addresses are trimmed; email matching is case-insensitive. Passwords are 8–128 characters and cannot be entirely whitespace.

POST `{API_BASE_PATH}/login` accepts email and password. Success returns 200 with public account details; incorrect credentials return 401. Repeated failures for the same IP address and email return 429 until the configured time window expires. Registration and login handlers are separate modules and have independent validation and error handling.

## Account storage

The backend stores accounts in the JSON file configured by `USER_DATA_FILE`; it creates the containing directory when needed. A write is first made to a temporary file and then renamed, reducing the chance of a partial account file after an interrupted write. Restarting the server does not remove registered accounts. Passwords are salted with cryptographically secure random bytes and hashed with Node's scrypt. Passwords and hashes are never returned by the API.

Existing frontend profile/job/application caches still use localStorage, resumes still use IndexedDB, and the current frontend session uses sessionStorage. Those existing browser features were not removed. Newly registered account caches contain only public fields, never passwords or hashes. Older browser-only accounts cannot log in through the backend; register again. Use the server origin for a clean demo.

This is a registration-testing backend, not a complete authenticated backend for the platform. No server session/token authorization was added, and other workflows remain local frontend demonstrations. Do not treat browser role guards as server authorization. A JSON file is suitable for this classroom prototype, but a production service needs durable transactional storage, concurrency control, secret management, and server-side authorization.

## Tests

```sh
node --test tests/registration.test.js
```

Automated tests cover both roles, normalization, missing/blank/invalid/oversized fields, invalid roles, duplicate emails, malformed JSON, wrong methods/content types, request size limit, successful/failed login, persistence between server instances, absence of plaintext passwords in storage, configurable API paths, and static-file allowlisting.

The connected browser flow was also checked: short-password browser validation, successful registration through HTTP 201, duplicate-email feedback from the backend, subsequent login, and absence of newly cached passwords or uncaught browser errors.
