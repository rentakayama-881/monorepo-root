/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      ["frontend", "backend", "feature-svc", "ops", "ai", "docs", "ci", "deps"],
    ],
  },
};
