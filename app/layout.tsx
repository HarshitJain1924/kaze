import type { Metadata, Viewport } from "next";
import {
  Fraunces,
  IBM_Plex_Mono,
  Inter,
  Newsreader,
  Space_Grotesk,
} from "next/font/google";

import { PreferencesProvider } from "@/components/providers/preferences-provider";
import { SidebarProvider } from "@/components/providers/sidebar-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { PwaRegister } from "@/components/pwa-register";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// One family per design direction. Files are only fetched when a direction
// actually renders them; the variable names are what the token layer switches.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Kaze",
  title: {
    default: "Kaze — Anime Tracker",
    template: "%s · Kaze",
  },
  description:
    "A cinematic personal anime tracker. Discover series, track episodes, rate what you watch and keep your library in sync across devices.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Kaze",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: "Kaze — Anime Tracker",
    description:
      "Discover anime, track every episode and keep a personal library that syncs across devices.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#090a10" },
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
  ],
};

const themeScript = `(function(){try{var stored=localStorage.getItem('kaze-theme');var mode=stored==='light'||stored==='dark'||stored==='system'?stored:'dark';var resolved=mode==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):mode;var design=localStorage.getItem('kaze-design');if(design!=='broadcast'&&design!=='editorial'&&design!=='shelf'){design='broadcast';}var root=document.documentElement;root.dataset.design=design;root.classList.toggle('light',resolved==='light');root.dataset.theme=resolved;root.style.colorScheme=resolved;}catch(error){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      // Font variables live on the root so the direction blocks can resolve
      // their font stacks at the same element that carries `data-design`.
      className={`${inter.variable} ${spaceGrotesk.variable} ${fraunces.variable} ${newsreader.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeProvider>
          <PreferencesProvider>
            <SidebarProvider>
              <ToastProvider>{children}</ToastProvider>
            </SidebarProvider>
          </PreferencesProvider>
        </ThemeProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
