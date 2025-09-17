import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireSupabaseUser } from '../../../src/lib/auth';
import { getSupabaseRepository } from '../../../src/lib/services';

const queryParse = z.object({
  limit: z.string().optional(),
  offset: z.string().optional(),
});

export async function GET(request: Request) {
  const authResult = await requireSupabaseUser(request, ['GET']);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;

  const url = new URL(request.url);
  const query = queryParse.parse(Object.fromEntries(url.searchParams.entries()));

  const limit = query.limit ? Number.parseInt(query.limit, 10) : undefined;
  const offset = query.offset ? Number.parseInt(query.offset, 10) : undefined;

  try {
    const repo = getSupabaseRepository();
    const history = await repo.listQueryHistory(user.id, { limit, offset });
    return NextResponse.json({ history });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
