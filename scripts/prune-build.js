// Shrinks what a deployment keeps, after `npm run build` at the repo root.
//
// The build installs dependencies for both halves, but only two things are
// needed to *run* the app: backend/dist (plus the backend's runtime
// dependencies) and frontend/dist (static files). Everything the build itself
// needed - Vite, TypeScript, tsx, the fonts' source packages - would otherwise
// sit in the deployed image forever.
//
// Run through `npm run build` at the repo root, which is the deployment entry
// point (Liara runs it). It deletes frontend/node_modules, so after running it
// locally, `npm --prefix frontend install` is needed before developing again.
const { execSync } = require("node:child_process");
const { rmSync, existsSync, statSync, readdirSync } = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
// npm is a shell script (npm.cmd on Windows), so it runs through a shell. The
// command is a fixed string: nothing here comes from outside this file.
const runNpm = (command) => execSync(`npm ${command}`, { cwd: root, stdio: "inherit" });

function sizeMb(dir) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += sizeMb(full) * 1024 * 1024;
    else if (entry.isFile()) {
      try {
        total += statSync(full).size;
      } catch {
        // A file that vanished mid-walk doesn't matter for a size report.
      }
    }
  }
  return total / 1024 / 1024;
}

const frontendModules = path.join(root, "frontend", "node_modules");
const backendModules = path.join(root, "backend", "node_modules");
const before = sizeMb(frontendModules) + sizeMb(backendModules);

// The frontend is served as static files from frontend/dist; nothing it was
// built with is needed again at runtime.
rmSync(frontendModules, { recursive: true, force: true });

// The backend runs from dist/, so its build-only packages (typescript, tsx,
// @types/*) can go too. scripts/hash-password is compiled into dist/, so
// `npm run hash-password` keeps working here without tsx.
runNpm("--prefix backend prune --omit=dev --no-audit --no-fund");

const after = sizeMb(frontendModules) + sizeMb(backendModules);
console.log(`Pruned build dependencies: ${before.toFixed(0)} MB -> ${after.toFixed(0)} MB of node_modules.`);
