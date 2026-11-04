import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { DialogProvider } from "@/hooks/useDialog";
import { installHighQualityCanvasDefaults } from "@/lib/canvasQuality";

installHighQualityCanvasDefaults();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DialogProvider>
      <App />
    </DialogProvider>
  </StrictMode>
);
