import express from "express";
import authRoutes from "./routes/authRoutes.js";
import stateRoutes from "./routes/stateRoutes.js";
import siteRoutes from "./routes/siteRoutes.js";
import travelRoutes from "./routes/travelRoutes.js";
import cityRoutes from "./routes/cityRoutes.js";
import civicJobsRoutes from "./routes/civicJobsRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import chronicleRoutes from "./routes/chronicleRoutes.js";
import organizationRoutes from "./routes/organizationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import adminOrganizationRoutes from "./routes/adminOrganizationRoutes.js";
import { DatabaseUnavailableError, HttpError } from "./lib/errors.js";

const ROUTE_MODULES = [
  authRoutes,
  stateRoutes,
  siteRoutes,
  travelRoutes,
  cityRoutes,
  civicJobsRoutes,
  profileRoutes,
  chronicleRoutes,
  organizationRoutes,
  adminRoutes,
  adminOrganizationRoutes,
];

function mountRoutes(app, prefix) {
  ROUTE_MODULES.forEach((router) => app.use(prefix, router));
}

export function createApp() {
  const app = express();

  app.use(express.json());

  mountRoutes(app, "/api");
  // The live nginx proxy currently forwards /api/* requests to the backend
  // without preserving the /api prefix, so support both shapes until the
  // server config is normalized.
  mountRoutes(app, "/");

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
