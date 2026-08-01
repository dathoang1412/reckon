/// <reference types="vite/client" />

import type { ReckonApi } from "../../preload/index";

declare global {
  interface Window {
    api: ReckonApi;
  }
}
