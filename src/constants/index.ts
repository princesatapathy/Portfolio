// contains all constants to be used throughout the project
// dont' remove anything from here if not sure

import {
  css,
  estate,
  git,
  github,
  html,
  javascript,
  mongodb,
  nextjs,
  nodejs,
  react,
  summiz,
  tailwindcss,
  threads,
  snappy,
  typescript,
} from "../assets/icons";

export type SidebarLink = {
  route: string;
  label: string;
};

export type SkillType =
  | "Frontend"
  | "Backend"
  | "Version Control"
  | "Database"
  | "Animation"
  | "State Management";

export type Skill = {
  imageUrl: string;
  name: string;
  type: SkillType;
};

export type ExtraLinks = {
  source_code: string;
};

export type Experience = {
  title: string;
  company_name: string;
  icon: string;
  iconBg: string;
  date: string;
  points: string[];
};

export type Project = {
  iconUrl: string;
  theme: string;
  name: string;
  description: string;
  link: string;
};

// sidebar links
export const SIDEBAR_LINKS: SidebarLink[] = [
  {
    route: "/about",
    label: "About",
  },
  {
    route: "/projects",
    label: "Projects",
  },
  {
    route: "/contact",
    label: "Contact",
  },
];

// skills
export const SKILLS: Skill[] = [
  { imageUrl: html, name: "HTML", type: "Frontend" },
  { imageUrl: css, name: "CSS", type: "Frontend" },
  { imageUrl: javascript, name: "JavaScript", type: "Frontend" },
  { imageUrl: typescript, name: "TypeScript", type: "Frontend" },
  { imageUrl: react, name: "React", type: "Frontend" },
  { imageUrl: nextjs, name: "Next.js", type: "Frontend" },
  { imageUrl: tailwindcss, name: "Tailwind CSS", type: "Frontend" },
  { imageUrl: nodejs, name: "Node.js", type: "Backend" },
  { imageUrl: mongodb, name: "MongoDB", type: "Database" },
  { imageUrl: git, name: "Git", type: "Version Control" },
  { imageUrl: github, name: "GitHub", type: "Version Control" },
];

// site name
export const SITE_NAME = "Prince Satapathy";

// extra links
export const EXTRA_LINKS: ExtraLinks = {
  source_code: "https://github.com/princesatapathy",
};

// letter badge used as company icon (no logo assets for these companies)
const badge = (letter: string, bg: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="${bg}"/><text x="32" y="44" font-family="Arial,sans-serif" font-size="36" font-weight="700" text-anchor="middle" fill="#1f2937">${letter}</text></svg>`,
  )}`;

// experiences
export const EXPERIENCES: Experience[] = [
  {
    title: "Software Engineering Intern",
    company_name: "Anvitra",
    icon: badge("A", "#a2d2ff"),
    iconBg: "#a2d2ff",
    date: "Jul 2026 - Present",
    points: [
      "Built the Next.js operator console for a multi-tenant automation platform, keeping UI state in step with server rules (disabled actions, live cooldown countdown, confirmations, 5 s refetch while a run is active).",
      "Built and maintained a mutual fund data ingestion pipeline across 51 Indian AMCs and 4,500+ schemes, using Playwright/Chrome CDP scraping and PDF ingestion with SHA-256 content deduplication.",
      "Optimized a Go-based scheduled stock-research workflow from about 11 minutes to 3 minutes using Redis last-known-good caching, bounded polling and progressive retry timeouts.",
    ],
  },
  {
    title: "Web Development Intern",
    company_name: "ZenithWare",
    icon: badge("Z", "#b7e4c7"),
    iconBg: "#b7e4c7",
    date: "Jan 2025 - Jun 2025",
    points: [
      "Integrated React.js views with Spring Boot endpoints while keeping consistent REST API JSON contracts across 3 modules.",
      "Developed 6+ REST API endpoints with Java and Spring Boot, enabling integration of 3 internal modules.",
      "Designed a normalized MySQL schema with indexed foreign keys and wrote unit tests for 4 backend modules, validating 6+ REST APIs via Postman.",
    ],
  },
];

// projects
export const PROJECTS: Project[] = [
  {
    iconUrl: estate,
    theme: "btn-back-blue",
    name: "QuickStay - Hotel Booking Platform",
    description:
      "Airbnb-style booking app with a React + TypeScript frontend, JWT auth in HttpOnly cookies, Razorpay checkout and a Spring Boot backend with dynamic pricing and double-booking protection.",
    link: "https://QuickStay-eight.vercel.app",
  },
  {
    iconUrl: summiz,
    theme: "btn-back-green",
    name: "Cloud Share - File Sharing",
    description:
      "Credit-based file sharing SPA (React, Vite, Tailwind) with Clerk auth, direct-to-Supabase uploads via pre-signed URLs, Razorpay credit purchases and public share links.",
    link: "https://cloudsharewebapp-eight.vercel.app",
  },
  {
    iconUrl: snappy,
    theme: "btn-back-pink",
    name: "AI Calling Agent & Dashboard",
    description:
      "Sales-call intelligence platform with a real-time call cockpit: live transcription and AI pitch suggestions streamed to the operator UI over Supabase Realtime.",
    link: "https://ai-calling-dashboard-six.vercel.app/",
  },
  {
    iconUrl: threads,
    theme: "btn-back-yellow",
    name: "HopeHire - AI Recruitment",
    description:
      "AI recruitment platform with an autonomous multi-agent outreach workflow and a multi-tenant Kafka event pipeline for real-time interaction tracking.",
    link: "https://hopehire.in",
  },
];
