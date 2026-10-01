const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

class UserStore {
  constructor(filename) { this.filename = filename; }
  read() {
    if (!fs.existsSync(this.filename)) return { users: [] };
    try {
      const data = JSON.parse(fs.readFileSync(this.filename, "utf8"));
      if (!data || !Array.isArray(data.users)) throw new Error("invalid data");
      return data;
    } catch {
      throw { status: 500, message: "Account storage is unavailable. Please try again later." };
    }
  }
  findByEmail(email) { return this.read().users.find((account) => account.user?.email === email) || null; }
  add(account) {
    const data = this.read();
    if (data.users.some((item) => item.user?.email === account.user.email)) return false;
    data.users.push(account);
    fs.mkdirSync(path.dirname(this.filename), { recursive: true });
    const temporary = `${this.filename}.${process.pid}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 });
      fs.renameSync(temporary, this.filename);
      return true;
    } catch {
      try { fs.unlinkSync(temporary); } catch {}
      throw { status: 500, message: "Account storage is unavailable. Please try again later." };
    }
  }
}
module.exports = { UserStore };
