const { randomBytes, randomUUID } = require("node:crypto");
const { hashPassword } = require("./password");
const { validateEmail, validatePassword } = require("./validation");

function createRegisterHandler({ store, config }) {
  return async (data) => {
    const name = typeof data.name === "string" ? data.name.trim() : "";
    if (!name || name.length > 80) throw { status: 400, message: "Enter a name between 1 and 80 characters." };
    if (!["seeker", "recruiter"].includes(data.role)) throw { status: 400, message: "Choose job seeker or recruiter." };
    const email = validateEmail(data.email);
    const password = validatePassword(data.password);
    const user = { id: randomUUID(), name, email, role: data.role };
    const salt = randomBytes(16).toString("hex");
    const passwordHash = await hashPassword(password, salt, config);
    if (!store.add({ user, salt, passwordHash })) {
      throw { status: 409, message: "An account with this email already exists. Please log in." };
    }
    return { status: 201, message: "Account created.", user };
  };
}

module.exports = { createRegisterHandler };
