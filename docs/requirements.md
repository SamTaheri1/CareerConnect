# Requirements and implementation notes

Source: `sprints/SOEN341_CareerConnect_Project_Sprint1.pdf` and the supplied screenshot of issues #2–#16. Only the issue titles were available; these implementations are provisional until the detailed acceptance criteria are supplied.

## Screenshot issue mapping

| Issue | Story | Implemented behavior |
| --- | --- | --- |
| #2 | US 1: User Registration | Name, email, password, and seeker/recruiter role; duplicate email validation; local password hashing |
| #3 | US 2: User Login | Email/password validation, error feedback, session restoration on refresh |
| #4 | US 3: User Logout | Clears the current session and returns to job search |
| #5 | US 4: Create User Profile | Name, location, phone, headline/company, website, bio, and seeker skills |
| #6 | US 5: Edit User Profile | Pre-filled form, validation, persistence, last-updated date |
| #7 | US 6: Resume Upload | PDF/DOC/DOCX selection, basic signature and size validation, actual file persistence |
| #8 | US 7: Manage Resume | Up to five files; download and confirmed removal; upload another version to replace a document |
| #9 | US 8: Browse Jobs | Open listings, company details, salary, location, type, and tags |
| #10 | US 9: Search Jobs | Keyword search across title, company, description, and tags; separate location search |
| #11 | US 10: Filter Jobs | Job type, workplace, experience, category; combined filters; clear controls; sorting |
| #12 | US 11: View Job Details | Description, responsibilities, requirements, salary, deadline, and application action |
| #13 | US 12: Apply for a Job | Choose uploaded resume, contact information, optional note; prevents duplicate and closed-job applications |
| #14 | US 13: Track Applications | Applied/Interview/Offered/Rejected counts, filter, dated history, persistence |
| #15 | US 14: Recruiter Creates Job Posting | Required-field validation, salary range and deadline checks; edit, close, and reopen own postings |
| #16 | US 15: Recruiter Manages Applications | Own postings only in the UI; candidate profile snapshot, note, resume download, status updates |

Additional PDF features included: saved jobs, application history, and in-page deadline reminders. Listings with passed deadlines are excluded from search and cannot accept new applications.

## Scope decisions

- The interface is written with HTML, CSS, and JavaScript without a frontend framework. A small Node.js server now provides registration and login endpoints and JSON-backed account storage; see `docs/registration-backend.md`.
- Registration and login have server-side input validation, password hashing, and login throttling. The rest of the product workflows remain browser-local demonstrations: browser role restrictions are not production authorization controls.
- Salary is annual CAD for every sample and recruiter-created listing, including internships and part-time positions. The form and listing explicitly use annual units.
- The two roles are selected during registration and cannot be switched on the profile form.
- Existing applications retain their original submitted profile and resume even after the profile changes.
- Sample companies and job descriptions are fictional. Their initial dates are relative to the first saved browser dataset.
- The interface contains no course or university references.

## Still outstanding

1. Detailed issue descriptions and acceptance criteria. Confirm fields, constraints, and role permissions against these when available.
2. A real generative-AI feature required by the full project specification. This version does not simulate or claim AI output. Decide the feature and model/service with the team; remote secret credentials must not be placed in frontend JavaScript.
3. The team's additional original feature and independently generated user stories. Team brainstorming must actually take place; no generated suggestions have been labeled as team-originated work.
4. Server-side authentication, authorization, shared storage for non-account data, and secure document delivery. The current Node backend persists accounts only; it does not authorize platform workflows.
5. External deadline notifications if required by later acceptance criteria. Current reminders are visible while using the site.
6. Team-owned submission deliverables: membership, GitHub board and assignments, planning and capacity, meeting minutes, review workflow, actual contribution records, personal AI-use PDF reports, and cover/submission document.

These items are not marked complete by the frontend implementation.
