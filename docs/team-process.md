# Team Process

This process applies to CareerConnect work from Sprint 1 onward. It is the team’s working agreement; changes must be discussed and recorded in meeting minutes.

## Workflow

1. Create a GitHub issue with a clear user story or task, acceptance criteria, priority, and assignee.
2. Move the issue to **Ready** only when it meets the Definition of Ready.
3. The assignee moves it to **In progress**, creates a branch, and links commits and pull requests to the issue.
4. Open a pull request against `main` when the change meets the Definition of Done.
5. A teammate reviews it, requests changes when needed, and approves only after the checks pass.
6. Merge the approved pull request, update the board, and close the linked issue.

## Branching and commits

- `main` must remain runnable and contain reviewed work only.
- Create one short-lived branch per issue, named `feature/<issue>-short-description`, `fix/<issue>-short-description`, or `docs/<issue>-short-description`.
- Keep commits small and descriptive. Include the issue number when applicable, for example: `Add profile validation (#6)`.
- Do not commit `.env`, credentials, personal data, generated local storage, or unrelated formatting changes.

## Pull requests and review

- Every pull request must link its issue and state what changed, how it was tested, and any known limitation.
- The author must run the relevant checks before requesting review.
- At least one teammate reviews code changes. The author does not approve their own pull request.
- Reviewers check requirements, validation/error handling, security implications, regressions, and documentation. Requested changes must be resolved before merge.
- Urgent fixes still require a follow-up review if a normal review cannot happen first; record the reason in the pull request.

## Definition of Ready

An issue is ready when it has:

- A clear title and user story or task description.
- Testable acceptance criteria.
- A priority, assignee, and target sprint/date.
- Known dependencies, design decisions, and required assets or access.
- No unresolved question that prevents implementation.

## Definition of Done

An issue is done when:

- Its acceptance criteria are implemented and manually verified.
- Relevant automated checks pass, or the reason no automation exists is documented.
- Input validation and understandable error states are included where applicable.
- Changes are reviewed, approved, merged into `main`, and linked to the issue.
- User-facing or developer documentation is updated when the behavior or setup changed.
- The board and issue status are updated, and no known blocking defect remains.
