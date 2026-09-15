// Recover a locked-out admin without leaving the app with no admin password.
// Runs locally: asks for the username and a new password (not echoed), then
// prints one SQL statement to run on the production database (e.g. in Liara's
// pgAdmin Query Tool). The password itself is never printed or sent anywhere;
// only its scrypt hash, in the same format the app writes.
//
//   npm run hash-password
import { writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import "../src/lib/env";
import { hashPassword } from "../src/lib/auth";
import { pool } from "../src/lib/db";

// Lines read but not yet asked for: piped input can deliver several at once.
let pending = "";

function ask(question: string, hidden = false): Promise<string> {
  const { stdin, stdout } = process;
  stdout.write(question);

  // Visible prompt, or piped input (no terminal): read one line.
  if (!stdin.isTTY || !hidden) {
    return new Promise((resolve) => {
      const takeLine = () => {
        const newline = pending.indexOf("\n");
        if (newline === -1) return false;
        const line = pending.slice(0, newline).replace(/\r$/, "");
        pending = pending.slice(newline + 1);
        resolve(line);
        return true;
      };
      if (takeLine()) return;
      const onData = (chunk: Buffer) => {
        pending += chunk.toString("utf8");
        if (!takeLine()) return;
        stdin.off("data", onData);
        stdin.pause();
      };
      stdin.on("data", onData);
      stdin.resume();
    });
  }

  // Terminal: raw mode, so typed characters are not shown.
  return new Promise((resolve) => {
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    const onData = (chunk: Buffer) => {
      for (const ch of chunk.toString("utf8")) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.off("data", onData);
          stdin.pause();
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (ch === "") {
          stdin.setRawMode(false);
          stdout.write("\n");
          process.exit(130);
        }
        if (ch === "" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const username = (await ask("Username (as stored in the users table): ")).trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    console.error("That doesn't look like a valid username (3-32 chars: a-z, 0-9, . _ -).");
    process.exit(1);
  }

  const password = await ask("New password (not shown): ", true);
  if (password.length < 8) {
    console.error("The password must be at least 8 characters.");
    process.exit(1);
  }
  const repeat = await ask("Repeat the new password: ", true);
  if (password !== repeat) {
    console.error("The two passwords don't match.");
    process.exit(1);
  }
  // The input is hidden, so a Persian keyboard layout goes unnoticed: the hash
  // would then only match the Persian characters, never the Latin ones typed
  // at the login page. Refuse rather than print an unusable statement.
  if (/[^\x20-\x7e]/.test(password)) {
    console.error(
      "The password contains non-English characters (was the keyboard set to Persian?).\n" +
        "Switch the keyboard to English and run this again."
    );
    process.exit(1);
  }

  const hash = await hashPassword(password);

  // --apply: write straight to the database this process can reach
  // (DATABASE_URL). Inside the Liara container that is the production
  // database, which skips pgAdmin and any copy-pasting.
  if (process.argv.includes("--apply")) {
    if (!process.env.DATABASE_URL) {
      console.error("DATABASE_URL is not set, so there is no database to apply this to.");
      process.exit(1);
    }
    try {
      const updated = await pool.query(
        "UPDATE users SET password_hash = $2, active = true, updated_at = now() WHERE username = $1",
        [username, hash]
      );
      if (updated.rowCount === 0) {
        const admins = await pool.query("SELECT username FROM users ORDER BY username");
        console.error(
          `No user named "${username}". Existing usernames: ${admins.rows.map((r) => r.username).join(", ")}`
        );
        process.exit(1);
      }
      // Sign the user out everywhere; the new password starts fresh.
      const sessions = await pool.query(
        "DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE username = $1)",
        [username]
      );
      console.log(`\nPassword updated for "${username}" (sessions closed: ${sessions.rowCount}). Sign in with it now.`);
    } finally {
      await pool.end();
    }
    return;
  }

  // The username is validated above, so it can't break out of the quotes.
  // Deleting the user's sessions signs out anyone still logged in as them.
  const sql = `-- Run on the production database (Liara pgAdmin -> Query Tool).
-- It should report "UPDATE 1"; "UPDATE 0" means the username is wrong.
-- Delete this file afterwards: the hash below is as good as the password.
BEGIN;
UPDATE users SET password_hash = '${hash}', active = true, updated_at = now() WHERE username = '${username}';
DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE username = '${username}');
COMMIT;
`;

  // Written to a file, never printed: a terminal wraps the long hash and
  // copying it back out of the scrollback silently corrupts it, which shows
  // up later as "wrong password" even though the UPDATE reported 1 row.
  // The project folder is read-only inside a deployed container; fall back to
  // the temp folder there rather than failing after the password was typed.
  let file = path.resolve(__dirname, "../../reset-password.sql");
  try {
    writeFileSync(file, sql, { encoding: "utf8", mode: 0o600 });
  } catch {
    file = path.join(os.tmpdir(), "reset-password.sql");
    writeFileSync(file, sql, { encoding: "utf8", mode: 0o600 });
  }
  console.log(`
Wrote the SQL for user "${username}" to:

  ${file}

1. Open that file (in the editor, not the terminal) and copy all of it.
2. Run it in Liara's pgAdmin -> Query Tool. It must report "UPDATE 1".
3. Sign in with the new password, then delete the file.
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
