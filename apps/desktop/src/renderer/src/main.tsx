import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Popup from "./Popup";
import Splash from "./Splash";

const isPopup = window.location.hash === "#popup";
const isSplash = window.location.hash === "#splash";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{isSplash ? <Splash /> : isPopup ? <Popup /> : <App />}</React.StrictMode>,
);
