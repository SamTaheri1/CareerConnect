# SQLite storage

Run `node server.js` with Node.js 24 or newer. No npm packages or separate database service are needed. The server creates the database directory and tables automatically. The existing HTML, CSS, and plain JavaScript interface still runs through the Node server.

`DATABASE_FILE` sets the database path, relative to the project directory unless absolute. The default is `data/careerconnect.sqlite`. SQLite files and their WAL/SHM companion files are excluded from Git and are not served by the website. Stop the server before copying the database for a simple backup.

## Tables and relationships

| Table | Contents and relationships |
| --- | --- |
| users | Account ID, name, unique email, role, salt, password hash |
| profiles | One profile per user, contact details, bio, skills, and preparation checklists |
| resumes | Owner, filename, size, upload date, file bytes, and whether it appears in My resumes |
| jobs | Recruiter owner, job details, salary, status, and deadline; sample jobs have no owner |
| applications | Job, applicant, submitted resume copy, contact/profile snapshot, status, and history |
| saved_jobs | User/job pairs for bookmarks |
| sessions | Hashed session tokens, user, and expiration date |
| migrations | Records one-time setup and JSON account import |

Foreign keys enforce the relationships. Email matching is case-insensitive. A user can apply to a job only once. List fields such as job requirements and application history use JSON within their table rows. File bytes are BLOBs in the resumes table.

Application resumes are separate copies. Replacing or deleting a profile resume does not change an existing application. Submitted copies cannot be overwritten or deleted through the file API.

## Existing data

At startup, accounts in the old `USER_DATA_FILE` (default `data/users.json`) are imported once, keeping their IDs, salts, and password hashes. The original file is left untouched. Sample jobs are inserted once, so restarting the server does not change their dates or duplicate them.

Old localStorage profiles/jobs/applications and IndexedDB files remain in their original browser storage; they are not automatically imported or erased. Those browser-only records were not authenticated server records. Existing JSON accounts can log in normally; any old browser-only profile details or documents must be saved/uploaded again. All new saves use SQLite and are available when signing in from another browser.

## API

All paths use the configured `API_BASE_PATH` (default `/api`).

- `POST /register` and `POST /login`: existing validation and password hashing, plus an HttpOnly session cookie.
- `POST /logout`: removes the session.
- `GET /state`: public jobs plus the signed-in user's profile and permitted applications.
- `POST /state`: saves changed profile, job, and application records in one transaction. The frontend sends only records that changed, so saving a profile does not overwrite other recruiters' jobs.
- `GET /files?id=...`: downloads an owned resume or a submitted copy for the job's recruiter.
- `POST /files`: uploads or deletes an owned resume. Uploads are limited to 5 MB and checked for PDF/DOC/DOCX signatures.

Server-side checks restrict job edits and application status changes to the job's recruiter. Only job seekers can upload resumes or apply. Password hashes, salts, and session tokens are never included in state responses. AI feedback remains unsaved.

## Tests

Run `node --test tests/*.test.js`. Tests use temporary databases, not the site's configured database. They cover registration, login, duplicate emails, validation, JSON import, foreign keys, persistence across a full restart, profile/job/resume/application saves, saved jobs, checklists, submitted copies, rollback, logout, and access checks.
