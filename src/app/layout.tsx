import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AppStateProvider } from "@/providers/app-state-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIO Personal Tracker",
  description:
    "Personal operating system untuk keuangan, hutang, task, project, note, wishlist, dan belanja.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AppStateProvider>{children}</AppStateProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
