import { createTheme } from "@mui/material/styles";

// Own indigo/blue rather than MUI's stock #1976d2 — same color family, so
// nothing about the app's feel changes abruptly, just no longer visually
// generic.
export const COLOR_PRIMARY = "#3B5BDB";

// Matches the OS-native stack react-hot-toast's portal already renders
// with, so switching theme systems doesn't shift its font out from under it.
export const FONT_FAMILY = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'`;

export const muiTheme = createTheme({
  palette: {
    primary: {
      main: COLOR_PRIMARY,
    },
  },
  typography: {
    fontFamily: FONT_FAMILY,
  },
  shape: {
    borderRadius: 8,
  },
});

// Non-MUI style constants reused by hand across components that fall
// outside MUI's own theme system (plain <div>/<span> inline styles).
export const styleTokens = {
  borderColorLight: "#f0f0f0",
  secondaryFontSize: 12,
};
