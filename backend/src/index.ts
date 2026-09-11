import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import { ZodError } from "zod";
import { productsRouter } from "./routes/products";
import { customersRouter } from "./routes/customers";
import { documentsRouter } from "./routes/documents";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") ?? "http://localhost:5173",
  })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "roya-house-backend" });
});

app.use("/api/products", productsRouter);
app.use("/api/customers", customersRouter);
app.use("/api/documents", documentsRouter);

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Validation error", details: err.flatten() });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Roya House backend listening on http://localhost:${PORT}`);
});
