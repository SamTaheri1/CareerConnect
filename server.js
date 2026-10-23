const http = require("node:http");
const path = require("node:path");
const { readFile } = require("node:fs/promises");
const { loadConfig } = require("./config");
const { Database } = require("./database");
const { createLoginHandler } = require("./auth/login");
const { createRegisterHandler } = require("./auth/register");
const { createResumeFeedbackHandler } = require("./ai/resume-feedback");
const { AuthRateLimiter } = require("./rate-limiter");

function json(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request, maximumBytes) {
  if (request.headers["content-type"]?.split(";", 1)[0].trim() !== "application/json") throw { status: 415, message: "Send the request as application/json." };
  let body = "";
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBytes) throw { status: 413, message: "The request is too large." };
    body += chunk.toString("utf8");
  }
  try {
    const data = JSON.parse(body);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    return data;
  } catch {
    throw { status: 400, message: "Send a valid JSON object." };
  }
}

function createServer(options = {}) {
  const config = { ...loadConfig(), ...options.config };
  const store = new Database(options.databaseFile || options.dataFile || config.databaseFile,
    options.databaseFile || options.dataFile ? options.legacyFile : config.userDataFile);
  const limiter = new AuthRateLimiter(config);
  const api = {
    [`${config.apiBasePath}/register`]: createRegisterHandler({ store, config }),
    [`${config.apiBasePath}/login`]: createLoginHandler({ store, config, limiter }),
    [`${config.apiBasePath}/resume-feedback`]: createResumeFeedbackHandler({ config, limiter, fetch: options.fetch }),
  };
  const files = { "/": ["index.html", "text/html"], "/index.html": ["index.html", "text/html"], "/styles.css": ["styles.css", "text/css"], "/data.js": ["data.js", "text/javascript"], "/app.js": ["app.js", "text/javascript"] };

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      if (url.pathname.startsWith(config.apiBasePath + "/") && request.method !== "GET") {
        if (request.headers["sec-fetch-site"] === "cross-site" || (request.headers.origin && request.headers.origin !== `http://${request.headers.host}` && request.headers.origin !== `https://${request.headers.host}`)) {
          return json(response, 403, { message: "Use the website to make this request." });
        }
      }
      if (url.pathname === `${config.apiBasePath}/state`) {
        const person = store.session(request);
        if (request.method === "GET") return json(response, 200, store.state(person));
        if (request.method !== "POST") return json(response, 405, { message: "Use GET or POST." });
        const changes = await readJsonBody(request, 2 * 1024 * 1024);
        if ((changes.jobs && !Array.isArray(changes.jobs)) || (changes.applications && !Array.isArray(changes.applications))) return json(response, 400, { message: "Invalid changes." });
        store.save(person, changes);
        const updated = store.session(request);
        return json(response, 200, store.state(updated));
      }
      if (url.pathname === `${config.apiBasePath}/files`) {
        const person = store.session(request);
        if (request.method === "GET") {
          const file = store.file(person, "get", url.searchParams.get("id"));
          response.writeHead(200, { "Content-Type": "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
          return response.end(Buffer.from(file.content));
        }
        if (request.method !== "POST") return json(response, 405, { message: "Use GET or POST." });
        const data = await readJsonBody(request, 7 * 1024 * 1024 + 4096);
        store.file(person, data.action, data.id, data);
        return json(response, 200, { message: "Resume saved." });
      }
      if (url.pathname === `${config.apiBasePath}/logout`) {
        if (request.method !== "POST") return json(response, 405, { message: "Use POST." });
        store.endSession(request);
        response.setHeader("Set-Cookie", "careerconnect_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
        return json(response, 200, { message: "Logged out." });
      }
      const handler = api[url.pathname];
      if (handler) {
        if (request.method !== "POST") {
          response.setHeader("Allow", "POST");
          return json(response, 405, { message: "Use POST for this endpoint." });
        }
        const result = await handler(await readJsonBody(request, config.requestMaxBytes), request);
        if (result.user) {
          store.endSession(request);
          response.setHeader("Set-Cookie", store.startSession(result.user.id));
        }
        return json(response, result.status, result);
      }
      if (url.pathname === "/config.js") {
        response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
        return response.end(`window.CareerConnectConfig = ${JSON.stringify({ apiBasePath: config.apiBasePath })};`);
      }
      if (url.pathname.startsWith(config.apiBasePath + "/")) return json(response, 404, { message: "Endpoint not found." });
      const file = files[url.pathname];
      if (!file) return json(response, 404, { message: "Page not found." });
      if (!["GET", "HEAD"].includes(request.method)) {
        response.setHeader("Allow", "GET, HEAD");
        return json(response, 405, { message: "Use GET for website files." });
      }
      const content = await readFile(path.join(__dirname, file[0]));
      response.writeHead(200, { "Content-Type": `${file[1]}; charset=utf-8`, "X-Content-Type-Options": "nosniff" });
      response.end(request.method === "HEAD" ? undefined : content);
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 500;
      if (status === 500) console.error("Request failed:", error);
      if (!response.headersSent) json(response, status, { message: status === 500 ? "Something went wrong. Please try again." : error.message });
    }
  });
  server.on("close", () => store.close());
  return server;
}

if (require.main === module) {
  const config = loadConfig();
  createServer({ config }).listen(config.port, config.host, () => console.log(`CareerConnect: http://${config.host}:${config.port}`));
}

module.exports = { createServer };
