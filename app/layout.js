import "./globals.css";
import "./device-responsive.css";
import RemoveOfflineSupport from "./components/RemoveOfflineSupport";
import EducationalServiceWorker from "./components/EducationalServiceWorker";

export const metadata = {
  title: "عَون",
  description: "منظومة عَون الإدارية",
  applicationName: "عَون",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    shortcut: ["/icons/icon-192.png"],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#174C35",
  colorScheme: "light",
};

export default function RootLayout({ children }) {
  return <html lang="ar" dir="rtl"><body><RemoveOfflineSupport /><EducationalServiceWorker />{children}</body></html>;
}
