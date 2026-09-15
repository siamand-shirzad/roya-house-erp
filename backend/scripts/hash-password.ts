// Recover a locked-out admin without leaving the app with no admin password.
// Runs locally: asks for the username and a new password (not echoed), then
// prints one SQL statement to run on the production database (e.g. in Liara's
// pgAdmin Query Tool). The password itself is never printed or sent anywhere;
// only its scrypt hash, in the same format the app writes.
//
//   npm run hash-password
import { hashPassword } from "../src/lib/auth";

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

  const hash = await hashPassword(password);
  // The username is validated above, so it can't break out of the quotes.
  // Deleting the user's sessions signs out anyone still logged in as them.
  console.log(`
Run this on the production database (Liara pgAdmin -> Query Tool).
It should report "UPDATE 1"; "UPDATE 0" means the username is wrong.

BEGIN;
UPDATE users SET password_hash = '${hash}', active = true, updated_at = now() WHERE username = '${username}';
DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE username = '${username}');
COMMIT;
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
