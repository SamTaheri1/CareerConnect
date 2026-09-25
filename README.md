# CareerConnect

A job search and application tracking website built with plain HTML, CSS, and JavaScript. Job seekers can keep their profiles, resumes, saved jobs, and applications together. Recruiters can post openings and review candidates.

## Run locally

Open `index.html` in a recent Edge, Chrome, or Firefox browser. For consistent browser storage, use a static local server (for example, VS Code Live Server). If Python is already installed, run the following from this folder:

```sh
python -m http.server 4173 --bind 127.0.0.1
```

Then open http://127.0.0.1:4173. Python only serves the static files; the website itself uses no backend, framework, packages, or build step. Use the same browser and URL throughout a demo, since browser storage is tied to the origin.

## Try the complete workflow

1. Create an account and choose **Hire people**.
2. Fill in the recruiter profile, then create a job posting.
3. Log out and create another account with **Find a job**.
4. Save the job, complete your profile, and upload a PDF, DOC, or DOCX resume (up to 5 MB).
5. Open the recruiter-created listing and submit an application.
6. Log back in as the recruiter. Open **Applications**, review the candidate, download the resume, and change the status.
7. Log back in as the seeker. The new status and its history appear under **My applications**.

The six initial listings are fictional examples. They support browsing, filtering, saving, and applying, but have no recruiter owner. Create a posting to demonstrate both sides of the review process.

## Files

- `index.html`: page shell, navigation, dialog, and metadata.
- `styles.css`: layout, components, and responsive styles.
- `data.js`: six sample listings.
- `app.js`: page rendering, forms, routing, browser storage, and user actions.
- `docs/requirements.md`: issue mapping, assumptions, and outstanding requirements.
- `docs/testing.md`: verification results and a repeatable manual test checklist.

## Storage and limitations

This is a local frontend prototype. Accounts, listings, profiles, and applications use localStorage; resumes use IndexedDB; the active login uses sessionStorage. Passwords are salted and hashed with the browser's Web Crypto API. There is no server authentication or authorization boundary: a person with browser developer tools can change local data. Use sample information, not real sensitive documents or credentials.

Data persists in this browser but is not shared between computers or browser profiles. Clearing site data removes the accounts and files. Deadline notices appear in the saved-jobs and application views; no email, push notification, or background scheduler is connected. Concurrent edits from multiple tabs are not transaction-safe.

A submitted application has a snapshot of the profile and its own resume file. Removing the original resume does not remove the application copy.

## Remaining project work

The available PDF requires a real generative-AI feature in the overall project. No AI service or model is connected in this frontend version. That requirement remains open, along with the team's independently proposed original feature. See `docs/requirements.md` for the distinction between implemented website functionality and team deliverables.

Team names, assignments, deadlines, meetings, repository links, and contribution claims have not been invented. Add the team's actual information before submission. The personal AI-usage PDF reports required by the specification must be completed by each responsible team member; the website's implementation should be included in that record.
