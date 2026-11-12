// Never print raw connection errors: drivers may include credentials or records.
function databaseError(error) {
  const messages = {
    ENOENT: "CA certificate file not found. Set DATABASE_CA_FILE=prod-ca-2021.crt and pull the certificate from the repository.",
    ENOTFOUND: "Database hostname could not be resolved. Check the Session pooler hostname and your network/DNS.",
    EACCES: "Network access was blocked. Allow the terminal or Codex to connect to Supabase.",
    ECONNREFUSED: "Database connection refused. Check the host, port, and network access.",
    ETIMEDOUT: "Database connection timed out. Check network access and whether the Supabase project is running.",
    SELF_SIGNED_CERT_IN_CHAIN: "TLS certificate is not trusted. Set DATABASE_CA_FILE=prod-ca-2021.crt.",
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: "TLS certificate could not be verified. Check DATABASE_CA_FILE.",
    '28P01': "Database password was rejected. Obtain the current DATABASE_URL privately from the team; URL-encode reserved password characters.",
    '42P01': "Application tables are missing. Confirm you are using the team's existing Supabase project. Only the maintainer should initialize a new database.",
    '42501': "Database credentials do not have permission to access the application's schema.",
    ERR_INVALID_URL: "DATABASE_URL is not a valid PostgreSQL connection string.",
  };
  if (messages[error.code]) return messages[error.code];
  if (error.message?.startsWith("Set DATABASE_URL")) return "DATABASE_URL is missing. Run npm run setup, then fill in .env with the connection string shared privately by your team.";
  return "Database connection failed. Check the private DATABASE_URL, certificate, project status, and network access. No credentials have been printed.";
}
module.exports = { databaseError };
