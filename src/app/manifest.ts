import type { MetadataRoute } from "next";

// Lets students add the website to their phone's home screen like an app.
// Colours match the design tokens (Forest and Paper).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Speaking Easy with Practise",
    short_name: "Speaking Easy",
    description: "Daily IELTS and CEFR speaking practice",
    start_url: "/home",
    display: "standalone",
    background_color: "#fafaf7",
    theme_color: "#404e3b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
