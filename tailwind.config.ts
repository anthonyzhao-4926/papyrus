import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{astro,html,ts,tsx,js,jsx,md,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "var(--c-bg)",
        "bg-elev": "var(--c-bg-elev)",
        border: "var(--c-border)",
        text: "var(--c-text)",
        "text-mute": "var(--c-text-mute)",
        "text-faint": "var(--c-text-faint)",
        accent: "var(--c-accent)",
        "code-bg": "var(--c-code-bg)",
      },
      fontFamily: {
        sans: ['-apple-system', '"Segoe UI"', '"PingFang SC"',
               '"Hiragino Sans GB"', '"Microsoft YaHei"', 'sans-serif'],
        mono: ['"SF Mono"', 'Menlo', 'Consolas', '"Liberation Mono"', 'monospace'],
      },
      maxWidth: {
        prose: "720px",
        page: "1280px",
      },
    },
  },
  plugins: [],
} satisfies Config;
