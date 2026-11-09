/**
 * iOS Safari zooms the page when a field with a font size under 16px gets focus,
 * and many of ours are 13–14px. `maximum-scale=1` stops that auto-zoom; iOS still
 * lets people pinch-zoom, so it's only set there (Android would block pinch-zoom).
 * Keep the rest in sync with the viewport meta in nuxt.config.ts.
 */
export default defineNuxtPlugin(() => {
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIOS) return;

  // Same name as the config's tag, so this one replaces it
  useHead({
    meta: [{ name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" }],
  });
});
