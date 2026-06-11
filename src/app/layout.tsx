import type { Metadata } from "next"
import { Barlow_Condensed, Inter } from "next/font/google"
import "./globals.css"

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
  title: "Predictor IA | Mundial 2026",
  description: "Proyecciones estadísticas de todos los mercados del Mundial 2026. Análisis de entretenimiento.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${barlowCondensed.variable} ${inter.variable}`}>
      <body>
        <header style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          padding: "0 24px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "0.04em",
              color: "var(--accent)",
              textTransform: "uppercase",
            }}>
              MM&nbsp;<span style={{ color: "var(--text)" }}>Predictor</span>
            </span>
            <span style={{
              fontSize: 11,
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "2px 6px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}>
              Mundial 2026
            </span>
          </div>
          <nav style={{ display: "flex", gap: 24, fontSize: 13, color: "var(--text-muted)" }}>
            <a href="/" style={{ color: "inherit", textDecoration: "none" }}>Inicio</a>
            <a href="/grupos" style={{ color: "inherit", textDecoration: "none" }}>Grupos</a>
            <a href="/partidos" style={{ color: "inherit", textDecoration: "none" }}>Partidos</a>
          </nav>
        </header>
        <main>{children}</main>
        <footer style={{
          borderTop: "1px solid var(--border)",
          padding: "16px 24px",
          fontSize: 11,
          color: "var(--text-muted)",
          textAlign: "center",
        }}>
          Análisis estadístico de entretenimiento. No constituye asesoría de apuestas ni inversión.
        </footer>
      </body>
    </html>
  )
}
