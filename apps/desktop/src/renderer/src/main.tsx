import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { Toaster } from "react-hot-toast";
import App from "./pages/App";
import Popup from "./pages/Popup";
import Splash from "./pages/Splash";
import { FONT_FAMILY, muiTheme } from "./theme";

const isPopup = window.location.hash === "#popup";
const isSplash = window.location.hash === "#splash";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      {isSplash ? <Splash /> : isPopup ? <Popup /> : <App />}
      <Toaster position="bottom-right" toastOptions={{ duration: 3000, style: { fontFamily: FONT_FAMILY } }} />
    </ThemeProvider>
  </React.StrictMode>,
);
