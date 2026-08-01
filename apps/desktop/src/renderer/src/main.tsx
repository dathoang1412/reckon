import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Popup from "./Popup";

const isPopup = window.location.hash === "#popup";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{isPopup ? <Popup /> : <App />}</React.StrictMode>,
);
