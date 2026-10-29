import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./generated/tokens.css";
import "./styles/app.css";
import "./monaco/setup";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
