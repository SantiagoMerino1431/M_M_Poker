import type { Metadata } from "next"
import { Barlow_Condensed, Inter } from "next/font/google"
import Link from "next/link"
import "./globals.css"
import { UserProvider } from "@/components/UserContext"
import { UserSetupModal } from "@/components/UserSetupModal"
import { NavUser } from "@/components/NavUser"

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-display",
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
})

export const metadata: Metadata = {
  title: "Betting Assistant · Mundial 2026",
  description: "Análisis y gestión de apuestas partido a partido",
}

const NAV_LINKS = [
  { href: "/hoy",      label: "HOY" },
  { href: "/partidos", label: "PARTIDOS" },
  { href: "/grupos",   label: "GRUPOS" },
  { href: "/historial", label: "HISTORIAL" },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${barlowCondensed.variable} ${inter.variable}`}>
      <body>
        <UserProvider>
          <UserSetupModal />
          <nav style={{
            position: "sticky", top: 0, zIndex: 100,
            background: "var(--surface)", borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 0,
            padding: "0 24px", height: 48,
          }}>
            <Link href="/hoy" style={{
              textDecoration: "none", marginRight: 8,
              fontFamily: "var(--font-display)", fontWeight: 800,
              fontSize: 16, textTransform: "uppercase", letterSpacing: "0.06em",
              color: "var(--accent)",
            }}>
              MM
            </Link>
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} style={{
                textDecoration: "none",
                fontFamily: "var(--font-display)", fontWeight: 700,
                fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em",
                color: "var(--text-muted)", padding: "0 14px", height: "100%",
                display: "flex", alignItems: "center",
              }}>
                {label}
              </Link>
            ))}
            <NavUser />
          </nav>
          <main>{children}</main>
          <footer style={{
            borderTop: "1px solid var(--border)",
            padding: "12px 24px",
            fontSize: 11,
            color: "var(--text-muted)",
            textAlign: "center",
          }}>
            Herramienta de análisis personal. No constituye asesoría de apuestas.
          </footer>
        </UserProvider>
      </body>
    </html>
  )
}
