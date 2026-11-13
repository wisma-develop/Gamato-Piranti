/**
 * Efek pointer global — SATU listener terdelegasi untuk seluruh situs (bukan satu handler per kartu).
 *
 *  - `[data-tilt]`  → miring 3D mengikuti kursor. Nilai atribut = sudut maksimum (derajat, bawaan 7).
 *                     CSS di index.css memakai variabel --rx/--ry. Anak dengan `[data-depth]` "timbul" (translateZ).
 *  - `.gp-spot`     → sorotan cahaya radial mengikuti kursor (variabel --mx/--my).
 *
 * Hanya aktif untuk mouse pada perangkat dengan hover halus, dan mati total bila "kurangi gerakan" aktif.
 * Menulis langsung ke style elemen lewat rAF — tidak ada state/re-render React saat kursor bergerak.
 */
let installed = false;

export function installPointerFx() {
  if (installed || typeof window === "undefined" || !window.matchMedia) return;
  installed = true;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  let raf = 0;
  let pending: { tilt: HTMLElement | null; spot: HTMLElement | null; x: number; y: number } | null = null;
  let activeTilt: HTMLElement | null = null;
  let activeSpot: HTMLElement | null = null;

  const resetTilt = (el: HTMLElement | null) => {
    if (!el) return;
    el.style.removeProperty("--rx"); el.style.removeProperty("--ry");
    el.classList.remove("is-tilting");
  };
  const resetSpot = (el: HTMLElement | null) => { if (el) { el.style.removeProperty("--mx"); el.style.removeProperty("--my"); } };

  const apply = () => {
    raf = 0;
    if (!pending) return;
    const { tilt, spot, x, y } = pending;
    pending = null;
    if (spot) {
      const r = spot.getBoundingClientRect();
      spot.style.setProperty("--mx", `${(x - r.left).toFixed(0)}px`);
      spot.style.setProperty("--my", `${(y - r.top).toFixed(0)}px`);
    }
    if (tilt && !reduce.matches) {
      const r = tilt.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        const max = parseFloat(tilt.getAttribute("data-tilt") || "") || 7;
        const px = (x - r.left) / r.width, py = (y - r.top) / r.height;
        tilt.style.setProperty("--ry", `${((px - 0.5) * 2 * max).toFixed(2)}deg`);
        tilt.style.setProperty("--rx", `${((0.5 - py) * 2 * max).toFixed(2)}deg`);
        tilt.classList.add("is-tilting");
      }
    }
  };

  const clearActive = () => {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    pending = null;
    resetTilt(activeTilt); resetSpot(activeSpot);
    activeTilt = null; activeSpot = null;
  };

  document.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || !fine.matches) return;
    const t = e.target as Element | null;
    const tilt = (t?.closest?.("[data-tilt]") as HTMLElement | null) ?? null;
    const spot = (t?.closest?.(".gp-spot") as HTMLElement | null) ?? null;
    if (activeTilt && activeTilt !== tilt) { resetTilt(activeTilt); activeTilt = null; }
    if (activeSpot && activeSpot !== spot) { activeSpot = null; }
    if (!tilt && !spot) return;
    activeTilt = tilt; activeSpot = spot;
    pending = { tilt, spot, x: e.clientX, y: e.clientY };
    if (!raf) raf = requestAnimationFrame(apply);
  }, { passive: true });

  document.documentElement.addEventListener("mouseleave", clearActive);
  window.addEventListener("blur", clearActive);
  document.addEventListener("scroll", () => { if (activeTilt) { resetTilt(activeTilt); activeTilt = null; } }, { passive: true, capture: true });
}
