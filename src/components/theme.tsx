import { createContext, useContext, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void; set: (t: Theme) => void }>({
  theme: "light",
  toggle: () => {},
  set: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
      ? "dark"
      : "light",
  );
  const apply = (t: Theme) => {
    setTheme(t);
    document.documentElement.classList.toggle("dark", t === "dark");
    try {
      localStorage.setItem("ledgevue-theme", t);
    } catch {
      /* ignore */
    }
  };
  return (
    <ThemeCtx.Provider
      value={{ theme, toggle: () => apply(theme === "dark" ? "light" : "dark"), set: apply }}
    >
      {children}
    </ThemeCtx.Provider>
  );
}
export const useTheme = () => useContext(ThemeCtx);
