import { BrowserWindow, Menu, Tray, nativeImage } from "electron";
import { TRAY_ICON_DATA_URL } from "../utils/icon";

export interface TrayDeps {
  getMainWindow: () => BrowserWindow | null;
  quit: () => void;
}

// The returned Tray must be kept referenced by the caller for the app's
// lifetime — Electron garbage-collects it (and the icon disappears) the
// moment nothing holds onto it anymore.
export function createTray({ getMainWindow, quit }: TrayDeps): Tray {
  const tray = new Tray(nativeImage.createFromDataURL(TRAY_ICON_DATA_URL));
  tray.setToolTip("Reckon");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show", click: () => getMainWindow()?.show() },
      { label: "Quit", click: quit },
    ]),
  );
  tray.on("click", () => {
    const win = getMainWindow();
    if (win?.isVisible()) win.hide();
    else win?.show();
  });

  return tray;
}
