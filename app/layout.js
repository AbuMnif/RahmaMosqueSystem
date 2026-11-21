import "./globals.css";

export const metadata = {
  title: "منظومة رحَمة الإدارية | مسجد التراحم",
  description:
    "نظام إدارة حلقات تحفيظ القرآن الكريم في مسجد التراحم",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
