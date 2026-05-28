import type { Metadata } from "next";
import { Poppins, IBM_Plex_Mono, Libre_Baskerville } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

// Fuentes del tema elegant-luxury (tweakcn). Las variables se referencian desde globals.css.
const fontSans = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const fontMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const fontSerif = Libre_Baskerville({
  variable: "--font-libre-baskerville",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const DESCRIPTION =
  "Llevá el registro de tus partidos de tenis: torneos, rivales y estadísticas. Gratis.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Tenis Tracker",
    // Las páginas hijas pueden setear solo su título; este template arma el resto.
    template: "%s · Tenis Tracker",
  },
  description: DESCRIPTION,
  applicationName: "Tenis Tracker",
  keywords: ["tenis", "torneos", "partidos", "rivales", "estadísticas", "AUT", "Uruguay"],
  authors: [{ name: "Raphael Carvalho" }],
  openGraph: {
    type: "website",
    siteName: "Tenis Tracker",
    locale: "es_UY",
    url: "/",
    title: "Tenis Tracker",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: "Tenis Tracker",
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${fontSans.variable} ${fontMono.variable} ${fontSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
