import { useEffect, useState } from "react";
import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import { Toaster } from "react-hot-toast";
import ErrorBoundary from "./components/ErrorBoundary";
import App from "./pages/App";
import Popup from "./pages/Popup";
import Splash from "./pages/Splash";
import { FONT_FAMILY, getThemeConfig } from "./theme";

const isPopup = window.location.hash === "#popup";
const isSplash = window.location.hash === "#splash";

// Owns the dark-mode preference for this window (main, popup, or splash —
// each is its own renderer process/entry, see isPopup/isSplash above) and
// keeps two things in sync with it: antd's own component palette (via
// ConfigProvider's algorithm) and this app's plain, non-antd elements (via
// the data-theme attribute index.html's CSS vars key off, see theme.ts).
function Root() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    window.api.settings.getDarkMode().then(setDark);
    window.api.onThemeChanged(setDark);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  return (
    <ConfigProvider theme={getThemeConfig(dark)}>
      <ErrorBoundary>{isSplash ? <Splash /> : isPopup ? <Popup /> : <App />}</ErrorBoundary>
      <Toaster position="bottom-right" toastOptions={{ duration: 3000, style: { fontFamily: FONT_FAMILY } }} />
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
