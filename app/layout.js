import "./globals.css";

export const metadata = {
  title: "منظومة عَون الإدارية | مسجد التراحم",
  description:
    "منظومة رقمية أُنشئت من قبل مسجد التراحم لتوحيد الأعمال التعليمية والإدارية، ومساندة الطلاب والمعلمين وأولياء الأمور.",
  applicationName: "عَون",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "عَون",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#174C35",
  colorScheme: "light",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
