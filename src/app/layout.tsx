import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'VascuScan Pro 2.0 — Bilateral Vascular AI & 3D Saphenous Modeling',
  description: 'Clinical-grade bilateral varicose vein detection with self-trained YOLOv8-Medium, AccuVein subdermal glow, thermal stasis heatmaps, and photorealistic 3D human leg modeling.',
  keywords: ['varicose veins', 'vascular AI', 'CEAP staging', '3D anatomical leg', 'bilateral venous scan'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="noise selection:bg-amber-500/30 selection:text-amber-200">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}