# CareerConnect

SQLite storage: run `node server.js` to create the database automatically. Users, profiles, resume files, jobs, applications, saved jobs, and preparation checklists persist on the server. See [database setup](docs/database.md).

## Project description 
CareerConnect is a website made to help people stay organized while looking for a job. Instead of having job applications, resumes, and updates all over the place, users can keep everything together on one website. They will be able to make a profile, upload their resume, look for jobs, apply, and see what is happening with each application. Recruiters can also post jobs and look through the applications they receive. The main idea is to make job searching easier to keep track of and less messy.

## Identified problem
When people are looking for a job, they usually have to keep track of a lot of things at once, like their resumes, the jobs they applied to, and the status of each application. This can get confusing, especially when everything is on different websites or in different files. CareerConnect is meant to make this easier by helping job seekers keep all of this information organized in one place.

## Proposed Solution
Our solution is to create a website called CareerConnect that helps job seekers and recruiters keep everything in one place. Job seekers will be able to create a profile, upload their resume, look for jobs, apply, and keep track of their applications. Recruiters will also be able to post jobs and look through the applications they receive. The goal is to make the job search easier to organize and easier to follow.

## Team Members
•	Reza Ali Ahsan  
•	Sami Fares  
•	Matvei Cladcov  
•	Sam Taheri  

## Technologies and Frameworks
•	HTML  
•	CSS  
•	JavaScript 
•	Node.js   
•	Git  
•	GitHub  
•	Generative AI tools such as ChatGPT, Codex, Claude, Claude Code, and Antigravity  

*We may use other technologies later if we need them as the project develops.*

## Setup Instructions

To run CareerConnect:

1. Clone the GitHub repository.
2. Open the CareerConnect folder.
3. Copy `.env.example` to `.env` and review the local configuration values.
4. Run `node server.js`.
5. Open the address printed by the server. With the example configuration, it is `http://127.0.0.1:3000`.

Use Node.js 24 or newer. SQLite is built into Node, so no npm install or separate database server is required. `DATABASE_FILE` defaults to `data/careerconnect.sqlite`. Existing JSON accounts are imported automatically from `USER_DATA_FILE` without changing their passwords.

To run all tests:

`node --test tests/*.test.js`

For backend configuration, endpoint behavior, and current limitations, see [registration setup and task status](docs/registration-backend.md).

## Proposed Features
We plan to include:  

•	User registration and login  
•	User profile management  
•	Resume upload and management  
•	Job posting for recruiters  
•	Job search and filtering  
•	Applying to jobs  
•	Tracking application status such as Applied, Interview, Offered, or Rejected  
•	Viewing application history  
•	Saving jobs to look at later  
•	Getting reminders for application deadlines  
•	An AI feature for resume feedback or job matching  
•	One additional original feature that our team will decide on  
