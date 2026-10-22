const STORAGE_KEY = "careerconnect-v1";
const SESSION_KEY = "careerconnect-session";
const statuses = ["Applied", "Interview", "Offered", "Rejected"];
const main = document.querySelector("#main");
const modal = document.querySelector("#modal");
const icons = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  briefcase:
    '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12c6 4 12 4 18 0M12 12v4"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4Z"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
  filter:
    '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="white"/><circle cx="15" cy="17" r="2" fill="white"/>',
  file: '<path d="M14 3H5v18h14V8Z M14 3v5h5 M8 13h8 M8 17h6"/>',
};
function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.briefcase}</svg>`;
}
function e(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}
const uid = () => crypto.randomUUID();
const day = 86400000;
function initialData() {
  const now = Date.now();
  return {
    users: [],
    applications: [],
    jobs: seedJobs.map((job) => ({
      ...job,
      ownerId: null,
      status: "Open",
      createdAt: new Date(now - job.daysAgo * day).toISOString(),
      deadline: new Date(now + job.deadlineDays * day)
        .toISOString()
        .slice(0, 10),
    })),
  };
}
let storageWarning = "";
function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return initialData();
    const parsed = JSON.parse(saved);
    if (
      !Array.isArray(parsed.users) ||
      !Array.isArray(parsed.jobs) ||
      !Array.isArray(parsed.applications)
    )
      throw new Error("Invalid saved data");
    return parsed;
  } catch {
    storageWarning =
      "Saved data could not be read. Enable browser storage to save your changes.";
    return initialData();
  }
}
let db = loadData();
let sessionId;
try {
  sessionId = sessionStorage.getItem(SESSION_KEY);
} catch {
  sessionId = null;
}
function user() {
  return db.users.find((person) => person.id === sessionId);
}
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    db = loadData();
    throw new Error(
      "Your changes could not be saved. Browser storage may be full or disabled.",
    );
  }
}
function setSession(id) {
  if (id) sessionStorage.setItem(SESSION_KEY, id);
  else sessionStorage.removeItem(SESSION_KEY);
  sessionId = id;
}
function toast(message) {
  const element = document.querySelector("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), 4500);
}
function date(value) {
  return new Date(
    value.length === 10 ? `${value}T12:00:00` : value,
  ).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function isOpen(job) {
  return job.status === "Open" && job.deadline >= today();
}
function posted(value) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value)) / day));
  return days === 0
    ? "Posted today"
    : `Posted ${days} day${days === 1 ? "" : "s"} ago`;
}
function salary(job) {
  return `$${Number(job.min).toLocaleString("en-CA")} – $${Number(job.max).toLocaleString("en-CA")}`;
}
function badge(status) {
  return `<span class="status ${e(status.toLowerCase())}">${e(status)}</span>`;
}
function logo(job) {
  return `<span class="company-logo ${["peach", "purple", "pink", "blue", "green", "yellow"].includes(job.color) ? job.color : "green"}" aria-hidden="true">${e(job.initials)}</span>`;
}
function empty(title, message, action = "") {
  return `<div class="empty">${icon("briefcase")}<h3>${title}</h3><p>${message}</p>${action}</div>`;
}
const preparationSteps = [
  ["resume", "Tailor your resume to this role"],
  ["profile", "Check that your profile and contact details are current"],
  ["requirements", "Review the role requirements"],
  ["note", "Write a short note for the hiring team"],
];
function preparationChecklist(jobId) {
  const person = user();
  if (!person || person.role !== "seeker") return "";
  const completed = person.preparationChecklists?.[jobId] || [];
  return `<section class="preparation-checklist" aria-labelledby="checklist-title"><div><p class="eyebrow">Application preparation</p><h2 id="checklist-title">Before you apply</h2><p class="hint">${completed.length} of ${preparationSteps.length} complete. This list is saved in this browser for this job.</p></div><fieldset>${preparationSteps.map(([key, label]) => `<label class="check"><input type="checkbox" data-action="toggle-checklist" data-id="${jobId}" data-step="${key}" ${completed.includes(key) ? "checked" : ""}><span>${e(label)}</span></label>`).join("")}</fieldset></section>`;
}
let filters = {
  query: "",
  location: "",
  types: [],
  arrangements: [],
  levels: [],
  category: "",
  sort: "newest",
};
let applicationFilter = "All";
function header(route) {
  const person = user();
  const links =
    person?.role === "recruiter"
      ? [
          ["jobs", "Find jobs"],
          ["postings", "My postings"],
          ["candidates", "Applications"],
        ]
      : [
          ["jobs", "Find jobs"],
          ["applications", "My applications"],
          ["saved", "Saved jobs"],
          ["resume-feedback", "Resume feedback"],
        ];
  document.querySelector("#navigation").innerHTML = links
    .map(
      ([path, label]) =>
        `<a href="#${path}" class="${route === path ? "active" : ""}" ${route === path ? 'aria-current="page"' : ""}>${label}</a>`,
    )
    .join("");
  document.querySelector("#account-actions").innerHTML = person
    ? `<a href="#profile" class="avatar" aria-label="My profile">${e(person.name.slice(0, 1).toUpperCase())}</a><a class="account-name" href="#profile">${e(person.name.split(" ")[0])}</a><button class="btn btn-text" data-action="logout">Log out</button>`
    : '<a href="#login" class="btn btn-text">Log in</a><a href="#register" class="btn btn-primary">Get started ' +
      icon("arrow") +
      "</a>";
}
function shell(content) {
  main.innerHTML = `<div class="page">${content}</div>`;
}
function navigate(route) {
  if (location.hash === `#${route}`) render();
  else location.hash = route;
}
function render() {
  const [route = "jobs", id] = (location.hash.slice(1) || "jobs").split("/");
  if (modal.open) modal.close();
  header(route);
  const names = {
    jobs: "Find jobs",
    job: "Job details",
    login: "Log in",
    register: "Create an account",
    profile: "My profile",
    applications: "My applications",
    saved: "Saved jobs",
    postings: "My postings",
    candidates: "Applications",
    "new-job": "Post a job",
    "edit-job": "Edit job",
    "resume-feedback": "Resume feedback",
  };
  document.title = `${names[route] || "Page not found"} · CareerConnect`;
  if (
    [
      "profile",
      "applications",
      "saved",
      "resume-feedback",
      "postings",
      "candidates",
      "new-job",
      "edit-job",
    ].includes(route) &&
    !user()
  ) {
    shell(
      `<div class="auth-wrap">${empty("Your next step starts here", "Log in to manage your profile, saved jobs, and applications.", '<a href="#login" class="btn btn-primary">Log in</a> <a href="#register" class="btn btn-secondary">Create an account</a>')}</div>`,
    );
    return;
  }
  if (
    ["postings", "candidates", "new-job", "edit-job"].includes(route) &&
    user()?.role !== "recruiter"
  ) {
    shell(
      empty(
        "For recruiters",
        "This page is available to recruiter accounts.",
        '<a class="btn btn-primary" href="#jobs">Find jobs</a>',
      ),
    );
    return;
  }
  if (["applications", "saved", "resume-feedback"].includes(route) && user()?.role !== "seeker") {
    shell(
      empty(
        "For job seekers",
        "Use your recruiter workspace to manage jobs and applicants.",
        '<a class="btn btn-primary" href="#postings">My postings</a>',
      ),
    );
    return;
  }
  switch (route) {
    case "jobs":
      renderJobs();
      break;
    case "job":
      renderDetail(id);
      break;
    case "register":
    case "login":
      renderAuth(route);
      break;
    case "profile":
      renderProfile();
      break;
    case "resume-feedback":
      renderResumeFeedback();
      break;
    case "saved":
      renderSaved();
      break;
    case "applications":
      renderApplications();
      break;
    case "postings":
      renderPostings();
      break;
    case "candidates":
      renderCandidates();
      break;
    case "new-job":
    case "edit-job":
      renderJobForm(id);
      break;
    default:
      shell(
        empty(
          "Page not found",
          "This page may have moved.",
          '<a href="#jobs" class="btn btn-primary">Find jobs</a>',
        ),
      );
  }
}
function checkGroup(title, key, values) {
  return `<div class="filter-section"><fieldset><legend>${title}</legend>${values.map((value) => `<label class="check"><input type="checkbox" name="${key}" value="${value}" ${filters[key].includes(value) ? "checked" : ""}>${value}<span>${db.jobs.filter((job) => isOpen(job) && job[{ types: "type", arrangements: "arrangement", levels: "level" }[key]] === value).length}</span></label>`).join("")}</fieldset></div>`;
}
function renderJobs() {
  shell(`<section class="intro"><div class="eyebrow">Your next chapter</div><h1>Good work. <em>Great possibilities.</em></h1><p>Find a role that feels right. Take the next step at your own pace.</p></section>
    <form id="search-form" class="search-form"><div class="search-field">${icon("search")}<input name="query" aria-label="Job title, keyword, or company" placeholder="Job title, keyword, or company" value="${e(filters.query)}"></div><div class="search-field">${icon("pin")}<input name="location" aria-label="City or province" placeholder="City or province" value="${e(filters.location)}"></div><button class="btn btn-primary">Search jobs ${icon("arrow")}</button></form>
    <div class="popular">Popular searches: ${["Developer", "Design", "Marketing", "Intern"].map((term) => `<button data-action="popular" data-term="${term}">${term}</button>`).join("")}</div>
    <div class="jobs-layout"><button class="btn btn-secondary filter-toggle" data-action="filters" aria-expanded="false" aria-controls="filters">${icon("filter")} Filters</button><aside id="filters" class="filters" aria-label="Job filters"><div class="filter-heading"><h2>Filters</h2><button data-action="clear-filters">Clear all</button></div>${checkGroup("Job type", "types", ["Full-time", "Part-time", "Internship", "Contract"])}${checkGroup("Workplace", "arrangements", ["On-site", "Hybrid", "Remote"])}${checkGroup("Experience level", "levels", ["Entry level", "Mid level", "Senior level"])}<label>Field of work<select id="category" class="filter-select"><option value="">All fields</option>${["Technology", "Design", "Marketing", "Business", "Other"].map((v) => `<option ${filters.category === v ? "selected" : ""}>${v}</option>`).join("")}</select></label></aside>
    <section aria-label="Job results"><div class="results-heading"><h2 id="results-count" aria-live="polite"></h2><label class="sort-label">Sort by <select id="sort"><option value="newest" ${filters.sort === "newest" ? "selected" : ""}>Newest first</option><option value="salary" ${filters.sort === "salary" ? "selected" : ""}>Highest salary</option><option value="deadline" ${filters.sort === "deadline" ? "selected" : ""}>Closing soon</option></select></label></div><div id="job-results"></div></section>
    <aside class="right-rail"><div class="aside-card feature"><div class="feature-symbol">↗</div><h2>Your next move,<br>all in one place.</h2><p>Keep your resume ready and your applications organized.</p><a class="btn" href="#${user() ? "profile" : "register"}">${user() ? "Update your profile" : "Create your profile"} ${icon("arrow")}</a></div><div class="aside-card"><div class="section-label">A SMALL HEAD START</div><h3>Make your application count.</h3><ul><li>Keep your resume up to date.</li><li>Show work you’re proud of.</li><li>Make each application personal.</li></ul></div><p class="aside-note">A new opportunity doesn’t have to mean starting over. Bring what you know.</p></aside></div>`);
  updateResults();
}
function filteredJobs() {
  const query = filters.query.trim().toLowerCase();
 const place = filters.location.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return db.jobs
    .filter(
      (job) =>
        isOpen(job) &&
        `${job.title} ${job.company} ${job.description} ${job.tags.join(" ")}`
          .toLowerCase()
          .includes(query) &&
       job.location.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(place) &&
        (!filters.types.length || filters.types.includes(job.type)) &&
        (!filters.arrangements.length ||
          filters.arrangements.includes(job.arrangement)) &&
        (!filters.levels.length || filters.levels.includes(job.level)) &&
        (!filters.category || job.category === filters.category),
    )
    .sort((a, b) =>
      filters.sort === "salary"
        ? b.max - a.max
        : filters.sort === "deadline"
          ? a.deadline.localeCompare(b.deadline)
          : new Date(b.createdAt) - new Date(a.createdAt),
    );
}
function updateResults() {
  const jobs = filteredJobs();
  document.querySelector("#results-count").innerHTML =
    `${jobs.length} ${jobs.length === 1 ? "job" : "jobs"} available <span>Find your fit.</span>`;
  document.querySelector("#job-results").innerHTML = jobs.length
    ? jobs.map(jobCard).join("")
    : empty(
        "No jobs found",
        "Try a different keyword or broaden your filters.",
        '<button class="btn btn-secondary" data-action="clear-filters">Clear all filters</button>',
      );
}
function jobCard(job) {
  const saved = user()?.saved?.includes(job.id);
  return `<article class="job-card"><div class="job-top">${logo(job)}<div><div class="company-name">${e(job.company)}</div><div class="posted">${posted(job.createdAt)}</div></div>${user()?.role !== "recruiter" ? `<button class="save-btn ${saved ? "saved" : ""}" data-action="save" data-id="${job.id}" aria-label="${saved ? "Unsave" : "Save"} ${e(job.title)}" aria-pressed="${!!saved}">${icon("bookmark")}</button>` : ""}</div><a class="job-title" href="#job/${job.id}">${e(job.title)}</a><div class="job-meta"><span>${icon("pin")}${e(job.location)}</span><span>${icon("briefcase")}${e(job.type)}</span><span>• ${e(job.arrangement)}</span></div><div class="tags">${job.tags.map((tag) => `<span class="tag">${e(tag)}</span>`).join("")}${!isOpen(job) ? '<span class="tag">Closed</span>' : ""}</div><div class="card-bottom"><span class="salary">${salary(job)} <small>/ year</small></span><a class="details-link" href="#job/${job.id}">View job ${icon("arrow")}</a></div></article>`;
}
function renderDetail(id) {
  const job = db.jobs.find((item) => item.id === id);
  if (!job)
    return shell(
      empty(
        "Job not found",
        "This listing is no longer available.",
        '<a class="btn btn-primary" href="#jobs">Find jobs</a>',
      ),
    );
  const person = user();
  const applied = db.applications.some(
    (app) => app.jobId === id && app.userId === person?.id,
  );
  shell(
    `<a class="back-link" href="#jobs">${icon("back")} Back to jobs</a><div class="detail-layout"><article class="panel detail-copy"><div class="detail-header"><div class="job-top">${logo(job)}<div><strong>${e(job.company)}</strong><div class="posted">${posted(job.createdAt)}</div></div></div><h1>${e(job.title)}</h1><div class="job-meta"><span>${icon("pin")}${e(job.location)}</span><span>${e(job.arrangement)}</span><span>${e(job.type)}</span></div><div class="tags">${job.tags.map((tag) => `<span class="tag">${e(tag)}</span>`).join("")}</div></div><h2>About the role</h2><p class="application-note">${e(job.description)}</p><h2>What you’ll do</h2><ul>${job.responsibilities.map((item) => `<li>${e(item)}</li>`).join("")}</ul><h2>What you’ll bring</h2><ul>${job.requirements.map((item) => `<li>${e(item)}</li>`).join("")}</ul>${isOpen(job) ? preparationChecklist(job.id) : ""}</article><aside><div class="panel"><h2>At a glance</h2><dl class="facts"><div><dt>Annual salary · CAD</dt><dd>${salary(job)}</dd></div><div><dt>Experience</dt><dd>${e(job.level)}</dd></div><div><dt>Field of work</dt><dd>${e(job.category)}</dd></div><div><dt>Apply by</dt><dd>${date(job.deadline)}</dd></div></dl><div class="form-actions">${person?.role === "recruiter" ? (job.ownerId === person.id ? `<a class="btn btn-primary wide" href="#edit-job/${job.id}">Edit posting</a>` : '<span class="hint">Sign in as a job seeker to apply.</span>') : `<button class="btn btn-primary wide" data-action="apply" data-id="${id}" ${applied || !isOpen(job) ? "disabled" : ""}>${applied ? "Application submitted" : !isOpen(job) ? "Applications closed" : "Apply for this job " + icon("arrow")}</button>`}</div>${person?.role !== "recruiter" ? `<button class="btn btn-text wide" data-action="save" data-id="${id}">${icon("bookmark")}${person?.saved?.includes(id) ? "Remove from saved" : "Save for later"}</button>` : ""}${applied ? '<a href="#applications" class="btn btn-text wide">Track your application</a>' : ""}</div></aside></div>`,
  );
}
function renderAuth(mode) {
  const register = mode === "register";
  shell(
    `<div class="auth-wrap"><a class="back-link" href="#jobs">${icon("back")} Back to jobs</a><section class="panel"><div class="eyebrow">${register ? "A fresh start" : "Good to see you"}</div><h1>${register ? "Create your account" : "Welcome back."}</h1><p>${register ? "Keep your next opportunity within reach." : "Pick up where you left off."}</p><form id="auth-form" data-mode="${mode}">${register ? '<label>Full name<input name="name" autocomplete="name" required maxlength="80" placeholder="Your name"></label>' : ""}<label>Email address<input name="email" type="email" autocomplete="email" required maxlength="120" placeholder="you@example.com"></label><label>Password<input name="password" type="password" autocomplete="${register ? "new-password" : "current-password"}" required ${register ? 'minlength="8"' : ""} maxlength="128" placeholder="${register ? "At least 8 characters" : "Your password"}"></label>${register ? '<p class="form-heading">I’m here to</p><div class="role-options"><label><input type="radio" name="role" value="seeker" checked> Find a job</label><label><input type="radio" name="role" value="recruiter"> Hire people</label></div>' : ""}<p class="error" id="form-error" role="alert"></p><button class="btn btn-primary wide">${register ? "Create account" : "Log in"} ${icon("arrow")}</button></form><p class="auth-switch">${register ? 'Already have an account? <a href="#login">Log in</a>' : 'New to CareerConnect? <a href="#register">Create an account</a>'}</p></section><p class="hint">Accounts stay available after the server restarts. Profiles and documents stay in this browser. Use a password unique to this site.</p></div>`,
  );
}
async function authenticate(mode, values) {
  let response;
  try {
    const apiBasePath = window.CareerConnectConfig?.apiBasePath || "/api";
    response = await fetch(`${apiBasePath}/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
  } catch {
    throw new Error("Cannot reach the server. Start it with node server.js and open http://127.0.0.1:3000.");
  }
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Open the website through the Node server at http://127.0.0.1:3000.");
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The server sent an invalid response. Please try again.");
  }
  if (!response.ok) throw new Error(result.message || "Unable to sign in. Please try again.");
  return result.user;
}
function renderProfile() {
  const person = user();
  const profile = person.profile || {};
  const field = (label, name, type = "text") =>
    `<label>${label}<input name="${name}" type="${type}" value="${e(profile[name])}" maxlength="${name === "skills" ? 300 : 160}"></label>`;
  shell(
    `<div class="page-title"><div><div class="eyebrow">A little about you</div><h1>My profile</h1><p>Keep your details ready for your next move.</p></div>${badge(person.role === "recruiter" ? "Recruiter" : "Job seeker")}</div><div class="profile-layout"><section class="panel"><h2>Your details</h2><form id="profile-form"><div class="form-grid"><label>Full name<input name="name" required maxlength="80" autocomplete="name" value="${e(person.name)}"></label><label>Email address<input type="email" value="${e(person.email)}" disabled><span class="hint">Your account email</span></label>${field("Location", "location")}${field("Phone number", "phone", "tel")}${field(person.role === "recruiter" ? "Company" : "Professional headline", person.role === "recruiter" ? "company" : "headline")}${field("Website or portfolio", "website", "url")}<label class="full">${person.role === "recruiter" ? "About your company" : "About you"}<textarea name="bio" maxlength="2000" placeholder="${person.role === "recruiter" ? "Tell candidates about your team." : "A short introduction to your background and interests."}">${e(profile.bio)}</textarea></label>${person.role === "seeker" ? `<label class="full">Skills<input name="skills" value="${e(profile.skills)}" maxlength="300" placeholder="JavaScript, communication, project management"><span class="hint">Separate skills with commas.</span></label>` : ""}</div><p id="form-error" class="error" role="alert"></p><div class="form-actions"><button class="btn btn-primary">Save profile</button><span class="hint">${profile.updatedAt ? "Last updated " + date(profile.updatedAt) : "Your profile hasn’t been saved yet."}</span></div></form></section><aside>${person.role === "seeker" ? `<section class="panel"><h2>My resumes</h2><p class="small">Choose the right resume for each application.</p><div>${(person.resumes || []).map((resume) => `<div class="resume-item">${icon("file")} <strong>${e(resume.name)}</strong><div class="hint">${Math.ceil(resume.size / 1024)} KB · ${date(resume.createdAt)}</div><div class="resume-actions"><button type="button" data-action="preview-resume" data-id="${resume.id}">Preview</button><button type="button" data-action="download-resume" data-id="${resume.id}">Download</button><button type="button" data-action="replace-resume" data-id="${resume.id}">Replace</button><button type="button" data-action="delete-resume" data-id="${resume.id}">Remove</button></div></div>`).join("") || '<p class="small">No resumes uploaded yet.</p>'}</div><form id="resume-form" class="upload"><label for="resume-file">Upload a resume</label><input type="file" id="resume-file" name="resume" accept=".pdf,.doc,.docx" required><div class="hint">PDF, DOC, or DOCX. Up to 5 MB.<br>Use PDF for in-page preview.<br>Maximum 5 resumes.</div><p class="error" id="resume-error" role="alert"></p><button class="btn btn-secondary wide" type="submit">Upload resume</button></form></section>` : '<section class="panel"><h2>Ready to hire?</h2><p class="small">Give candidates a clear picture of the role and your team.</p><a href="#new-job" class="btn btn-primary wide">Post a job</a></section>'}</aside></div>`,
  );
}
function renderResumeFeedback() {
  shell(
    `<a class="back-link" href="#profile">${icon("back")} Back to profile</a><div class="page-title"><div><div class="eyebrow">AI resume feedback</div><h1>Make your resume clearer.</h1><p>Paste the text you want reviewed. Your API key stays on the server and the feedback is not saved.</p></div></div><section class="panel"><form id="resume-feedback-form"><label>Target role <span class="hint">(optional)</span><input name="targetRole" maxlength="120" placeholder="e.g. Junior software developer"></label><label class="full">Resume text<textarea name="resumeText" required maxlength="8000" rows="18" placeholder="Paste your resume text here. Do not include information you would not want to send to an AI service."></textarea><span class="hint">Up to 8,000 characters. Review the result and make your own decisions.</span></label><p class="error" role="alert"></p><div class="form-actions"><button class="btn btn-primary">Get feedback ${icon("arrow")}</button></div></form><section id="resume-feedback-result" class="application-note" hidden aria-live="polite"></section></section>`,
  );
}
function renderSaved() {
  const jobs = db.jobs.filter((job) => user().saved.includes(job.id));
  shell(
    `<div class="page-title"><div><div class="eyebrow">Worth another look</div><h1>Saved jobs</h1><p>${jobs.length} ${jobs.length === 1 ? "opportunity" : "opportunities"} on your shortlist.</p></div><a href="#jobs" class="btn btn-secondary">Browse jobs ${icon("arrow")}</a></div><div class="profile-layout"><section>${jobs.length ? jobs.map(jobCard).join("") : empty("Keep a few possibilities close", "Use the bookmark on a job to save it here.", '<a href="#jobs" class="btn btn-primary">Find jobs</a>')}</section><aside class="panel"><h2>Upcoming deadlines</h2>${deadlineList(jobs)}</aside></div>`,
  );
}
function deadlineList(jobs) {
  const upcoming = jobs
    .filter(isOpen)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 5);
  return upcoming.length
    ? `<ul class="deadline-list">${upcoming.map((job) => `<li><a href="#job/${job.id}"><strong>${e(job.title)}</strong></a><span>${e(job.company)} · Apply by ${date(job.deadline)}</span>${Math.ceil((new Date(`${job.deadline}T23:59:59`) - Date.now()) / day) <= 7 ? '<div class="hint">Closing this week</div>' : ""}</li>`).join("")}</ul>`
    : '<p class="small">No upcoming deadlines for your saved jobs.</p>';
}
function renderApplications() {
  const all = db.applications.filter((app) => app.userId === user().id);
  const shown = all
    .filter(
      (app) => applicationFilter === "All" || app.status === applicationFilter,
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  shell(
    `<div class="page-title"><div><div class="eyebrow">Every step forward</div><h1>My applications</h1><p>Your search, with a little more perspective.</p></div><a class="btn btn-secondary" href="#jobs">Find more jobs ${icon("arrow")}</a></div><div class="stats">${statuses.map((status) => `<div class="stat"><strong>${all.filter((app) => app.status === status).length}</strong><span>${status}</span></div>`).join("")}</div><div class="profile-layout"><section><div class="toolbar"><h2>Application history</h2><select id="application-filter" aria-label="Filter applications by status">${["All", ...statuses].map((status) => `<option ${applicationFilter === status ? "selected" : ""}>${status}</option>`).join("")}</select></div>${
      shown
        .map((app) => {
          const job = db.jobs.find((j) => j.id === app.jobId);
          return `<article class="application">${logo(job)}<div class="grow"><h3><a href="#job/${job.id}">${e(job.title)}</a></h3><p>${e(job.company)} · Applied ${date(app.createdAt)}</p><div class="history">${app.history.map((item) => `${e(item.status)} · ${date(item.date)}`).join(" → ")}</div></div>${badge(app.status)}</article>`;
        })
        .join("") ||
      empty(
        all.length
          ? "No applications with this status"
          : "Your next chapter starts with one application",
        all.length
          ? "Choose another status to see your applications."
          : "Find a role you like and send your first application.",
      )
    } </section><aside class="panel"><h2>On your radar</h2>${deadlineList(db.jobs.filter((job) => user().saved.includes(job.id) && !all.some((app) => app.jobId === job.id)))}</aside></div>`,
  );
}
function renderPostings() {
  const jobs = db.jobs
    .filter((job) => job.ownerId === user().id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  shell(
    `<div class="page-title"><div><div class="eyebrow">Build your team</div><h1>My job postings</h1><p>Give good people a place to do good work.</p></div><a href="#new-job" class="btn btn-primary">+ Post a job</a></div>${jobs.map((job) => `<article class="job-card recruiter-job"><div class="job-top">${logo(job)}<div class="grow"><h3><a href="#job/${job.id}">${e(job.title)}</a></h3><p>${e(job.company)} · ${e(job.location)} · ${e(job.type)}</p></div></div><div class="card-bottom"><div class="inline-actions">${badge(isOpen(job) ? "Open" : "Closed")}<span class="small muted">${db.applications.filter((app) => app.jobId === job.id).length} applicants · Closes ${date(job.deadline)}</span></div><div class="inline-actions"><a class="btn btn-text" href="#candidates/${job.id}">View applicants</a><a class="btn btn-secondary" href="#edit-job/${job.id}">Edit</a><button class="btn btn-secondary" data-action="toggle-job" data-id="${job.id}">${job.status === "Open" ? "Close" : "Reopen"}</button></div></div></article>`).join("") || empty("Your first hire starts here", "Post a role with the details candidates need to apply.", '<a href="#new-job" class="btn btn-primary">Create a job posting</a>')}`,
  );
}
function selectField(label, name, options, value) {
  return `<label>${label}<select name="${name}" required>${options.map((option) => `<option ${value === option ? "selected" : ""}>${option}</option>`).join("")}</select></label>`;
}
function renderJobForm(id) {
  const existing = id
    ? db.jobs.find((job) => job.id === id && job.ownerId === user().id)
    : null;
  if (id && !existing)
    return shell(
      empty("Posting not found", "You can only edit your own postings."),
    );
  const job = existing || {
    company: user().profile?.company || "",
    location: user().profile?.location || "",
    tags: [],
    responsibilities: [],
    requirements: [],
  };
  shell(
    `<a class="back-link" href="#postings">${icon("back")} My postings</a><div class="page-title"><div><h1>${existing ? "Edit job posting" : "Make room for someone new."}</h1><p>${existing ? "Keep the details of this opportunity up to date." : "Start with the role. Be specific about what matters."}</p></div></div><section class="panel"><form id="job-form" data-id="${id || ""}"><div class="form-grid"><label>Job title<input name="title" required maxlength="100" value="${e(job.title)}" placeholder="e.g. Junior Frontend Developer"></label><label>Company<input name="company" required maxlength="80" value="${e(job.company)}"></label><label>Location<input name="location" required maxlength="100" value="${e(job.location)}" placeholder="City, province"></label>${selectField("Workplace", "arrangement", ["On-site", "Hybrid", "Remote"], job.arrangement)}${selectField("Job type", "type", ["Full-time", "Part-time", "Internship", "Contract"], job.type)}${selectField("Experience level", "level", ["Entry level", "Mid level", "Senior level"], job.level)}${selectField("Field of work", "category", ["Technology", "Design", "Marketing", "Business", "Other"], job.category)}<label>Application deadline<input type="date" name="deadline" min="${today()}" value="${job.deadline || ""}" required></label><label>Minimum annual salary (CAD)<input type="number" name="min" min="1" max="1000000" required value="${job.min || ""}"></label><label>Maximum annual salary (CAD)<input type="number" name="max" min="1" max="1000000" required value="${job.max || ""}"></label><label class="full">About the role<textarea name="description" required maxlength="5000">${e(job.description)}</textarea></label><label>Responsibilities<textarea name="responsibilities" required maxlength="3000" placeholder="One item per line">${e(job.responsibilities.join("\n"))}</textarea></label><label>Requirements<textarea name="requirements" required maxlength="3000" placeholder="One item per line">${e(job.requirements.join("\n"))}</textarea></label><label class="full">Skills or keywords<input name="tags" maxlength="200" value="${e(job.tags.join(", "))}" placeholder="JavaScript, HTML & CSS, Git"><span class="hint">Separate with commas. Up to 6 tags.</span></label></div><p id="form-error" class="error" role="alert"></p><div class="form-actions"><button class="btn btn-primary">${existing ? "Save changes" : "Publish job"}</button><a class="btn btn-secondary" href="#postings">Cancel</a></div></form></section>`,
  );
}
function renderCandidates() {
  const selectedId = location.hash.split("/")[1] || "";
  const jobs = db.jobs.filter((job) => job.ownerId === user().id);
  const apps = db.applications
    .filter(
      (app) =>
        jobs.some((job) => job.id === app.jobId) &&
        (!selectedId || app.jobId === selectedId),
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  shell(
    `<div class="page-title"><div><div class="eyebrow">Meet your next teammate</div><h1>Applications</h1><p>Review candidates and keep them in the loop.</p></div></div><div class="toolbar"><span class="muted">${apps.length} ${apps.length === 1 ? "application" : "applications"}</span><select id="candidate-job" aria-label="Filter by job posting"><option value="">All postings</option>${jobs.map((job) => `<option value="${job.id}" ${selectedId === job.id ? "selected" : ""}>${e(job.title)}</option>`).join("")}</select></div>${
      apps
        .map((app) => {
          const job = jobs.find((job) => job.id === app.jobId);
          return `<article class="application"><span class="avatar">${e(app.name.slice(0, 1))}</span><div class="grow"><h3>${e(app.name)}</h3><p>${e(job.title)} · ${date(app.createdAt)}</p></div>${badge(app.status)}<button class="btn btn-secondary" data-action="review" data-id="${app.id}">Review application</button></article>`;
        })
        .join("") ||
      empty(
        "No applications yet",
        "Applications to your postings will appear here.",
      )
    }`,
  );
}
let resumePreviewUrl = null;
function clearResumePreview() {
  modal.querySelector(".resume-preview-frame")?.remove();
  if (resumePreviewUrl) URL.revokeObjectURL(resumePreviewUrl);
  resumePreviewUrl = null;
  modal.classList.remove("resume-preview-modal");
}
modal.addEventListener("close", () => {
  // A queued close event must not clear a newly opened dialog.
  if (!modal.open) clearResumePreview();
});
function openModal(content) {
  clearResumePreview();
  document.querySelector("#modal-content").innerHTML =
    '<button class="modal-close" data-action="close-modal" aria-label="Close dialog">×</button>' +
    content;
  modal.showModal();
}
function applyModal(id) {
  const person = user();
  if (!person) {
    navigate("login");
    toast("Log in or create an account to apply.");
    return;
  }
  if (person.role !== "seeker") return;
  const job = db.jobs.find((job) => job.id === id);
  if (
    !job ||
    !isOpen(job) ||
    db.applications.some((app) => app.userId === person.id && app.jobId === id)
  )
    return;
  if (!person.resumes.length) {
    navigate("profile");
    toast("Upload a resume before applying.");
    return;
  }
  openModal(
    `<div class="eyebrow">Take the next step</div><h2 id="modal-title">Apply for ${e(job.title)}</h2><p>${e(job.company)} · ${e(job.location)}</p><form id="apply-form" data-id="${id}" class="modal-fields"><label>Your name<input name="name" required maxlength="80" value="${e(person.name)}"></label><label>Contact email<input type="email" name="email" required value="${e(person.email)}"></label><label>Resume<select name="resume" required>${person.resumes.map((resume) => `<option value="${resume.id}">${e(resume.name)}</option>`).join("")}</select></label><label>A note to the hiring team <span class="hint">(optional)</span><textarea name="note" maxlength="2000" placeholder="What interests you about this role?"></textarea></label><p class="hint">Your contact details, profile, and selected resume will be included.</p><p id="form-error" class="error" role="alert"></p><div class="form-actions"><button class="btn btn-primary">Submit application ${icon("arrow")}</button><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button></div></form>`,
  );
}
function replaceResumeModal(id) {
  const person = user();
  const resume = person?.resumes.find((item) => item.id === id);
  if (person?.role !== "seeker" || !resume) return;
  openModal(
    `<h2 id="modal-title">Replace resume</h2><p>Choose a new file to replace <strong>${e(resume.name)}</strong>. Applications already submitted will keep their original copy.</p><form id="replace-resume-form" data-id="${e(id)}" class="modal-fields"><label for="replacement-resume">New resume file<input type="file" id="replacement-resume" name="resume" accept=".pdf,.doc,.docx" required></label><p class="hint">PDF, DOC, or DOCX. Up to 5 MB.</p><p class="error" role="alert"></p><div class="form-actions"><button class="btn btn-primary">Replace resume</button><button type="button" class="btn btn-secondary" data-action="close-modal">Cancel</button></div></form>`,
  );
}
function reviewModal(id) {
  const app = db.applications.find((app) => app.id === id);
  const job = db.jobs.find(
    (job) => job.id === app?.jobId && job.ownerId === user()?.id,
  );
  if (!app || !job) return;
  openModal(
    `<div class="eyebrow">${e(job.title)}</div><h2 id="modal-title">${e(app.name)}</h2><p>${e(app.email)}</p>${app.profile?.headline ? `<h3>${e(app.profile.headline)}</h3>` : ""}${app.profile?.bio ? `<p class="application-note">${e(app.profile.bio)}</p>` : ""}${app.profile?.skills ? `<p class="small">Skills: ${e(app.profile.skills)}</p>` : ""}${app.profile?.location ? `<p class="small">${e(app.profile.location)}</p>` : ""}<button class="btn btn-secondary" data-action="download-application" data-id="${app.id}">${icon("file")} Download resume</button><h3 style="margin-top:24px">Candidate’s note</h3><p class="application-note">${e(app.note || "No note included.")}</p><form id="status-form" data-id="${id}">${selectField("Application status", "status", statuses, app.status)}<div class="history">${app.history.map((item) => `${e(item.status)} · ${date(item.date)}`).join("<br>")}</div><p id="form-error" class="error" role="alert"></p><div class="form-actions"><button class="btn btn-primary">Update status</button><button type="button" class="btn btn-secondary" data-action="close-modal">Close</button></div></form>`,
  );
}
// Keep resume files in IndexedDB rather than filling localStorage with file data.
let fileDatabase;
function openFiles() {
  if (!fileDatabase)
    fileDatabase = new Promise((resolve, reject) => {
      const request = indexedDB.open("careerconnect-files", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("files");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(new Error("Resume storage is unavailable in this browser."));
    });
  return fileDatabase;
}
async function fileOperation(action, key, value) {
  const database = await openFiles();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      "files",
      action === "get" ? "readonly" : "readwrite",
    );
    const store = transaction.objectStore("files");
    const request =
      action === "put"
        ? store.put(value, key)
        : action === "delete"
          ? store.delete(key)
          : store.get(key);
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () =>
      reject(
        new Error(
          "Could not access resume storage. Check the available browser storage.",
        ),
      );
    transaction.onabort = () =>
      reject(new Error("Resume storage was interrupted. Please try again."));
  });
}
async function previewResume(id) {
  const person = user();
  const resume = person?.resumes.find((item) => item.id === id);
  if (person?.role !== "seeker" || !resume) return;
  openModal(
    `<h2 id="modal-title">Resume preview</h2><p class="resume-preview-name">${e(resume.name)}</p><div id="resume-preview-body" aria-live="polite"><p role="status">Loading resume…</p></div><div class="form-actions"><button type="button" class="btn btn-secondary" data-action="download-resume" data-id="${e(id)}">Download</button><button type="button" class="btn btn-secondary" data-action="close-modal">Close</button></div>`,
  );
  modal.classList.add("resume-preview-modal");
  const body = document.querySelector("#resume-preview-body");
  try {
    const file = await fileOperation("get", id);
    // Ignore reads that finish after closing, navigating, or switching previews.
    if (!modal.open || !body.isConnected || user()?.id !== person.id) return;
    if (!file) throw new Error("This resume is no longer available in this browser. Please upload it again.");
    if (!/\.pdf$/i.test(resume.name)) {
      body.textContent = "Word documents cannot be previewed here. Upload a PDF copy to preview your resume on this page, or download the original below.";
      return;
    }
    if (navigator.pdfViewerEnabled === false) {
      body.textContent = "This browser does not support PDF preview. You can download your resume below.";
      return;
    }
    resumePreviewUrl = URL.createObjectURL(new Blob([file], { type: "application/pdf" }));
    const frame = document.createElement("iframe");
    frame.className = "resume-preview-frame";
    frame.title = `Resume preview: ${resume.name}`;
    frame.src = resumePreviewUrl;
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "If the preview does not display, use Download below.";
    body.replaceChildren(frame, hint);
  } catch (error) {
    if (modal.open && body.isConnected) {
      body.textContent = error.message;
      body.setAttribute("role", "alert");
    }
  }
}
async function downloadFile(key, name) {
  const file = await fileOperation("get", key);
  if (!file)
    throw new Error("This resume is no longer available in this browser.");
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
async function validateResumeFile(file) {
  if (!file?.size) throw new Error("Choose a non-empty resume file.");
  if (!/\.(pdf|doc|docx)$/i.test(file.name))
    throw new Error("Choose a PDF, DOC, or DOCX file.");
  if (file.size > 5 * 1024 * 1024)
    throw new Error("The file is too large. The limit is 5 MB.");
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const ext = file.name.split(".").pop().toLowerCase();
  const valid =
    ext === "pdf"
      ? String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-"
      : ext === "docx"
        ? bytes[0] === 0x50 && bytes[1] === 0x4b
        : bytes[0] === 0xd0 &&
          bytes[1] === 0xcf &&
          bytes[2] === 0x11 &&
          bytes[3] === 0xe0;
  if (!valid)
    throw new Error(
      "The file content does not match its extension. Choose a valid document.",
    );
}
async function handleSubmit(form) {
  const values = Object.fromEntries(new FormData(form));
  if (form.id === "search-form") {
    filters.query = values.query;
    filters.location = values.location;
    updateResults();
    return;
  }
  if (form.id === "auth-form") {
    const mode = form.dataset.mode;
    if (mode === "register" && !values.name.trim()) throw new Error("Please enter your name.");
    const account = await authenticate(mode, values);
    let person = db.users.find((item) => item.id === account.id);
    if (!person) {
      person = { ...account, profile: {}, resumes: [], saved: [], preparationChecklists: {} };
      db.users.push(person);
    }
    // Cache public details only for the existing frontend workflows.
    delete person.password;
    delete person.salt;
    persist();
    setSession(person.id);
    navigate(mode === "register" ? "profile" : person.role === "recruiter" ? "postings" : "jobs");
    toast(mode === "register" ? "Your account is ready. Make yourself at home." : "Welcome back, " + person.name.split(" ")[0] + ".");
  } else if (form.id === "profile-form") {
    if (!values.name.trim()) throw new Error("Please enter your name.");
    if (values.website && !/^https?:\/\//i.test(values.website))
      throw new Error(
        "Use a website address starting with https:// or http://.",
      );
    const person = user();
    person.name = values.name.trim();
    person.profile = { ...values, updatedAt: new Date().toISOString() };
    delete person.profile.name;
    persist();
    render();
    toast("Profile saved.");
  } else if (form.id === "resume-form") {
    const file = values.resume;
    if (user().resumes.length >= 5)
      throw new Error(
        "You can keep up to 5 resumes. Remove one before uploading another.",
      );
    await validateResumeFile(file);
    const id = uid();
    await fileOperation("put", id, file);
    user().resumes.push({
      id,
      name: file.name,
      size: file.size,
      createdAt: new Date().toISOString(),
    });
    try {
      persist();
    } catch (error) {
      await fileOperation("delete", id);
      throw error;
    }
    render();
    toast("Resume uploaded.");
  } else if (form.id === "replace-resume-form") {
    const person = user();
    const index = person?.resumes.findIndex(
      (resume) => resume.id === form.dataset.id,
    );
    if (person?.role !== "seeker" || index < 0)
      throw new Error("This resume is no longer available.");
    const file = values.resume;
    await validateResumeFile(file);
    const previous = person.resumes[index];
    const previousFile = await fileOperation("get", previous.id);
    await fileOperation("put", previous.id, file);
    person.resumes[index] = {
      id: previous.id,
      name: file.name,
      size: file.size,
      createdAt: new Date().toISOString(),
    };
    try {
      persist();
    } catch (error) {
      person.resumes[index] = previous;
      try {
        if (previousFile) await fileOperation("put", previous.id, previousFile);
        else await fileOperation("delete", previous.id);
      } catch {}
      throw error;
    }
    modal.close();
    render();
    toast("Resume replaced.");
  } else if (form.id === "resume-feedback-form") {
    if (user()?.role !== "seeker") throw new Error("Resume feedback is available to job seekers.");
    const apiBasePath = window.CareerConnectConfig?.apiBasePath || "/api";
    let response;
    try {
      response = await fetch(`${apiBasePath}/resume-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: values.resumeText, targetRole: values.targetRole }),
      });
    } catch {
      throw new Error("Resume feedback is temporarily unavailable. Please try again later.");
    }
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("Resume feedback returned an unexpected response. Please try again later.");
    }
    if (!response.ok) throw new Error(result.message || "Resume feedback is temporarily unavailable. Please try again later.");
    const output = form.parentElement.querySelector("#resume-feedback-result");
    output.textContent = result.feedback;
    output.hidden = false;
    toast("Your resume feedback is ready.");
  } else if (form.id === "job-form") {
    if (user()?.role !== "recruiter") return;
    for (const key of [
      "title",
      "company",
      "location",
      "description",
      "responsibilities",
      "requirements",
    ])
      if (!values[key].trim())
        throw new Error("Please complete all required fields.");
    if (+values.max < +values.min)
      throw new Error(
        "The maximum salary must be at least the minimum salary.",
      );
    if (values.deadline < today())
      throw new Error("Choose today or a future date for the deadline.");
    const fields = {
      ...values,
      min: +values.min,
      max: +values.max,
      tags: values.tags
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 6),
      responsibilities: values.responsibilities
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean),
      requirements: values.requirements
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean),
      initials: values.company.trim().slice(0, 2).toLowerCase(),
    };
    if (form.dataset.id) {
      const job = db.jobs.find(
        (job) => job.id === form.dataset.id && job.ownerId === user().id,
      );
      if (!job) throw new Error("This posting is not available.");
      Object.assign(job, fields);
    } else
      db.jobs.push({
        ...fields,
        id: uid(),
        ownerId: user().id,
        color: "green",
        status: "Open",
        createdAt: new Date().toISOString(),
      });
    persist();
    navigate("postings");
    toast(
      form.dataset.id
        ? "Job posting updated."
        : "Your job is now open for applications.",
    );
  } else if (form.id === "apply-form") {
    const person = user();
    const job = db.jobs.find((job) => job.id === form.dataset.id);
    if (person?.role !== "seeker" || !job || !isOpen(job))
      throw new Error("This job is no longer accepting applications.");
    if (
      db.applications.some(
        (app) => app.userId === person.id && app.jobId === job.id,
      )
    )
      throw new Error("You have already applied for this job.");
    if (!values.name.trim()) throw new Error("Please enter your name.");
    const resume = person.resumes.find((resume) => resume.id === values.resume);
    if (!resume) throw new Error("Choose a resume.");
    const file = await fileOperation("get", resume.id);
    if (!file)
      throw new Error(
        "The resume file is missing. Upload it again from your profile.",
      );
    const id = uid();
    const fileId = "application-" + id;
    await fileOperation("put", fileId, file);
    const now = new Date().toISOString();
    db.applications.push({
      id,
      jobId: job.id,
      userId: person.id,
      name: values.name.trim(),
      email: values.email.trim(),
      note: values.note,
      profile: { ...person.profile },
      resumeName: resume.name,
      resumeId: fileId,
      status: "Applied",
      createdAt: now,
      history: [{ status: "Applied", date: now }],
    });
    try {
      persist();
    } catch (error) {
      await fileOperation("delete", fileId);
      throw error;
    }
    modal.close();
    navigate("applications");
    toast("Application sent. Good luck!");
  } else if (form.id === "status-form") {
    const app = db.applications.find((app) => app.id === form.dataset.id);
    if (
      !app ||
      !db.jobs.some(
        (job) => job.id === app.jobId && job.ownerId === user()?.id,
      ) ||
      !statuses.includes(values.status)
    )
      throw new Error("You cannot update this application.");
    if (app.status !== values.status) {
      app.status = values.status;
      app.history.push({
        status: values.status,
        date: new Date().toISOString(),
      });
      persist();
    }
    modal.close();
    render();
    toast("Application status updated.");
  } else if (form.id === "remove-resume-form") {
    const resume = user().resumes.find(
      (resume) => resume.id === form.dataset.id,
    );
    if (!resume) return;
    user().resumes = user().resumes.filter((item) => item.id !== resume.id);
    persist();
    await fileOperation("delete", resume.id);
    modal.close();
    render();
    toast("Resume removed. Submitted applications keep their copy.");
  }
}
document.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const error = form.querySelector(".error");
  if (error) error.textContent = "";
  const button = form.querySelector(
    'button[type="submit"], button:not([type])',
  );
  if (button) button.disabled = true;
  try {
    await handleSubmit(form);
  } catch (problem) {
    if (error) error.textContent = problem.message;
    else toast(problem.message);
  } finally {
    if (button) button.disabled = false;
  }
});
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  try {
    if (action === "logout") {
      setSession(null);
      navigate("jobs");
      toast("You’re logged out.");
    } else if (action === "close-modal") modal.close();
    else if (action === "filters") {
      const open = document.querySelector("#filters").classList.toggle("open");
      button.setAttribute("aria-expanded", open);
    } else if (action === "clear-filters") {
      filters = {
        query: "",
        location: "",
        types: [],
        arrangements: [],
        levels: [],
        category: "",
        sort: "newest",
      };
      renderJobs();
    } else if (action === "popular") {
      filters.query = button.dataset.term;
      document.querySelector('[name="query"]').value = filters.query;
      updateResults();
    } else if (action === "save") {
      if (!user()) {
        navigate("login");
        toast("Log in to keep a list of saved jobs.");
        return;
      }
      if (user().role !== "seeker") return;
      const saved = user().saved.includes(id);
      user().saved = saved
        ? user().saved.filter((item) => item !== id)
        : [...user().saved, id];
      persist();
      const route = location.hash.slice(1).split("/")[0];
      if (route === "jobs" || !route) updateResults();
      else render();
      toast(saved ? "Job removed from saved." : "Job saved for later.");
    } else if (action === "apply") applyModal(id);
    else if (action === "review") reviewModal(id);
    else if (action === "preview-resume") await previewResume(id);
    else if (action === "replace-resume") replaceResumeModal(id);
    else if (action === "download-resume") {
      const resume = user()?.resumes.find((resume) => resume.id === id);
      if (resume) await downloadFile(id, resume.name);
    } else if (action === "download-application") {
      const app = db.applications.find((app) => app.id === id);
      if (
        app &&
        db.jobs.some(
          (job) => job.id === app.jobId && job.ownerId === user()?.id,
        )
      )
        await downloadFile(app.resumeId, app.resumeName);
    } else if (action === "delete-resume") {
      const resume = user()?.resumes.find((resume) => resume.id === id);
      if (resume)
        openModal(
          `<h2 id="modal-title">Remove this resume?</h2><p>${e(resume.name)} will be removed from your profile. Applications you already sent will keep their own copy.</p><form id="remove-resume-form" data-id="${id}"><p class="error" role="alert"></p><div class="form-actions"><button class="btn btn-danger">Remove resume</button><button type="button" class="btn btn-secondary" data-action="close-modal">Keep resume</button></div></form>`,
        );
    } else if (action === "toggle-job") {
      const job = db.jobs.find(
        (job) => job.id === id && job.ownerId === user()?.id,
      );
      if (!job) return;
      if (job.status === "Closed" && job.deadline < today()) {
        navigate("edit-job/" + id);
        toast("Update the deadline before reopening this job.");
        return;
      }
      job.status = job.status === "Open" ? "Closed" : "Open";
      persist();
      render();
      toast("Posting " + job.status.toLowerCase() + ".");
    }
  } catch (error) {
    toast(error.message);
  }
});
document.addEventListener("change", (event) => {
  const input = event.target;
  if (input.dataset.action === "toggle-checklist") {
    const person = user();
    const job = db.jobs.find((item) => item.id === input.dataset.id);
    const step = input.dataset.step;
    if (
      !person ||
      person.role !== "seeker" ||
      !job ||
      !isOpen(job) ||
      !preparationSteps.some(([key]) => key === step)
    ) {
      input.checked = false;
      toast("This checklist is only available to job seekers for open jobs.");
      return;
    }
    person.preparationChecklists ||= {};
    const completed = person.preparationChecklists[job.id] || [];
    person.preparationChecklists[job.id] = input.checked
      ? [...new Set([...completed, step])]
      : completed.filter((key) => key !== step);
    try {
      persist();
      renderDetail(job.id);
    } catch (error) {
      toast(error.message);
      renderDetail(job.id);
    }
    return;
  }
  if (input.closest("#filters") && input.type === "checkbox") {
    filters[input.name] = [
      ...document.querySelectorAll(
        `#filters input[name="${input.name}"]:checked`,
      ),
    ].map((item) => item.value);
    updateResults();
  }
  if (input.id === "category") {
    filters.category = input.value;
    updateResults();
  }
  if (input.id === "sort") {
    filters.sort = input.value;
    updateResults();
  }
  if (input.id === "application-filter") {
    applicationFilter = input.value;
    renderApplications();
  }
  if (input.id === "candidate-job")
    navigate("candidates" + (input.value ? "/" + input.value : ""));
});
window.addEventListener("hashchange", () => {
  render();
  window.scrollTo(0, 0);
  main.focus({ preventScroll: true });
});
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY) {
    db = loadData();
    render();
  }
});
render();
if (storageWarning) toast(storageWarning);
