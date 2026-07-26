import type { Metadata } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

export const metadata: Metadata = {
  title: "TTU Observatories Astronomical Target Visibility Tool | Texas Tech University",
  description:
    "Plan observations from Texas Tech University's Skyview and 3 Rivers Ranch observatories using target altitude, airmass, twilight, and Moon information.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
      {children}
      <ServiceWorkerRegister />
      </body>
    </html>
  );
}