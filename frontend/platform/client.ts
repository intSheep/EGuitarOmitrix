import * as c from "../controllers/practice";
export const isAndroid = () => window.Capacitor?.getPlatform() === "android";
export const isClient = () => !!window.eguitarDesktop || isAndroid();
export async function checkUpdates({ automatic = false } = {}) {
  if (isAndroid()) await window.Capacitor!.Plugins.AppUpdate.check({ automatic });
}
export function clientBack() {
  const s = c.getSnapshot(),
    { name, params } = c.route();
  if (s.dialog) {
    c.setDialog(null);
    return true;
  }
  if (s.tunerOpen) {
    c.closeTunerOverlay();
    return true;
  }
  if (s.positionOpen) {
    c.setPositionOpen(false);
    return true;
  }
  if (name === "focus" && s.focusView !== "timer") {
    c.returnToTimer();
    return true;
  }
  if (name === "finish") return true;
  if (
    name === "practice" &&
    document.body.classList.contains("client-detail")
  ) {
    params.set("view", "list");
    c.navigate("practice?" + params);
    return true;
  }
  if (name !== "practice") {
    c.navigate("practice");
    return true;
  }
  return false;
}
