export function attachLightDismiss(dialog: HTMLDialogElement): () => void {
  dialog.setAttribute("closedby", "any");
  if ("closedBy" in HTMLDialogElement.prototype) {
    return () => {
      dialog.removeAttribute("closedby");
    };
  }
  const outside = (e: PointerEvent) => {
    const r = dialog.getBoundingClientRect();
    return (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    );
  };
  let pressedOutside = false;
  const onDown = (e: PointerEvent) => {
    pressedOutside = outside(e);
  };
  const onUp = (e: PointerEvent) => {
    if (pressedOutside && outside(e) && dialog.open) {
      dialog.close();
    }
    pressedOutside = false;
  };
  dialog.addEventListener("pointerdown", onDown);
  dialog.addEventListener("pointerup", onUp);
  return () => {
    dialog.removeEventListener("pointerdown", onDown);
    dialog.removeEventListener("pointerup", onUp);
    dialog.removeAttribute("closedby");
  };
}
