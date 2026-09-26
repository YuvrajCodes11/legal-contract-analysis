import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Legal Contract Analysis Workstation',
  description: 'Mission-critical legal contract analysis workstation with verified quote citation engine.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full bg-zinc-950 text-zinc-100 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
        {children}
      </body>
    </html>
  );
}
