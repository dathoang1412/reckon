import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider, message } from "antd";
import App from "./pages/App";
import Popup from "./pages/Popup";
import Splash from "./pages/Splash";
import { themeConfig } from "./theme";

// See the #message-root comment in index.html — mounts message toasts
// top-right instead of antd's default top-center, without touching its
// internal styling/size/animation.
message.config({ getContainer: () => document.getElementById("message-root")! });

const isPopup = window.location.hash === "#popup";
const isSplash = window.location.hash === "#splash";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider theme={themeConfig}>{isSplash ? <Splash /> : isPopup ? <Popup /> : <App />}</ConfigProvider>
  </React.StrictMode>,
);
