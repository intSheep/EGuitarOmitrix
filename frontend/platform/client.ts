import * as c from "../controllers/practice";
export const isAndroid = () => window.Capacitor?.getPlatform() === "android";
export const isClient = () => !!window.eguitarDesktop || isAndroid();
export async function checkUpdates() {
  if (window.eguitarDesktop) {
    if (window.eguitarDesktop.updatesSupported === false) {
      if (window.eguitarDesktop.openCourse) {
        await window.eguitarDesktop.openCourse(
          "https://github.com/intSheep/EGuitarOmitrix/releases",
        );
        return;
      }
      window.open(
        "https://github.com/intSheep/EGuitarOmitrix/releases",
        "_blank",
      );
      return;
    }
    await window.eguitarDesktop.checkUpdates();
  } else if (isAndroid()) await window.Capacitor!.Plugins.AppUpdate.check();
}
export function clientBack() {
  const s = c.getSnapshot(),
    { name, params } = c.route();
  if (s.dialog) {
    c.setDialog(null);
    return true;
  }
  if (s.tool) {
    c.setTool(null);
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
