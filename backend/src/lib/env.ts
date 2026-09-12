import path from "node:path";
import dotenv from "dotenv";

// Loads backend/.env no matter what the working directory is. `npm start` from
// the repo root (how Liara runs the app) has cwd = repo root, so the plain
// `dotenv/config` import would look for a .env that isn't there. dotenv never
// overwrites variables that are already set, so a platform's own environment
// (Liara's panel, docker) still wins.
dotenv.config({ path: path.resolve(__dirname, "../../.env"), quiet: true });
