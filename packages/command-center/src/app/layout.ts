import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SynqWorks Command Center',
  description: 'AI Workforce Platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-white font-mono antialiased">{children}</body>
    </html>
  );
}