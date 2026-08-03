import type { ThemeConfig } from "antd";

// Own indigo/blue rather than antd's stock #1677ff (used by nearly every
// unstyled antd app) — same color family, so nothing about the app's feel
// changes abruptly, just no longer visually generic.
export const COLOR_PRIMARY = "#3B5BDB";

// antd's own default — matches exactly since antd applies this per-component
// via CSS-in-JS rather than a global body rule, so anything rendered outside
// an antd component (react-hot-toast's portal, for one) needs it spelled out
// explicitly to not fall back to the browser's default serif font.
export const FONT_FAMILY = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'`;

export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: COLOR_PRIMARY,
    fontFamily: FONT_FAMILY,
  },
};

// Non-antd style constants reused by hand across components that fall
// outside antd's own token system (plain <div>/<span> inline styles).
export const styleTokens = {
  borderColorLight: "#f0f0f0",
  secondaryFontSize: 12,
};
