const http = require("node:http");
const path = require("node:path");
const { readFile } = require("node:fs/promises");
const { loadConfig } = require("./config");
const { UserStore } = require("./user-store");
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
  const store = new UserStore(options.dataFile || config.userDataFile);
  const limiter = new AuthRateLimiter(config);
  const api = {
    [`${config.apiBasePath}/register`]: createRegisterHandler({ store, config }),
    [`${config.apiBasePath}/login`]: createLoginHandler({ store, config, limiter }),
    [`${config.apiBasePath}/resume-feedback`]: createResumeFeedbackHandler({ config, limiter, fetch: options.fetch }),
  };
  const files = { "/": ["index.html", "text/html"], "/index.html": ["index.html", "text/html"], "/styles.css": ["styles.css", "text/css"], "/data.js": ["data.js", "text/javascript"], "/app.js": ["app.js", "text/javascript"] };

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      const handler = api[url.pathname];
      if (handler) {
        if (request.method !== "POST") {
          response.setHeader("Allow", "POST");
          return json(response, 405, { message: "Use POST for this endpoint." });
        }
        const result = await handler(await readJsonBody(request, config.requestMaxBytes), request);
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
}

if (require.main === module) {
  const config = loadConfig();
  createServer({ config }).listen(config.port, config.host, () => console.log(`CareerConnect: http://${config.host}:${config.port}`));
}

module.exports = { createServer };
