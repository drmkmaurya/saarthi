import { Inter, Noto_Sans_Devanagari } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-hindi',
});

export const metadata = {
  title: 'सारथी (Saarthi) - AI Wellness & Vastu Assistant',
  description: 'Acupressure, Vastu Shastra & Daily Suprabhat Studio',
  manifest: '/manifest.json',
  themeColor: '#f97316',
};

export default function RootLayout({ children }) {
  return (
    <html lang="hi" className={`${inter.variable} ${notoDevanagari.variable}`}>
      <body className="bg-stone-50 text-slate-800 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
