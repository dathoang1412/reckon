import React from "react";
import ReactDOM from "react-dom/client";
import App from "./pages/App";
import Popup from "./pages/Popup";
import Splash from "./pages/Splash";

const isPopup = window.location.hash === "#popup";
const isSplash = window.location.hash === "#splash";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{isSplash ? <Splash /> : isPopup ? <Popup /> : <App />}</React.StrictMode>,
);
