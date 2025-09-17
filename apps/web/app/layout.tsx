import './globals.css';
import type { ReactNode } from 'react';

import { SupabaseProvider } from '../src/components/supabase-provider';

export const metadata = {
  title: 'AWS CloudWatch Interface',
  description: 'Open-source toolkit for exploring CloudWatch Logs with REST and MCP access.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SupabaseProvider>{children}</SupabaseProvider>
      </body>
    </html>
  );
}
