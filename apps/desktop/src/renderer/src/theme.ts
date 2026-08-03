import type { ThemeConfig } from "antd";

// Own indigo/blue rather than antd's stock #1677ff (used by nearly every
// unstyled antd app) — same color family, so nothing about the app's feel
// changes abruptly, just no longer visually generic.
export const COLOR_PRIMARY = "#3B5BDB";

export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: COLOR_PRIMARY,
  },
};

// Non-antd style constants reused by hand across components that fall
// outside antd's own token system (plain <div>/<span> inline styles).
export const styleTokens = {
  borderColorLight: "#f0f0f0",
  secondaryFontSize: 12,
};
