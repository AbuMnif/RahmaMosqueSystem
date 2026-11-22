export default function manifest() {
  return {
    id: "/dashboard",
    name: "منظومة عَون الإدارية",
    short_name: "عَون",
    description:
      "منظومة رقمية أُنشئت من قبل مسجد التراحم لتوحيد الأعمال التعليمية والإدارية.",
    lang: "ar",
    dir: "rtl",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F5F7F2",
    theme_color: "#174C35",
    categories: ["education", "productivity"],
  };
}
