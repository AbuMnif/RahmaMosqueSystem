import "./globals.css";
import RemoveOfflineSupport from "./components/RemoveOfflineSupport";

export const metadata = {
  title: "عَون",
  description: "منظومة عَون الإدارية",
  applicationName: "عَون",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/awon-icon.svg", type: "image/svg+xml" }],
    shortcut: ["/awon-icon.svg"],
    apple: [{ url: "/awon-icon.svg", type: "image/svg+xml" }]
  },
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
