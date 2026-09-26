# Registration backend (September 26, 2026)

This update replaces the original browser-only registration and login. Older frontend-only descriptions in the project notes describe the previous implementation.

## Run

Install Node.js (version 22 or newer), then run from the project folder:

```sh
node server.js
```

Open http://127.0.0.1:4174. Use this Node server instead of opening index.html directly, Live Server, or the previous Python server. No npm install or external packages are needed.

## Task status

| Task | Before this update | Now |
| --- | --- | --- |
| 1.3 Add form validation | Browser validation implemented | Browser validation plus backend validation |
| 1.4 Create backend registration endpoint | Not implemented | POST /api/register implemented |
| 1.5 Connect frontend to backend | Not implemented | Registration and login call the Node backend |
| 1.6 Store user information in database | Browser storage only, no server database | Intentionally not implemented; no server database |
| 1.7 Test successful registration | Browser-only flow tested | Backend automated tests and connected browser flow passed |
| 1.8 Test invalid registration | Browser validation tested | Backend rejection tests and connected browser error checks passed |

## Endpoints

POST /api/register accepts JSON fields name, email, password, and role (seeker or recruiter). Success returns HTTP 201 with public user details. Invalid fields return 400, duplicate emails return 409, unsupported content type returns 415, and oversized requests return 413. Names and email addresses are trimmed; email matching is case-insensitive. Passwords are 8–128 characters and cannot be entirely whitespace.

POST /api/login accepts email and password. Success returns 200 with public account details; incorrect credentials return 401. Login was connected so accounts registered through the backend can log back in.

## No database

The backend uses a JavaScript Map in RAM. It never writes accounts to disk and has no database dependency, connection, schema, or database file. Restarting the process removes all registered accounts. Passwords are salted and hashed with Node's scrypt; passwords and hashes are not returned by the API.

Existing frontend profile/job/application caches still use localStorage, resumes still use IndexedDB, and the current frontend session uses sessionStorage. Those existing browser features were not removed. Newly registered account caches contain only public fields, never passwords or hashes. Older browser-only accounts cannot log in through the backend; register again. Use the new server origin for a clean demo.

This is a registration-testing backend, not a complete authenticated backend for the platform. No server session/token authorization was added, and other workflows remain local frontend demonstrations. An already-open frontend session can remain visible after a server restart; logging out and back in requires registering again. Do not treat the browser's role guards as server authorization.

## Tests

```sh
node --test tests/registration.test.js
```

24 automated tests passed: both roles, normalization, missing/blank/invalid/oversized fields, invalid roles, duplicate emails, malformed JSON, wrong methods/content types, request size limit, successful/failed login, no persistence between server instances, and static-file allowlisting.

The connected browser flow was also checked: short-password browser validation, successful registration through HTTP 201, duplicate-email feedback from the backend, subsequent login, and absence of newly cached passwords or uncaught browser errors.
