import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SynqWorks — Run a Business. Solo.',
  description: 'Build an AI workforce that manages your admin and amplifies your ideas. SynqAgent, SynqPost, SynqMind — all under one roof.',
  openGraph: {
    title: 'SynqWorks — Run a Business. Solo.',
    description: 'AI tools for solo operators. Your workforce, your rules.',
    type: 'website',
    url: 'https://synqworks.techtrendwire.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SynqWorks — Run a Business. Solo.',
    description: 'AI tools for solo operators.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-white font-mono antialiased">{children}</body>
    </html>
  );
}
