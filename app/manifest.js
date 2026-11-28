export default function manifest() {
  return {
    id: "/dashboard",
    name: "عَون",
    short_name: "عَون",
    description: "منظومة عَون الإدارية",
    lang: "ar",
    dir: "rtl",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#F5F7F2",
    theme_color: "#174C35",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ]
  };
}
