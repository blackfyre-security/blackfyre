import type { Config } from "tailwindcss";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharedPreset = require("../shared/tailwind-preset.cjs");

const config: Config = {
  presets: [sharedPreset],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  plugins: [require("tailwindcss-animate")],
};

export default config;
