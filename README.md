# CareerConnect

**Team members cloning this repository:** follow [TEAM_SETUP.md](TEAM_SETUP.md).
Run `npm ci`, then `npm run setup`, fill in your private `.env`, and run
`npm run doctor` before `npm start`. GitHub does not distribute credentials.

Shared Supabase PostgreSQL storage: users, profiles, resume files, jobs, applications, saved jobs, notes, and preparation checklists persist in the same remote database across checkouts. See [database setup](docs/database.md).

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

Follow these steps to clone and run CareerConnect on your computer.

### Step 1: Install the required software

Make sure you have installed:
- Node.js (version 24 or newer): https://nodejs.org/
- Git: https://git-scm.com/

Open your terminal and verify the installations:

`node -v`

`npm -v`

`git --version`

### Step 2: Clone the repository

Open your terminal and enter:

`git clone https://github.com/USERNAME/REPOSITORY.git`

Replace USERNAME and REPOSITORY with the actual GitHub repository information.

### Step 3: Navigate to the project folder

Enter:

`cd REPOSITORY`

Replace REPOSITORY with your project folder name.

### Step 4: Install dependencies

Run `npm ci` to install the locked dependencies.

### Step 5: Configure the environment

On macOS or Linux, enter:

`cp .env.example .env`

On Windows Command Prompt, enter:

`copy .env.example .env`

Do not overwrite an existing `.env`. Set `DATABASE_URL` to your Supabase **Connect > Session pooler** PostgreSQL URI, including the database password. Keep it private. The public publishable key is not a database connection string. See [database setup](docs/database.md) for verified TLS certificate configuration.

On the first setup only, run `npm run db:setup`. To transfer the existing local data into an empty target, stop the old server and run `npm run db:import -- data/careerconnect.sqlite`. Then run `npm run db:check`. Other checkouts use the same remote database without importing again.

### Step 6: Start the server

Enter:

`node server.js`

The server connects to Supabase. Missing credentials or schema cause startup to fail; no local database is created.

### Step 7: Open the website

Open your browser and enter:

`http://127.0.0.1:3000`

The CareerConnect website should now be running.

### Step 8: Run automated tests (optional)

Enter:

`npm test`

### Additional Information

- Data lives in Supabase, not GitHub or a local database file.
- Each developer needs a private `.env` pointing to the same Supabase project.
- Tests use an isolated PostgreSQL engine and do not modify shared Supabase records.
- For further details, see [Database Setup](docs/database.md) and [Registration Backend](docs/registration-backend.md).

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
