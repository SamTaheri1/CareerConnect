const http = require("node:http");
const path = require("node:path");
const { readFile } = require("node:fs/promises");
const { randomUUID, randomBytes, scryptSync, timingSafeEqual } = require("node:crypto");

// Accounts exist only while this server is running. Nothing is written to disk.
function createServer() {
  const accounts = new Map();
  const files = {
    "/": ["index.html", "text/html"],
    "/index.html": ["index.html", "text/html"],
    "/styles.css": ["styles.css", "text/css"],
    "/data.js": ["data.js", "text/javascript"],
    "/app.js": ["app.js", "text/javascript"],
  };

  function json(response, status, body) {
    response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify(body));
  }

  async function readBody(request) {
    if (request.headers["content-type"]?.split(";")[0].trim() !== "application/json") {
      throw { status: 415, message: "Send the request as application/json." };
    }
    let body = "";
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 8192) throw { status: 413, message: "The request is too large." };
      body += chunk.toString();
    }
    let data;
    try { data = JSON.parse(body); }
    catch { throw { status: 400, message: "Send valid JSON." }; }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw { status: 400, message: "Send a JSON object." };
    }
    return data;
  }

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      if (url.pathname === "/api/register" || url.pathname === "/api/login") {
        if (request.method !== "POST") {
          response.setHeader("Allow", "POST");
          return json(response, 405, { message: "Use POST for this endpoint." });
        }
        const data = await readBody(request);
        const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
        const password = data.password;
        if (!email || email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return json(response, 400, { message: "Enter a valid email address." });
        }
        if (typeof password !== "string" || password.length < 8 || password.length > 128 || !password.trim()) {
          return json(response, 400, { message: "Use a password between 8 and 128 characters." });
        }
        if (url.pathname === "/api/register") {
          const name = typeof data.name === "string" ? data.name.trim() : "";
          if (!name || name.length > 80) return json(response, 400, { message: "Enter a name between 1 and 80 characters." });
          if (!["seeker", "recruiter"].includes(data.role)) return json(response, 400, { message: "Choose job seeker or recruiter." });
          if (accounts.has(email)) return json(response, 409, { message: "An account with this email already exists. Please log in." });
          const salt = randomBytes(16).toString("hex");
          const user = { id: randomUUID(), name, email, role: data.role };
          accounts.set(email, { user, salt, hash: scryptSync(password, salt, 64) });
          return json(response, 201, { message: "Account created.", user });
        }
        const account = accounts.get(email);
        if (!account || !timingSafeEqual(account.hash, scryptSync(password, account.salt, 64))) {
          return json(response, 401, { message: "The email or password is incorrect." });
        }
        return json(response, 200, { user: account.user });
      }
      if (url.pathname.startsWith("/api/")) return json(response, 404, { message: "Endpoint not found." });
      const file = files[url.pathname];
      if (!file) return json(response, 404, { message: "Page not found." });
      if (!["GET", "HEAD"].includes(request.method)) return json(response, 405, { message: "Use GET for website files." });
      const content = await readFile(path.join(__dirname, file[0]));
      response.writeHead(200, { "Content-Type": file[1] + "; charset=utf-8", "X-Content-Type-Options": "nosniff" });
      response.end(request.method === "HEAD" ? undefined : content);
    } catch (error) {
      json(response, error.status || 500, { message: error.status ? error.message : "Something went wrong. Please try again." });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 4174;
  createServer().listen(port, "127.0.0.1", () => console.log(`CareerConnect: http://127.0.0.1:${port}`));
}

module.exports = { createServer };
