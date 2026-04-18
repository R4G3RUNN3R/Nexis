import express from "express";
import authRoutes from "./routes/authRoutes.js";
import stateRoutes from "./routes/stateRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import { DatabaseUnavailableError, HttpError } from "./lib/errors.js";

export function createApp() {
  const app = express();

  app.use(express.json());

  app.use("/api", authRoutes);
  app.use("/api", stateRoutes);
  app.use("/api", adminRoutes);
  app.use("/api", organizationRoutes);
  app.use("/api", profileRoutes);
  // The live nginx proxy currently forwards /api/* requests to the backend
  // without preserving the /api prefix, so support both shapes until the
  // server config is normalized.
  app.use("/", authRoutes);
  app.use("/", stateRoutes);
  app.use("/", adminRoutes);
  app.use("/", organizationRoutes);
  app.use("/", profileRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: "Endpoint not found." });
  });

  app.use((error, _req, res, _next) => {
    if (error instanceof HttpError || error instanceof DatabaseUnavailableError) {
      res.status(error.status).json({ error: error.message, code: error.code });
      return;
    }

    console.error("api error", error);
    res.status(500).json({ error: "Internal server error." });
  });

  return app;
}
