'use client';

import { useState } from 'react';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';

export function AuthPanel() {
  const supabase = useSupabaseClient();
  const session = useSession();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatus('Sending magic link...');

    const { error: signInError } = await supabase.auth.signInWithOtp({ email });

    if (signInError) {
      setError(signInError.message);
      setStatus(null);
      return;
    }

    setStatus('Check your inbox for the magic link.');
    setEmail('');
  };

  const handleSignOut = async () => {
    setError(null);
    setStatus(null);
    await supabase.auth.signOut();
  };

  if (session) {
    return (
      <div className="auth-panel">
        <p>
          Signed in as <strong>{session.user?.email}</strong>
        </p>
        <button type="button" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="auth-panel">
      <h2>Sign in</h2>
      <form onSubmit={handleSignIn}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />
        <button type="submit">Send magic link</button>
      </form>
      {status && <p className="status">{status}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
