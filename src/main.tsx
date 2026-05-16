import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/app.css";
import "./styles/nexis-theme.css";
import "./styles/nexis-theme-hospital-patch.css";
import "./styles/topbar-dropdown.css";
import "./styles/ciel.css";
import "./styles/character-profile.css";
import "./styles/education-ui.css";
import "./styles/hospital.css";
import "./styles/academies-ui.css";
import "./styles/statbars.css";
import "./styles/jobs.css";
import "./styles/housing.css";
import "./styles/inventory.css";
import "./styles/achievements-legacy-ui.css";
import "./styles/hosp-full.css";
import "./styles/register.css";
import "./styles/arena.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
