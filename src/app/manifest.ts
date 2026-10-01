import type { MetadataRoute } from "next";

/* „Zum Startbildschirm hinzufügen“: Das Dashboard öffnet dann wie eine App, ohne Browserleiste. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EnergyEngel MB-Dashboard",
    short_name: "EnergyEngel",
    description: "Dashboard für Setter, Presetter, Closer und Admins",
    lang: "de",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F5F7F5",
    theme_color: "#1D4C37",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
