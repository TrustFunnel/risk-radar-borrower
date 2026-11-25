// Light is the default look; dark is a choice in Account, kept on this device.
export const THEME_KEY = "afueni-theme";
export const DEFAULT_THEME: "light" | "dark" = "light";
// Runs before the page paints, so there is no flash of the wrong theme.
export const themeScript = `try{var t=localStorage.getItem("${THEME_KEY}")||"${DEFAULT_THEME}";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="${DEFAULT_THEME}"}`;
