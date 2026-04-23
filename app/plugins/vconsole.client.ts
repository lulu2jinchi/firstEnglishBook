import type VConsole from "vconsole";

const VCONSOLE_STORAGE_KEY = "first-english-book-vconsole-enabled";
const VCONSOLE_QUERY_KEY = "vconsole";
const VCONSOLE_INSTANCE_KEY = "__FIRST_ENGLISH_BOOK_VCONSOLE__";

declare global {
  interface Window {
    __FIRST_ENGLISH_BOOK_VCONSOLE__?: VConsole;
  }
}

function syncDebugPreference() {
  const searchParams = new URLSearchParams(window.location.search);
  const value = searchParams.get(VCONSOLE_QUERY_KEY);

  if (value === "1") {
    window.localStorage.setItem(VCONSOLE_STORAGE_KEY, "1");
  }

  if (value === "0") {
    window.localStorage.removeItem(VCONSOLE_STORAGE_KEY);
  }

  return value;
}

export default defineNuxtPlugin(async () => {
  const queryValue = syncDebugPreference();
  const enabledByStorage = window.localStorage.getItem(VCONSOLE_STORAGE_KEY) === "1";
  const shouldEnable = queryValue === "0" ? false : import.meta.dev || queryValue === "1" || enabledByStorage;

  if (!shouldEnable || window[VCONSOLE_INSTANCE_KEY]) {
    return;
  }

  const { default: VConsole } = await import("vconsole");

  window[VCONSOLE_INSTANCE_KEY] = new VConsole();
  console.info("[vconsole] enabled");
});
