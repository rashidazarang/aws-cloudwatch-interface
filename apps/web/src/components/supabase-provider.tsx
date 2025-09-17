'use client';

import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import type { ReactNode } from 'react';
import { useState } from 'react';

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const [supabaseClient] = useState(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set');
    }

    return createBrowserClient(url, anonKey);
  });

  return (
    <SessionContextProvider supabaseClient={supabaseClient}>{children}</SessionContextProvider>
  );
}
