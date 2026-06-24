import { Inter } from 'next/font/google';
import '../index.css';
import ClientAppWrapper from '../components/ClientAppWrapper';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-inter',
});

export const metadata = {
  title: 'SIRA - Asset & Inventory Verification',
  description: 'SIRA - Inventory and Asset Verification App',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#f5f5f7] text-[#1d1d1f] min-h-screen antialiased selection:bg-black selection:text-white`}>
        <ClientAppWrapper>
          {children}
        </ClientAppWrapper>
      </body>
    </html>
  );
}
