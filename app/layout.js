import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

export const metadata = {
  title: "DAC Joint Inspection & Key Handover",
  description: "Digital joint inspection checklist for DAC Developers key handover.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/apple-icon.png",
  },
};

export const viewport = {
  themeColor: "#0b234a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
