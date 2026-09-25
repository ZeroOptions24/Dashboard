import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Datenbanktreiber nicht bündeln */
  serverExternalPackages: ["pg"],
};

export default nextConfig;
