const { Postgres } = require("./postgres");
const { randomBytes, createHash } = require("node:crypto");
const { validateEmail } = require("./auth/validation");

const statuses = ["Applied", "Under Review", "Interview", "Offered", "Rejected"];
const profileFields = ["location", "phone", "company", "headline", "website", "bio", "skills"];
const jobFields = ["title", "company", "location", "type", "arrangement", "level", "category", "min", "max", "description", "responsibilities", "requirements", "tags", "initials", "color", "status", "deadline"];
const jobLists = ["responsibilities", "requirements", "tags"];
function fail(message, status = 400) { throw { status, message }; }
function text(value, label, limit = 160, required = false) {
  if (typeof value !== "string" || value.length > limit || (required && !value.trim())) fail(`Enter a valid ${label}.`);
  return value.trim();
}
function id(value) { return text(value, "ID", 100, true); }
function tokenHash(token) { return createHash("sha256").update(token).digest("hex"); }

class Database {
  constructor(config, pool) { this.sql = new Postgres(config, pool); }
  async initialize() {
    await this.sql.query("SELECT 1 FROM careerconnect.migrations WHERE name = '001-initial'").then(result => {
      if (!result.rows.length) throw new Error("Run npm run db:setup before starting the server.");
    });
  }
  transaction(work) { return this.sql.transaction(work); }
  close() { return this.sql.close(); }
  async findByEmail(email) {
    const row = (await this.sql.prepare("SELECT * FROM users WHERE email = lower(?)").get(email));
    if (!row) return null;
    const { id, name, role } = row;
    return { user: { id, name, email: row.email, role }, salt: row.salt, passwordHash: row.password_hash };
  }
  async add({ user, salt, passwordHash }) {
    return this.transaction(async () => {
      const result = await this.sql.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING")
        .run(user.id, user.name, user.email.toLowerCase(), user.role, salt, passwordHash);
      if (result.changes) await this.sql.prepare("INSERT INTO profiles (user_id) VALUES (?)").run(user.id);
      return Boolean(result.changes);
    });
  }
  async session(request) {
    const token = request.headers.cookie?.split(";").map(item => item.trim()).find(item => item.startsWith("careerconnect_session="))?.split("=")[1];
    if (!token) return null;
    return (await this.sql.prepare("SELECT users.id, users.name, users.email, users.role FROM sessions JOIN users ON users.id = sessions.user_id WHERE token = ? AND expires_at > ?")
      .get(tokenHash(token), Date.now())) || null;
  }
  async startSession(userId) {
    const token = randomBytes(32).toString("hex");
    (await this.sql.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now()));
    (await this.sql.prepare("INSERT INTO sessions VALUES (?, ?, ?)").run(tokenHash(token), userId, Date.now() + 7 * 86400000));
    return `careerconnect_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800`;
  }
  async endSession(request) {
    const token = request.headers.cookie?.split(";").map(item => item.trim()).find(item => item.startsWith("careerconnect_session="))?.split("=")[1];
    if (token) (await this.sql.prepare("DELETE FROM sessions WHERE token = ?").run(tokenHash(token)));
  }
  job(row) {
    const { owner_id, created_at, ...job } = row;
    for (const key of jobLists) job[key] = JSON.parse(job[key]);
    return { ...job, ownerId: owner_id, createdAt: created_at };
  }
  application(row) {
    return {
      id: row.id, jobId: row.job_id, userId: row.user_id, resumeId: row.resume_id,
      name: row.name, email: row.email, note: row.note, profile: JSON.parse(row.profile),
      resumeName: row.resume_name, status: row.status, createdAt: row.created_at, history: JSON.parse(row.history)
    };
  }
  async state(person) {
    const jobs = (await this.sql.prepare("SELECT * FROM jobs").all()).map(row => this.job(row));
    if (!person) return { users: [], jobs, applications: [], sessionId: null };
    const row = (await this.sql.prepare("SELECT * FROM profiles WHERE user_id = ?").get(person.id));
    const profile = Object.fromEntries(profileFields.map(key => [key, row[key]]));
    profile.updatedAt = row.updated_at;
    const resumes = (await this.sql.prepare("SELECT id, name, size, created_at AS \"createdAt\" FROM resumes WHERE user_id = ? AND listed = 1").all(person.id));
    const saved = (await this.sql.prepare("SELECT job_id FROM saved_jobs WHERE user_id = ?").all(person.id)).map(row => row.job_id);
    const applications = (await this.sql.prepare("SELECT applications.* FROM applications JOIN jobs ON jobs.id = applications.job_id WHERE applications.user_id = ? OR jobs.owner_id = ?")
      .all(person.id, person.id)).map(row => this.application(row));
    return { users: [{ ...person, profile, resumes, saved, preparationChecklists: JSON.parse(row.checklists) }], jobs, applications, sessionId: person.id };
  }
  async saveJob(job) {
    const columns = ["id", "owner_id", ...jobFields, "created_at"];
    const values = [job.id, job.ownerId, ...jobFields.map(key => jobLists.includes(key) ? JSON.stringify(job[key]) : job[key]), job.createdAt];
    (await this.sql.prepare(`INSERT INTO jobs (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")}) ON CONFLICT(id) DO UPDATE SET ${jobFields.map(key => `${key}=excluded.${key}`).join(",")}`).run(...values));
  }

  async save(person, changes) {
    if (!person) fail("Please log in.", 401);

    await this.transaction(async () => {
      await this.sql.query("SELECT pg_advisory_xact_lock(734192)");

      if (changes.person) {
        await this.saveProfile(person, changes.person);
      }

      for (const job of changes.jobs || []) {
        // Retrieve the previous owner and deadline.
        const old = await this.sql.prepare(
          "SELECT owner_id, deadline FROM jobs WHERE id = ?"
        ).get(id(job.id));

        if (
          person.role !== "recruiter" ||
          job.ownerId !== person.id ||
          (old && old.owner_id !== person.id)
        ) {
          fail("You cannot edit this job.", 403);
        }

        // Validate job fields.
        for (const key of jobFields.filter(
          key => !jobLists.includes(key) && !["min", "max"].includes(key)
        )) {
          text(job[key], key, key === "description" ? 10000 : 300, true);
        }

        for (const key of jobLists) {
          if (
            !Array.isArray(job[key]) ||
            job[key].length > 100 ||
            job[key].some(
              value => typeof value !== "string" || value.length > 2000
            )
          ) {
            fail(`Enter valid ${key}.`);
          }
        }

        if (
          !job.responsibilities.some(value => value.trim()) ||
          !job.requirements.some(value => value.trim())
        ) {
          fail("Complete the job responsibilities and requirements.");
        }

        if (
          !["Open", "Closed", "Archived"].includes(job.status) ||
          !Number.isFinite(job.min) ||
          !Number.isFinite(job.max) ||
          job.min < 0 ||
          job.max < job.min
        ) {
          fail("Enter valid job details and salary.");
        }

        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(job.deadline) ||
          !Number.isFinite(Date.parse(job.deadline))
        ) {
          fail("Enter a valid deadline.");
        }

        if (
          job.status === "Open" &&
          job.deadline < new Date().toISOString().slice(0, 10)
        ) {
          fail("Choose today or a future date for the deadline.");
        }

        // Detect a deadline change on an existing posting.
        const previousDeadline = old?.deadline instanceof Date
          ? old.deadline.toISOString().slice(0, 10)
          : old?.deadline
            ? String(old.deadline).slice(0, 10)
            : null;

        const deadlineChanged =
          previousDeadline !== null &&
          previousDeadline !== job.deadline;

        // Save the posting before generating notifications.
        await this.saveJob({
          ...job,
          createdAt: new Date().toISOString()
        });

        if (deadlineChanged) {
          // Notify seekers who saved this job or applied to it.
          const recipients = await this.sql.prepare(`
          SELECT user_id FROM saved_jobs WHERE job_id = ?
          UNION
          SELECT user_id FROM applications WHERE job_id = ?
        `).all(job.id, job.id);

          const now = new Date().toISOString();

          for (const recipient of recipients) {
            await this.sql.prepare(`
            INSERT INTO notifications
              (id, user_id, job_id, kind, title, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
              randomBytes(16).toString("hex"),
              recipient.user_id,
              job.id,
              "deadline_change",
              "Application deadline changed",
              `The application deadline for ${job.title} changed from ${previousDeadline} to ${job.deadline}.`,
              now
            );
          }

          console.log(
            `Deadline updated for ${job.title}: ${previousDeadline} -> ${job.deadline}`
          );
        }
      }

      for (const application of changes.applications || []) {
        await this.saveApplication(person, application);
      }
    });
  }

  async saveProfile(person, value) {
    if (value.id !== person.id) fail("You cannot change this profile.", 403);
    const name = text(value.name, "name", 80, true);
    const profile = value.profile || {};
    const values = profileFields.map(key => text(profile[key] || "", key, key === "bio" ? 2000 : key === "skills" ? 300 : 160));
    if (profile.website && !/^https?:\/\//i.test(profile.website)) fail("Use a website address starting with https:// or http://.");
    const checklists = value.preparationChecklists || {};
    if (!checklists || typeof checklists !== "object" || Array.isArray(checklists) || Object.values(checklists).some(list => !Array.isArray(list) || list.some(step => !["resume", "profile", "requirements", "note"].includes(step)))) fail("Invalid preparation checklist.");
    (await this.sql.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, person.id));
    (await this.sql.prepare(`UPDATE profiles SET ${profileFields.map(key => `${key}=?`).join(",")}, updated_at=?, checklists=? WHERE user_id=?`)
      .run(...values, new Date().toISOString(), JSON.stringify(checklists), person.id));
    if (!Array.isArray(value.saved) || value.saved.length > 10000) fail("Invalid saved jobs.");
    (await this.sql.prepare("DELETE FROM saved_jobs WHERE user_id = ?").run(person.id));
    for (const jobId of new Set(value.saved)) {
      if (!(await this.sql.prepare("SELECT 1 FROM jobs WHERE id = ?").get(id(jobId)))) fail("This saved job no longer exists.");
      (await this.sql.prepare("INSERT INTO saved_jobs VALUES (?, ?)").run(person.id, jobId));
    }
    if (!Array.isArray(value.resumes) || value.resumes.length > 5) fail("You can keep up to 5 resumes.");
    (await this.sql.prepare("UPDATE resumes SET listed = 0 WHERE user_id = ?").run(person.id));
    for (const resume of value.resumes) {
      const row = (await this.sql.prepare("SELECT user_id FROM resumes WHERE id = ?").get(id(resume.id)));
      if (!row || row.user_id !== person.id || (await this.sql.prepare("SELECT 1 FROM applications WHERE resume_id = ?").get(resume.id))) fail("This resume is unavailable.");
      (await this.sql.prepare("UPDATE resumes SET listed = 1 WHERE id = ?").run(resume.id));
    }
  }
  async notifications(person) {
    if (!person) fail("Please log in.", 401);
    // Deadline reminders are generated when a seeker checks notifications.
    if (person.role === "seeker") {
      const rows = await this.sql.prepare(`SELECT j.id, j.title, j.deadline FROM saved_jobs s
        JOIN jobs j ON j.id = s.job_id WHERE s.user_id = ? AND j.status = 'Open'`).all(person.id);
      const now = new Date();
      for (const job of rows) {
        const end = new Date(job.deadline + 'T23:59:59Z');
        const days = (end - now) / 86400000;
        if (days >= 0 && days <= 7) {
          await this.sql.prepare(`INSERT INTO notifications (id,user_id,job_id,kind,title,message,created_at)
            VALUES (?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`).run(
            randomBytes(16).toString('hex'), person.id, job.id, 'deadline',
            'Upcoming application deadline', `${job.title} closes on ${job.deadline}.`, now.toISOString());
        }
      }
    }
    return this.sql.prepare(`SELECT id,application_id AS "applicationId",job_id AS "jobId",kind,title,message,
      created_at AS "createdAt",read_at AS "readAt" FROM notifications
      WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`).all(person.id);
  }
  async markNotificationRead(person, notificationId) {
    if (!person) fail("Please log in.", 401);
    const result = await this.sql.prepare(`UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?`)
      .run(new Date().toISOString(), id(notificationId), person.id);
    if (!result.changes) fail("Notification not found.", 404);
  }

  async saveApplication(person, value) {
    const old = await this.sql.prepare(
      "SELECT * FROM applications WHERE id = ?"
    ).get(id(value.id));

    const job = await this.sql.prepare(
      "SELECT * FROM jobs WHERE id = ?"
    ).get(id(old?.job_id || value.jobId));

    // CASE 1: Existing application.
    // Preserve US22 notifications when a recruiter changes the status.
    if (old) {
      if (!job || job.owner_id !== person.id || person.role !== "recruiter") {
        fail("You cannot update this application.", 403);
      }

      if (!statuses.includes(value.status)) {
        fail("Choose a valid application status.");
      }

      if (old.status !== value.status) {
        const history = [
          ...JSON.parse(old.history),
          { status: value.status, date: new Date().toISOString() }
        ];

        await this.sql.prepare(
          "UPDATE applications SET status = ?, history = ? WHERE id = ?"
        ).run(value.status, JSON.stringify(history), value.id);

        const title = value.status === "Interview"
          ? "Interview status update"
          : "Application status updated";

        const message =
          `Your application for ${job.title} changed to ${value.status}.`;

        await this.sql.prepare(`
        INSERT INTO notifications
          (id, user_id, application_id, job_id,
           kind, title, message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
          randomBytes(16).toString("hex"),
          old.user_id,
          old.id,
          job.id,
          value.status === "Interview" ? "interview_status" : "status",
          title,
          message,
          new Date().toISOString()
        );
      }

      return;
    }

    // CASE 2: A job seeker submits a new application.
    if (person.role !== "seeker" || value.userId !== person.id) {
      fail("Only job seekers can apply.", 403);
    }

    if (
      !job ||
      job.status !== "Open" ||
      job.deadline < new Date().toISOString().slice(0, 10)
    ) {
      fail("This job is no longer accepting applications.");
    }

    // Prevent duplicate applications.
    if (
      await this.sql.prepare(
        "SELECT 1 FROM applications WHERE user_id = ? AND job_id = ?"
      ).get(person.id, job.id)
    ) {
      fail("You have already applied for this job.", 409);
    }

    // Validate the job seeker's resume.
    const resume = await this.sql.prepare(
      "SELECT * FROM resumes WHERE id = ? AND user_id = ? AND listed = 0"
    ).get(id(value.resumeId), person.id);

    if (
      !resume ||
      await this.sql.prepare(
        "SELECT 1 FROM applications WHERE resume_id = ?"
      ).get(resume.id)
    ) {
      fail("Choose a valid resume copy.");
    }

    const profile = (await this.state(person)).users[0].profile;
    const now = new Date().toISOString();

    // Save the new application.
    await this.sql.prepare(`
    INSERT INTO applications
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
      value.id,
      job.id,
      person.id,
      resume.id,
      text(value.name, "name", 80, true),
      validateEmail(value.email),
      text(value.note || "", "note", 2000),
      JSON.stringify(profile),
      resume.name,
      "Applied",
      now,
      JSON.stringify([{ status: "Applied", date: now }])
    );

    // US23.1 and US23.2:
    // Notify the recruiter who owns the job posting.
    // The notification is saved in the same database transaction.
    await this.sql.prepare(`
    INSERT INTO notifications
      (id, user_id, application_id, job_id,
       kind, title, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
      randomBytes(16).toString("hex"),
      job.owner_id,
      value.id,
      job.id,
      "new_application",
      "New job application received",
      `A job seeker has applied to your posting "${job.title}".`,
      now
    );
  }
 
  async applicationForAdvice(person, applicationId) {
    if (!person) fail("Please log in.", 401);
    if (person.role !== "seeker") fail("Next-step advice is available to job seekers.", 403);
    const application = await this.sql.prepare(
      `SELECT jobs.title, jobs.description, applications.status
       FROM applications JOIN jobs ON jobs.id = applications.job_id
       WHERE applications.id = ? AND applications.user_id = ?`
    ).get(id(applicationId), person.id);
    if (!application) fail("This application is unavailable.", 404);
    return application;
  }

  async resumeForFeedback(person, key) {
    if (!person) fail("Please log in.", 401);
    if (person.role !== "seeker") fail("Resume feedback is available to job seekers.", 403);
    const resume = await this.sql.prepare(
      "SELECT name, content FROM resumes WHERE id = ? AND user_id = ? AND listed = 1"
    ).get(id(key), person.id);
    if (!resume) fail("Choose an uploaded resume from your profile.", 404);
    return resume;
  }


  async file(person, action, key, value) {
    return this.transaction(async () => {
      await this.sql.query("SELECT pg_advisory_xact_lock(734192)");
      return this.fileInTransaction(person, action, key, value);
    });
  }
  async fileInTransaction(person, action, key, value) {
    if (!person) fail("Please log in.", 401);
    id(key);
    const old = (await this.sql.prepare("SELECT * FROM resumes WHERE id = ?").get(key));
    const submitted = (await this.sql.prepare("SELECT jobs.owner_id FROM applications JOIN jobs ON jobs.id = applications.job_id WHERE resume_id = ?").get(key));
    if (action === "get") {
      if (!old || (old.user_id !== person.id && submitted?.owner_id !== person.id)) fail("This resume is unavailable.", 404);
      return old;
    }
    if (person.role !== "seeker" || (old && old.user_id !== person.id)) fail("You cannot change this resume.", 403);
    if (submitted) fail("Submitted resume copies cannot be changed.", 409);
    if (action === "delete") {
      (await this.sql.prepare("DELETE FROM resumes WHERE id = ? AND user_id = ?").run(key, person.id));
      return;
    }
    if (action !== "put") fail("Unknown file operation.");
    const name = text(value.name, "filename", 255, true);
    if (typeof value.content !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(value.content)) fail("Invalid file content.");
    const content = Buffer.from(value.content, "base64");
    if (!content.length || content.length > 5 * 1024 * 1024) fail("Choose a non-empty resume up to 5 MB.");
    const ext = name.split(".").pop().toLowerCase();
    const valid = ext === "pdf" ? content.subarray(0, 5).toString() === "%PDF-" : ext === "docx" ? content[0] === 0x50 && content[1] === 0x4b : ext === "doc" && content.subarray(0, 4).toString("hex") === "d0cf11e0";
    if (!valid) fail("Choose a valid PDF, DOC, or DOCX file.");
    (await this.sql.prepare("INSERT INTO resumes (id, user_id, name, size, content, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, size=excluded.size, content=excluded.content, created_at=excluded.created_at")
      .run(key, person.id, name, content.length, content, new Date().toISOString()));
  }
  // USER STORY 17 — APPLICATION NOTES

  async getApplicationNotes(person, applicationId) {
    if (!person) fail("Please log in.", 401);
    if (person.role !== "seeker") fail("Only job seekers can access notes.", 403);

    const application = (await this.sql.prepare(
      "SELECT id FROM applications WHERE id = ? AND user_id = ?"
    ).get(id(applicationId), person.id));

    if (!application) fail("Application not found.", 404);

    return (await this.sql.prepare(`
      SELECT id, application_id AS "applicationId",
             content, created_at AS "createdAt",
             updated_at AS "updatedAt"
      FROM application_notes
      WHERE application_id = ? AND user_id = ?
      ORDER BY created_at DESC
    `).all(applicationId, person.id));
  }

  async addApplicationNote(person, applicationId, content) {
    if (!person) fail("Please log in.", 401);
    if (person.role !== "seeker") fail("Only job seekers can add notes.", 403);

    const application = (await this.sql.prepare(
      "SELECT id FROM applications WHERE id = ? AND user_id = ?"
    ).get(id(applicationId), person.id));

    if (!application) fail("Application not found.", 404);

    const noteContent = text(content, "note", 2000, true);
    const noteId = randomBytes(16).toString("hex");
    const now = new Date().toISOString();

    (await this.sql.prepare(`
      INSERT INTO application_notes
      (id, application_id, user_id, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(noteId, applicationId, person.id, noteContent, now, now));

    return {
      id: noteId, applicationId, content: noteContent,
      createdAt: now, updatedAt: now
    };
  }

  async updateApplicationNote(person, noteId, content) {
    if (!person) fail("Please log in.", 401);
    if (person.role !== "seeker") fail("Only job seekers can edit notes.", 403);

    const noteContent = text(content, "note", 2000, true);

    const result = (await this.sql.prepare(`
      UPDATE application_notes
      SET content = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(noteContent, new Date().toISOString(), id(noteId), person.id));

    if (!result.changes) fail("Note not found.", 404);

    return { message: "Note updated successfully." };
  }

  async deleteApplicationNote(person, noteId) {
    if (!person) fail("Please log in.", 401);
    if (person.role !== "seeker") fail("Only job seekers can delete notes.", 403);

    const result = (await this.sql.prepare(
      "DELETE FROM application_notes WHERE id = ? AND user_id = ?"
    ).run(id(noteId), person.id));

    if (!result.changes) fail("Note not found.", 404);

    return { message: "Note deleted successfully." };
  }
}
module.exports = { Database };

