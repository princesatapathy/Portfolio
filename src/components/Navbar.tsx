import { NavLink } from "react-router-dom";

import { EXTRA_LINKS, SIDEBAR_LINKS, SITE_NAME } from "../constants";
import { github } from "../assets/icons";
import { useTheme } from "../context/ThemeContext";

// navbar
const Navbar = () => {
  const { isDusk, toggleTheme } = useTheme();

  return (
    <header className="header gap-5">
      {/* brand logo */}
      <NavLink
        to="/"
        className="size-10 min-w-10 shrink-0 aspect-square rounded-lg bg-white items-center justify-center flex font-bold shadow-md"
        title={SITE_NAME}
      >
        <p className="blue-gradient_text">
          {SITE_NAME.split(" ")[0][0] + "" + SITE_NAME.split(" ")[1][0]}
        </p>
      </NavLink>

      {/* nav links */}
      <nav className="flex text-lg gap-7 font-medium items-center justify-center">
        {SIDEBAR_LINKS.map((link) => (
          // each nav link
          <NavLink
            to={link.route}
            className={({ isActive }) =>
              isActive ? "text-blue-500" : "text-black dusk:text-slate-100"
            }
            title={link.label}
            key={`Link_${link.label}`}
          >
            {link.label}
          </NavLink>
        ))}

        {/* day / dusk toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-pressed={isDusk}
          aria-label={isDusk ? "Switch to day theme" : "Switch to dusk theme"}
          title={isDusk ? "Day theme" : "Dusk theme"}
          className="relative size-6 cursor-pointer text-black dusk:text-slate-100 transition-colors duration-500"
        >
          {/* sun */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className={`absolute inset-0 transition-all duration-500 ${isDusk ? "scale-50 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"}`}
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
          {/* moon */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`absolute inset-0 transition-all duration-500 ${isDusk ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-90 opacity-0"}`}
          >
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        </button>

        {/* github source code */}
        <NavLink
          to={EXTRA_LINKS.source_code}
          target="_blank"
          rel="noreferrer noopener"
          title="Source Code"
        >
          <img
            src={github}
            alt="Github"
            className="w-5 h-5 object-contain dusk:invert"
          />
        </NavLink>
      </nav>
    </header>
  );
};

export default Navbar;
