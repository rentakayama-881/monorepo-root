/** @type {import('@commitlint/types').UserConfig} */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      ["frontend", "backend", "feature-svc", "ops", "ai", "docs", "ci", "deps"],
    ],
  },
};

export default config;
