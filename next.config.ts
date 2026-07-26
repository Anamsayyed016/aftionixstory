import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Parent monorepo lockfile was making Turbopack treat the wrong folder as root,
  // which can break relative public/uploads paths during local `next dev`.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
