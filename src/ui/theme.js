const STORAGE_KEY = "phx_drive_theme";

export function getStoredThemePreference() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "system";
  } catch {
    return "system";
  }
}

export function setStoredThemePreference(preference) {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // ignore write failures (e.g. storage disabled)
  }
}

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(preference) {
  return preference === "system"
    ? systemPrefersDark()
      ? "dark"
      : "light"
    : preference;
}

export function applyTheme(preference) {
  document.documentElement.setAttribute("data-theme", resolveTheme(preference));
}

export function setTheme(preference) {
  setStoredThemePreference(preference);
  applyTheme(preference);
}

let systemChangeListenerAttached = false;

export function initTheme() {
  applyTheme(getStoredThemePreference());

  if (!systemChangeListenerAttached) {
    systemChangeListenerAttached = true;
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (getStoredThemePreference() === "system") {
        applyTheme("system");
      }
    });
  }
}
