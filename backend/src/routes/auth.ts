import { Router } from "express";
import { z } from "zod";
import { query, queryOne, newId } from "../lib/db";
import {
  clearFailures,
  clearSessionCookie,
  createSession,
  deleteOtherSessions,
  type AuthUser,
  deleteSession,
  hashPassword,
  isThrottled,
  readSessionToken,
  recordFailure,
  requireAuth,
  rowToAuthUser,
  setSessionCookie,
  verifyPassword,
} from "../lib/auth";

export const authRouter = Router();

export const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(200);
const usernameSchema = z.string().trim().toLowerCase();

async function needsSetup() {
  const row = await queryOne<{ n: number }>(
    "SELECT count(*)::int AS n FROM users WHERE password_hash IS NOT NULL AND active AND role = 'ADMIN'"
  );
  return (row?.n ?? 0) === 0;
}

// GET /api/auth/status: public; tells the login screen whether first-run setup is needed.
authRouter.get("/status", async (_req, res, next) => {
  try {
    res.json({ needsSetup: await needsSetup() });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/setup: first run only; creates the first admin and signs them in.
authRouter.post("/setup", async (req, res, next) => {
  try {
    const data = z
      .object({
        fullName: z.string().trim().min(1),
        username: usernameSchema.pipe(z.string().regex(/^[a-z0-9._-]{3,32}$/)),
        password: passwordSchema,
      })
      .parse(req.body);
    if (!(await needsSetup())) return res.status(409).json({ error: "Setup already completed" });

    const hash = await hashPassword(data.password);
    // Reuse a directory entry with the same username (e.g. created before logins existed).
    const row =
      (await queryOne(
        `UPDATE users SET full_name=$2, role='ADMIN', active=true, password_hash=$3, updated_at=now()
         WHERE username=$1 RETURNING *`,
        [data.username, data.fullName, hash]
      )) ??
      (await queryOne(
        `INSERT INTO users (id, full_name, username, role, password_hash) VALUES ($1,$2,$3,'ADMIN',$4) RETURNING *`,
        [newId("user"), data.fullName, data.username, hash]
      ));

    const token = await createSession(row.id, req.headers["user-agent"]);
    await query("UPDATE users SET last_login_at = now() WHERE id = $1", [row.id]);
    setSessionCookie(res, token);
    res.status(201).json(rowToAuthUser(row));
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { username, password } = z
      .object({ username: usernameSchema.pipe(z.string().min(1)), password: z.string().min(1) })
      .parse(req.body);
    const key = `${username}|${req.ip}`;
    if (isThrottled(key)) {
      return res.status(429).json({ error: "Too many failed attempts. Try again in a few minutes." });
    }

    const row = await queryOne("SELECT * FROM users WHERE username = $1", [username]);
    const ok = row && row.active && (await verifyPassword(password, row.password_hash));
    if (!ok) {
      recordFailure(key);
      return res.status(401).json({ error: "Invalid username or password" });
    }

    clearFailures(key);
    const token = await createSession(row.id, req.headers["user-agent"]);
    await query("UPDATE users SET last_login_at = now() WHERE id = $1", [row.id]);
    setSessionCookie(res, token);
    res.json(rowToAuthUser(row));
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const token = readSessionToken(req);
    if (token) await deleteSession(token);
    clearSessionCookie(res);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, (_req, res) => {
  res.json(res.locals.user);
});

// POST /api/auth/password: a signed-in user changes their own password.
// Other devices are signed out; this session stays.
authRouter.post("/password", requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = z
      .object({ currentPassword: z.string().min(1), newPassword: passwordSchema })
      .parse(req.body);
    const user = res.locals.user as AuthUser;
    const key = `password|${user.id}|${req.ip}`;
    if (isThrottled(key)) {
      return res.status(429).json({ error: "Too many failed attempts. Try again in a few minutes." });
    }

    const row = await queryOne("SELECT password_hash FROM users WHERE id = $1", [user.id]);
    // 400, not 401: a wrong current password must not sign the user out.
    if (!(await verifyPassword(currentPassword, row?.password_hash ?? null))) {
      recordFailure(key);
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    clearFailures(key);
    await query("UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1", [
      user.id,
      await hashPassword(newPassword),
    ]);
    await deleteOtherSessions(user.id, readSessionToken(req));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
