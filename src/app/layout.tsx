import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Outreach B2B — Multicanal",
  description: "Prospection B2B personnalisée (LinkedIn + email) conforme RGPD",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
