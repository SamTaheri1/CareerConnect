function validateEmail(value) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!email || email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw { status: 400, message: "Enter a valid email address." };
  }
  return email;
}

function validatePassword(value) {
  if (typeof value !== "string" || value.length < 8 || value.length > 128 || !value.trim()) {
    throw { status: 400, message: "Use a password between 8 and 128 characters." };
  }
  return value;
}

module.exports = { validateEmail, validatePassword };
