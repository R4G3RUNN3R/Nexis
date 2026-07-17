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
import skillRoutes from "./routes/skillRoutes.js";
import arenaCombatRoutes from "./routes/arenaCombatRoutes.js";
import duelRoutes from "./routes/duelRoutes.js";
import itemRoutes from "./routes/itemRoutes.js";
import educationRoutes from "./routes/educationRoutes.js";
import cityBoardRoutes from "./routes/cityBoardRoutes.js";
import worldMapRoutes from "./routes/worldMapRoutes.js";
import marketplaceRoutes from "./routes/marketplaceRoutes.js";
import adventureRoutes from "./routes/adventureRoutes.js";
import playerRecordsRoutes from "./routes/playerRecordsRoutes.js";
import nexisOneShotRoutes from "./routes/nexisOneShotRoutes.js";
import pvpRoutes from "./routes/pvpRoutes.js";
import worldProgressionRoutes from "./routes/worldProgressionRoutes.js";
import organizationOneShotRoutes from "./routes/organizationOneShotRoutes.js";
import excursionRoutes from "./routes/excursionRoutes.js";
import guideRoutes from "./routes/guideRoutes.js";
import { DatabaseUnavailableError, HttpError } from "./lib/errors.js";
import { requireTrustedOrigin } from "./middleware/originGuard.js";
import { unsafeApiRateLimit } from "./middleware/rateLimit.js";
import { securityHeaders } from "./middleware/securityHeaders.js";

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
  skillRoutes,
  arenaCombatRoutes,
  duelRoutes,
  itemRoutes,
  educationRoutes,
  cityBoardRoutes,
  worldMapRoutes,
  marketplaceRoutes,
  adventureRoutes,
  playerRecordsRoutes,
  nexisOneShotRoutes,
  pvpRoutes,
  worldProgressionRoutes,
  organizationOneShotRoutes,
  excursionRoutes,
  guideRoutes,
  adminRoutes,
  adminOrganizationRoutes,
];

function mountRoutes(app, prefix) {
  ROUTE_MODULES.forEach((router) => app.use(prefix, router));
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(securityHeaders);
  app.use(requireTrustedOrigin);

  // Portrait uploads send base64 image data through JSON (see profileRoutes.js),
  // which regularly exceeds Express's 100kb default and was silently rejecting
  // legitimate uploads with PayloadTooLargeError.
  app.use(express.json({ limit: "2mb" }));
  app.use(unsafeApiRateLimit);

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
