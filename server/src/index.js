import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import generationRoutes from './routes/generation.routes.js';
import { geminiConfig } from './config/gemini.config.js';
import { recoverGenerationJobs } from './services/generationJobs.service.js';
import { notFound, errorHandler } from "./middleware/error.js";
const app = express();
app.use((_req, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); next(); });

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

fs.mkdirSync(path.resolve("uploads"), { recursive: true });
app.use("/uploads", express.static(path.resolve("uploads")));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use('/api/generate', generationRoutes);

const clientDir = path.resolve("../client/dist");
if (fs.existsSync(path.join(clientDir, "index.html"))) {
  app.use(express.static(clientDir));
  app.get(/^\/(?!api(?:\/|$)|uploads(?:\/|$)).*/, (req, res, next) => {
    if (path.extname(req.path) || !req.accepts("html")) return next();
    res.sendFile(path.join(clientDir, "index.html"));
  });
}

app.use(notFound);
app.use(errorHandler);

const port = process.env.PORT || 5000;
geminiConfig();
connectDB()
  .then(recoverGenerationJobs)
  .then(() => app.listen(port, () => console.log(`Server running on http://localhost:${port}`)))
  .catch((err) => {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  });
