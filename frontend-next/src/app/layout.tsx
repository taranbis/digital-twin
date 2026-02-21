import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Digital Twin - Control Room',
  description: 'Real-time digital twin dashboard for a rotating automotive component',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
