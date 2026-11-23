import { NextResponse } from "next/server";

export default function manifest() {
  return {
    id: "/",
    name: "عَون",
    short_name: "عَون",
    description: "منظومة عَون الإدارية",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F5F7F2",
    theme_color: "#174C35",
    icons: [
      {
        src: "/awon-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable"
      }
    ]
  };
}
