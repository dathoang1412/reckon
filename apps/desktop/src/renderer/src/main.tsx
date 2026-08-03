import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import App from "./pages/App";
import Popup from "./pages/Popup";
import Splash from "./pages/Splash";
import { themeConfig } from "./theme";

const isPopup = window.location.hash === "#popup";
const isSplash = window.location.hash === "#splash";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider theme={themeConfig}>{isSplash ? <Splash /> : isPopup ? <Popup /> : <App />}</ConfigProvider>
  </React.StrictMode>,
);
