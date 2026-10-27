import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "day" | "dusk";

const THEME_STORAGE_KEY = "portfolio-theme";

type ThemeContextValue = {
  theme: Theme;
  isDusk: boolean;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// saved choice wins; first visit follows the system light/dark preference
const readInitialTheme = (): Theme => {
  try {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "day" || savedTheme === "dusk") return savedTheme;
  } catch {
    // storage can be blocked (private mode); fall through to system preference
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dusk"
    : "day";
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  // `data-theme` drives the `dusk:` Tailwind variant and the CSS in index.css
  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // not persisted, still works for this visit
    }
  }, [theme]);

  const toggleTheme = () =>
    setTheme((previous) => (previous === "day" ? "dusk" : "day"));

  return (
    <ThemeContext.Provider
      value={{ theme, isDusk: theme === "dusk", toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }

  return context;
};
