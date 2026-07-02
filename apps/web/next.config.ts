import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Plusieurs lockfiles présents sur la machine : fixer la racine du
  // monorepo pour éviter que Turbopack surveille tout le home.
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
};

export default nextConfig;
