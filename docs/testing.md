# Verification

## Sprint 3 automated coverage (November 19, 2026)

Run `npm test` with Node.js 24 or later. The suite uses mocked AI providers and isolated PGlite databases; it does not call live OpenAI or modify the shared Supabase database. API integration tests start temporary localhost servers and require loopback connections to be permitted.

Local validation on November 19, 2026: `npm test` passed **116/116 tests**, with zero failures, skips or cancellations (about 68 seconds). This adds 28 tests to the previous 88: 26 isolated unit tests and two database integration tests. Syntax checks passed for `app.js`, `server.js`, `database.js` and `ai/resume-feedback.js`; `git diff --check` passed. No production code changes were needed.

| Requirement | Automated evidence | Test level |
| --- | --- | --- |
| Recruiter posting creation, editing, required fields, salary/deadline validation, permissions, close/reopen | `posting-workflows.test.js`; `posting-persistence.test.js` adds persisted validation, ownership and atomic rejection checks | Isolated frontend unit tests plus database integration |
| Archive/restore postings and filter applications | `recruiter-applications.test.js` | Frontend unit |
| Candidate review and status updates | `posting-workflows.test.js` checks escaped candidate details, ownership, supported statuses, dated history and unchanged-status behavior; `database.test.js` checks backend authorization and resume access | Frontend unit plus API/database integration |
| Application analytics and history | `application-dashboard.test.js` covers totals, empty state, account isolation, weekly boundaries, filtering and original submission details | Frontend unit |
| Notifications and reminders | `notification-boundaries.test.js` covers exact seven-day/expiry boundaries with a mocked clock, non-interview statuses, unchanged status, invalid-status rejection, deadline changes, recipient deduplication and closed/archived jobs; `notifications.test.js` covers new applications, interviews, reminder deduplication and privacy; `saved-ai-feedback.test.js` covers notification bell state | Unit plus database integration |
| AI resume feedback | `resume-feedback-unit.test.js` covers response parsing, target-role validation, file limits/types, ownership-error propagation, DOCX requests, timeout signal and simulated network/timeout errors; `registration.test.js` covers API success, provider errors, invalid/incomplete responses and rate limits; `saved-ai-feedback.test.js` covers saved results | Handler/frontend unit plus mocked-provider API integration |
| Additional application advice and private notes | `application-advice.test.js`; `application-notes.test.js`; `saved-ai-feedback.test.js` | Handler/frontend unit plus database integration |

The added files complement existing coverage rather than reproducing the existing success/error API scenarios. Frontend unit tests execute production functions in a VM with stubbed UI/persistence dependencies, following the repository's existing convention. Reminder boundary unit tests mock SQL access; real-database tests separately verify recipient selection and persistence. Database-backed tests are integration tests, not isolated unit tests.

### CI inclusion

`.github/workflows/main.yml` runs `npm ci` and `npm test` on pushes and pull requests using Node.js 24. The test script discovers `tests/*.test.js`, including all four newly added files. No CI configuration change is necessary. A remote GitHub Actions run has not been verified as part of this local change.

### Remaining verification limits

- This automated suite does not replace the PDF's separate requirement for at least one acceptance test per Sprint 3 user story. Verify each story's acceptance steps and recorded results in the project artifacts; contribution-log completion labels alone are not execution evidence.
- Real-browser workflows, accessibility and responsive layouts still require the manual checks below. VM tests do not exercise native browser form validation or rendering.
- Live AI quality and real PDF interpretation are not evaluated by mocked-provider tests. Validate those separately for the demonstration. The timeout unit case simulates a provider timeout and verifies an abort signal is supplied; it does not wait for a real network timeout.
- No code-coverage percentage or exhaustive branch-coverage claim is made.

## Executed checks

Browser checks were run in a fresh automated Microsoft Edge context on September 25, 2026, using an external test harness. No testing library is needed to run the website.

Passed:

- JavaScript syntax checks on app.js and data.js.
- Six initial listings render; keyword search and combined filters give the expected results; clearing filters restores the list.
- Recruiter and seeker registration, logout, login, and incorrect-password error.
- Recruiter job creation and listing detail view.
- Profile save, including HTML-like text rendered as text during recruiter review.
- Rejection of a fake PDF; upload of a valid PDF; browser file persistence.
- Saved job, application submission, and disabled duplicate application action.
- Removing a profile resume preserves the submitted application's downloadable copy.
- Recruiter review and status update to Interview.
- Recruiter closing a posting.
- Seeker receives the updated status and sees it after a page reload.
- Seeker cannot open recruiter workspace routes through the interface.
- Desktop and 390px mobile layout inspected; mobile filters open; no horizontal document overflow.
- No uncaught browser JavaScript errors during the complete workflow.

## Manual regression checklist

Resume preview logic checks: `node --test tests/resume-preview.test.js`.
For browser verification, upload a PDF and select **Preview** under My profile → My resumes.
Verify the document displays in the page dialog, Close and Escape dismiss it, and preview still works after reload.
Check a narrow viewport, a missing stored file, and DOC/DOCX uploads (these show guidance to upload a PDF copy).
Browsers without a built-in PDF viewer show a download fallback. No external document viewer is used.

1. Register each role; try a duplicate email, empty fields, an invalid email, and a password shorter than eight characters.
2. Save and edit a profile; reload to verify persistence.
3. Upload a resume; download it and check its contents. Try an empty file, unsupported extension, renamed invalid file, file over 5 MB, and a sixth resume.
4. Combine location, keyword, job type, workplace, experience, and category filters. Test no matches and clear all.
5. Save and unsave a job. Check that saved jobs survive logout and login.
6. Apply without a resume, then with one. Verify a second application to the same job is blocked.
7. Create two recruiter accounts. Each should see only their own postings and candidates.
8. Try an invalid salary range or past deadline. Edit, close, and reopen a posting; check the seeker listing each time.
9. Move an application through all four statuses. Verify dated history from the seeker account.
10. Remove a profile resume after applying; confirm the recruiter still downloads the submitted copy.
11. Navigate with keyboard only, use Escape to close dialogs, and check mobile profile access, forms, and 200% zoom.

Browser storage manipulation is outside the security guarantees of this frontend prototype. File signature checks are basic format checks, not malware scanning or complete document parsing.
