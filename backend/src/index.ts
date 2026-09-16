import { requirePermission } from "./lib/permissions";
import "./lib/env";
import { existsSync } from "node:fs";
import path from "node:path";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import { ZodError } from "zod";
import { productsRouter } from "./routes/products";
import { customersRouter } from "./routes/customers";
import { documentsRouter } from "./routes/documents";
import { usersRouter } from "./routes/users";
import { authRouter } from "./routes/auth";
import { publicRouter } from "./routes/public";
import { reportsRouter } from "./routes/reports";
import { companyRouter, ensureCompany } from "./routes/company";
import { inventoryRouter } from "./routes/inventory";
import { authenticate, requireAuth, requireRole } from "./lib/auth";
import { pool, SCHEMA_SQL } from "./lib/db";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// In production a reverse proxy sits in front (Liara, nginx), so the client IP
// arrives in X-Forwarded-For. Without this, req.ip is the proxy for everyone
// and the login throttle in routes/auth.ts counts all users in one bucket.
app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : false);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") ?? "http://localhost:5173",
    credentials: true, // session cookie
  })
);
app.use(express.json());
app.use(authenticate);

// Public: health, sign-in, and aggregate data for the landing page.
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "roya-house-backend" });
});
app.use("/api/auth", authRouter);
app.use("/api/public", publicRouter);

// Everything else needs a signed-in user.
app.use("/api", requireAuth);
// Anyone signed in can read the catalog; only admins change products/prices.
app.use("/api/products", productsRouter);
app.use("/api/customers", customersRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/company", companyRouter);
// Everyone reads stock; the router itself limits writes to ADMIN and WAREHOUSE.
app.use("/api/inventory", inventoryRouter);
app.use("/api/users", requireRole("ADMIN"), usersRouter);
// Revenue figures: management and accounting only.
app.use("/api/reports", requirePermission("reports"), reportsRouter);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Validation error", details: err.flatten() });
  }
  // Client errors raised by middleware (e.g. malformed JSON from express.json()).
  if (typeof err?.status === "number" && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.expose ? err.message : "Bad request" });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
// Serve the built SPA from the same origin as the API when it is present
// (production). Same origin means the SameSite=Lax session cookie is sent on
// every request and CORS never comes into play. In dev the Vite server handles
// this instead, and frontend/dist does not exist.
const CLIENT_DIR = process.env.CLIENT_DIR
  ? path.resolve(process.env.CLIENT_DIR)
  : path.resolve(__dirname, "../../frontend/dist");

if (existsSync(path.join(CLIENT_DIR, "index.html"))) {
  app.use(
    express.static(CLIENT_DIR, {
      setHeaders(res, filePath) {
        // Vite fingerprints everything under /assets; the rest (index.html,
        // logos, site photos) can be replaced in place, so it must revalidate.
        const hashed = filePath.includes(`${path.sep}assets${path.sep}`);
        res.setHeader("Cache-Control", hashed ? "public, max-age=31536000, immutable" : "no-cache");
      },
    })
  );

  // Client-side routes (/products, /documents/invoice/...) are not files, so
  // they fall through to index.html. Anything under /api that got this far is
  // a genuine 404 and must not be answered with HTML.
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(CLIENT_DIR, "index.html"));
  });
} else {
  console.log("No built frontend at", CLIENT_DIR, "- serving the API only.");
}

app.use(errorHandler);

// SCHEMA_SQL is idempotent (CREATE TABLE IF NOT EXISTS), so new tables appear
// on startup. It does not alter existing tables; see CLAUDE.md.
// Without DATABASE_URL, pg silently falls back to localhost:5432, and on a
// platform that only shows up as a vague ECONNREFUSED. Say what is missing.
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to the app's environment variables (or backend/.env locally).");
  process.exit(1);
}

pool
  .query(SCHEMA_SQL)
  .then(ensureCompany)
  .then(() => {
    // Bind all IPv4 interfaces explicitly: platforms such as Liara route to
    // 0.0.0.0 inside the container, and node's default (::) is not guaranteed there.
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Roya House backend listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to apply schema:", err);
    process.exit(1);
  });
