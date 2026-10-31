import type { Metadata } from "next";
import "./globals.css";
import "./workspace-design.css";
import "./trip-planning.css";
export const metadata: Metadata = {
  title: "Adventure OS — Plan the logistics. Preserve the adventure.",
  description: "Your personal expedition journal and planning workspace",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
