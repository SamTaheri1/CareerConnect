# CareerConnect Sprint 1 Submission

## Cover page

**Project title:** CareerConnect - Job Search and Application Tracking Platform  
**Course:** SOEN 341 Software Process Team Project  
**Term:** Fall 2026  

**Group members:**

- Reza Ali Ahsan
- Sami Fares
- Matvei Cladcov
- Sam Taheri

## GitHub repository

[https://github.com/SamTaheri1/Sprint-1](https://github.com/SamTaheri1/Sprint-1)

## README file

# CareerConnect

Registration backend update: copy `.env.example` to `.env`, review the values, then run `node server.js`. No packages or database server are required. Test with `node --test tests/registration.test.js`. Accounts are stored in the JSON file selected by `USER_DATA_FILE`, so they remain available after a server restart. See [registration setup and task status](docs/registration-backend.md).

## Project description

CareerConnect is a website made to help people stay organized while looking for a job. Instead of having job applications, resumes, and updates all over the place, users can keep everything together on one website. They will be able to make a profile, upload their resume, look for jobs, apply, and see what is happening with each application. Recruiters can also post jobs and look through the applications they receive. The main idea is to make job searching easier to keep track of and less messy.

## Identified problem

When people are looking for a job, they usually have to keep track of a lot of things at once, like their resumes, the jobs they applied to, and the status of each application. This can get confusing, especially when everything is on different websites or in different files. CareerConnect is meant to make this easier by helping job seekers keep all of this information organized in one place.

## Proposed solution

Our solution is to create a website called CareerConnect that helps job seekers and recruiters keep everything in one place. Job seekers will be able to create a profile, upload their resume, look for jobs, apply, and keep track of their applications. Recruiters will also be able to post jobs and look through the applications they receive. The goal is to make the job search easier to organize and easier to follow.

## Team members

- Reza Ali Ahsan
- Sami Fares
- Matvei Cladcov
- Sam Taheri

## Technologies and frameworks

- HTML
- CSS
- JavaScript
- Node.js
- Git
- GitHub
- Generative AI tools such as ChatGPT, Codex, Claude, Claude Code, and Antigravity

## Setup instructions

To run CareerConnect:

1. Clone the GitHub repository.
2. Open the CareerConnect folder.
3. Copy `.env.example` to `.env` and review the local configuration values.
4. Run `node server.js`.
5. Open the address printed by the server. With the example configuration, it is `http://127.0.0.1:3000`.

Node.js 22 or newer is required. No npm install, external package, or database server is required. The registration backend stores accounts in the JSON file configured by `USER_DATA_FILE`; registered accounts remain available after a server restart.

Run the registration tests with `node --test tests/registration.test.js`.

## Proposed features

- User registration and login
- User profile management
- Resume upload and management
- Job posting for recruiters
- Job search and filtering
- Job application submission
- Application-status tracking
- Application history
- Saved jobs
- Deadline reminders
- AI-assisted resume feedback or job matching
- One additional original team feature
