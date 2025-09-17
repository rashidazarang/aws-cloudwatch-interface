import { NextResponse } from 'next/server';

import { getSupabaseAuthService } from './services';

type Method = 'GET' | 'POST' | 'DELETE' | 'PUT';

interface AuthSuccess {
  user: {
    id: string;
    email?: string;
    role: 'admin' | 'member';
  };
}

export async function requireSupabaseUser(
  request: Request,
  allowedMethods: Method[] = ['GET', 'POST'],
): Promise<AuthSuccess | NextResponse> {
  const { method } = request;
  if (!allowedMethods.includes(method as Method)) {
    return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
  }

  const header = request.headers.get('authorization') ?? '';
  const [, token] = header.split(' ');

  if (!token) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });
  }

  try {
    const authService = getSupabaseAuthService();
    const authenticated = await authService.getUserFromAccessToken(token);

    return {
      user: {
        id: authenticated.id,
        email: authenticated.email,
        role: authenticated.role,
      },
    };
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
}
