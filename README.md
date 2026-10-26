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

If the project has a package.json file containing external dependencies, enter:

`npm install`

If there are no external dependencies, this step can be skipped.

### Step 5: Configure the environment

On macOS or Linux, enter:

`cp .env.example .env`

On Windows Command Prompt, enter:

`copy .env.example .env`

Review the `.env` file and adjust the configuration if necessary.

### Step 6: Start the server

Enter:

`node server.js`

The SQLite database will be created automatically if it does not exist.

### Step 7: Open the website

Open your browser and enter:

`http://127.0.0.1:3000`

The CareerConnect website should now be running.

### Step 8: Run automated tests (optional)

Enter:

`node --test tests/*.test.js`

### Additional Information

- SQLite is built into Node.js 24, so no separate database installation is required.
- The database is saved by default at `data/careerconnect.sqlite`.
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
