import { StrictMode, startTransition } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { DialogProvider } from "@/hooks/useDialog";
import { installHighQualityCanvasDefaults } from "@/lib/canvasQuality";
import { installPointerFx } from "@/lib/pointerFx";

installHighQualityCanvasDefaults();
installPointerFx();

// Efek ambient (animasi berulang, backdrop-filter) menyala setelah render pertama & browser idle → LCP/TBT lebih ringan.
const goLive = () => document.documentElement.classList.add("gp-live");
const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
if (w.requestIdleCallback) w.requestIdleCallback(goLive, { timeout: 2500 }); else window.setTimeout(goLive, 1200);

const root = createRoot(document.getElementById("root")!);
// Render awal sebagai *transition* → React memecahnya jadi irisan ±5 ms (time-slicing) alih-alih satu tugas panjang yang
// memblokir main thread. Hasil akhirnya sama; input & scroll tetap responsif selama halaman pertama dirakit.
startTransition(() => {
  root.render(
    <StrictMode>
      <DialogProvider>
        <App />
      </DialogProvider>
    </StrictMode>
  );
});
