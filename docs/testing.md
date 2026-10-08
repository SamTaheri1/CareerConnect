# Verification

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
