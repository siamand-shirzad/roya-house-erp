import { MODULES } from "../lib/permissions";
import { Router } from "express";
import { z } from "zod";
import { query, queryOne, newId } from "../lib/db";
import { deleteOtherSessions, readSessionToken, deleteUserSessions, hashPassword, type AuthUser } from "../lib/auth";
import { passwordSchema } from "./auth";

// Staff users (admin only; mounted behind requireRole("ADMIN")).
export const usersRouter = Router();

const ROLES = ["ADMIN", "SALES", "WAREHOUSE", "ACCOUNTANT"] as const;

function rowToUser(r: any) {
  return {
    id: r.id,
    fullName: r.full_name,
    username: r.username,
    phone: r.phone,
    role: r.role,
    permissions: r.permissions ?? {},
    active: r.active,
    hasPassword: !!r.password_hash,
    lastLoginAt: r.last_login_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const userSchema = z.object({
  fullName: z.string().trim().min(1),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,32}$/, "Username must be 3-32 chars: a-z, 0-9, . _ -"),
  phone: z.string().trim().optional().nullable(),
  role: z.enum(ROLES),
  permissions: z.partialRecord(z.enum(MODULES), z.enum(["none", "view", "edit"])).optional(),
  active: z.boolean().optional(),
  // Optional on create (a user without a password can't sign in); on update,
  // a value resets the password and signs the user out everywhere.
  password: passwordSchema.optional(),
});

// Postgres unique_violation -> 409 instead of a generic 500.
function isUniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

usersRouter.get("/", async (_req, res, next) => {
  try {
    const rows = await query("SELECT * FROM users ORDER BY active DESC, full_name ASC");
    res.json(rows.map(rowToUser));
  } catch (err) {
    next(err);
  }
});

usersRouter.post("/", async (req, res, next) => {
  try {
    const data = userSchema.parse(req.body);
    const row = await queryOne(
      `INSERT INTO users (id, full_name, username, phone, role, active, password_hash, permissions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        newId("user"),
        data.fullName,
        data.username,
        data.phone || null,
        data.role,
        data.active ?? true,
        data.password ? await hashPassword(data.password) : null,
        JSON.stringify(data.permissions ?? {}),
      ]
    );
    res.status(201).json(rowToUser(row));
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ error: "Username already exists" });
    next(err);
  }
});

usersRouter.put("/:id", async (req, res, next) => {
  try {
    const data = userSchema.partial().parse(req.body);
    const existing = await queryOne("SELECT * FROM users WHERE id = $1", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "User not found" });

    const role = data.role ?? existing.role;
    const active = data.active ?? existing.active;

    // Never leave the system without an active admin who can sign in.
    const losesAdmin = existing.role === "ADMIN" && existing.active && (role !== "ADMIN" || !active);
    if (losesAdmin) {
      const others = await queryOne<{ n: number }>(
        `SELECT count(*)::int AS n FROM users
         WHERE role='ADMIN' AND active AND password_hash IS NOT NULL AND id <> $1`,
        [existing.id]
      );
      if (!others?.n) return res.status(400).json({ error: "At least one active admin is required" });
    }

    const row = await queryOne(
      `UPDATE users SET full_name=$1, username=$2, phone=$3, role=$4, active=$5,
         password_hash=COALESCE($6, password_hash), permissions=$8, updated_at=now()
       WHERE id=$7 RETURNING *`,
      [
        data.fullName ?? existing.full_name,
        data.username ?? existing.username,
        data.phone !== undefined ? data.phone || null : existing.phone,
        role,
        active,
        data.password ? await hashPassword(data.password) : null,
        req.params.id,
        JSON.stringify(data.permissions ?? existing.permissions ?? {}),
      ]
    );

    // Deactivation or a password reset ends the user's existing sessions,
    // except the admin's own current session when they change their own password.
    const self = (res.locals.user as AuthUser).id === existing.id;
    if (!active || (data.password && !self)) await deleteUserSessions(existing.id);
    else if (data.password && self) await deleteOtherSessions(existing.id, readSessionToken(req));

    res.json(rowToUser(row));
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ error: "Username already exists" });
    next(err);
  }
});
