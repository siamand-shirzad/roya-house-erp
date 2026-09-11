import type { NextFunction, Request, Response } from "express";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { query, queryOne } from "./db";

// Password hashing (scrypt, Node built-in) and cookie sessions.
// Sessions: a random token in an HttpOnly cookie; only its SHA-256 is stored,
// so a database leak doesn't expose usable session tokens.

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: object) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1 };
const KEYLEN = 64;

export const SESSION_COOKIE = "rh_session";
const SESSION_DAYS = 30;

export type Role = "ADMIN" | "SALES" | "WAREHOUSE" | "ACCOUNTANT";

export type AuthUser = {
  id: string;
  fullName: string;
  username: string;
  phone: string | null;
  role: Role;
};

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [algo, n, r, p, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: string, userAgent: string | undefined): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await query(
    `INSERT INTO sessions (id, user_id, expires_at, user_agent)
     VALUES ($1, $2, now() + ($3 || ' days')::interval, $4)`,
    [sha256(token), userId, String(SESSION_DAYS), userAgent?.slice(0, 300) ?? null]
  );
  // Opportunistic cleanup of expired sessions.
  await query("DELETE FROM sessions WHERE expires_at < now()");
  return token;
}

export async function deleteSession(token: string) {
  await query("DELETE FROM sessions WHERE id = $1", [sha256(token)]);
}

export async function deleteUserSessions(userId: string) {
  await query("DELETE FROM sessions WHERE user_id = $1", [userId]);
}

export function rowToAuthUser(r: any): AuthUser {
  return { id: r.id, fullName: r.full_name, username: r.username, phone: r.phone, role: r.role };
}

async function userForToken(token: string): Promise<AuthUser | null> {
  const row = await queryOne(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.expires_at > now() AND u.active`,
    [sha256(token)]
  );
  return row ? rowToAuthUser(row) : null;
}

export function readSessionToken(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === SESSION_COOKIE) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

/** Resolves the session cookie into res.locals.user (or leaves it unset). */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const token = readSessionToken(req);
    if (token) res.locals.user = await userForToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(_req: Request, res: Response, next: NextFunction) {
  if (!res.locals.user) return res.status(401).json({ error: "Not signed in" });
  next();
}

export function requireRole(...roles: Role[]) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user as AuthUser | undefined;
    if (!user) return res.status(401).json({ error: "Not signed in" });
    if (!roles.includes(user.role)) return res.status(403).json({ error: "Not allowed for your role" });
    next();
  };
}

// Simple in-memory login throttle: 10 failed attempts per username+IP per 15 min.
const failures = new Map<string, { count: number; until: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

export function isThrottled(key: string) {
  const f = failures.get(key);
  if (!f) return false;
  if (Date.now() > f.until) {
    failures.delete(key);
    return false;
  }
  return f.count >= MAX_FAILURES;
}

export function recordFailure(key: string) {
  const f = failures.get(key);
  if (!f || Date.now() > f.until) failures.set(key, { count: 1, until: Date.now() + WINDOW_MS });
  else f.count++;
}

export function clearFailures(key: string) {
  failures.delete(key);
}
