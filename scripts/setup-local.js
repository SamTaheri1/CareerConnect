const fs = require("node:fs");
const path = require("node:path");

function setupLocal(root = path.join(__dirname, "..")) {
  const target = path.join(root, ".env");
  try {
    fs.copyFileSync(path.join(root, ".env.example"), target, fs.constants.COPYFILE_EXCL);
    return "Created .env. Add the DATABASE_URL shared privately by your team. For live AI feedback, also add OPENAI_API_KEY. Then run npm run doctor.";
  } catch (error) {
    if (error.code === "EEXIST") return "Your existing .env was preserved. Run npm run doctor to check your configuration.";
    throw error;
  }
}
if (require.main === module) {
  try { console.log(setupLocal()); }
  catch { console.error("Could not create .env. Check folder permissions and that .env.example exists."); process.exitCode = 1; }
}
module.exports = { setupLocal };
