import "./globals.css";
import RemoveOfflineSupport from "./components/RemoveOfflineSupport";

export const metadata = {
  title: "منظومة عَون الإدارية | مسجد التراحم",
  description: "منظومة رقمية أُنشئت من قبل مسجد التراحم لتوحيد الأعمال التعليمية والإدارية، ومساندة الطلاب والمعلمين وأولياء الأمور.",
  applicationName: "عَون",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#174C35",
  colorScheme: "light",
};

export default function RootLayout({ children }) {
  return <html lang="ar" dir="rtl"><body><RemoveOfflineSupport />{children}</body></html>;
}
