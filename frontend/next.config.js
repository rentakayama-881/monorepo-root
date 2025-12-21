const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    resolveAlias: {
      "@react-native-async-storage/async-storage": path.resolve(__dirname, "shims/async-storage.js"),
      "pino-pretty": path.resolve(__dirname, "shims/pino-pretty.js"),
    },
  },
};

module.exports = nextConfig;
