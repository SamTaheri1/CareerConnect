const { hashPassword, passwordsMatch } = require("./password");
const { validateEmail, validatePassword } = require("./validation");

function createLoginHandler({ store, config, limiter }) {
  return async (data, request) => {
    const email = validateEmail(data.email);
    const password = validatePassword(data.password);
    const key = `${request.socket.remoteAddress || "unknown"}:${email}`;
    limiter.check(key);
    const account = store.findByEmail(email);
    if (!account || typeof account.salt !== "string" || typeof account.passwordHash !== "string") {
      throw { status: 401, message: "The email or password is incorrect." };
    }
    const suppliedHash = await hashPassword(password, account.salt, config);
    if (!passwordsMatch(account.passwordHash, suppliedHash)) {
      throw { status: 401, message: "The email or password is incorrect." };
    }
    limiter.clear(key);
    return { status: 200, user: account.user };
  };
}

module.exports = { createLoginHandler };
