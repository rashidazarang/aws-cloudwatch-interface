import { NextResponse } from 'next/server';

import { requireSupabaseUser } from '../../../src/lib/auth';
import { getSupabaseRepository } from '../../../src/lib/services';
import { savedQuerySchema } from '../../../src/lib/validation';

export async function GET(request: Request) {
  const authResult = await requireSupabaseUser(request, ['GET']);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;
  try {
    const repo = getSupabaseRepository();
    const saved = await repo.listSavedQueries(user.id);
    return NextResponse.json({ saved });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await requireSupabaseUser(request, ['POST']);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;
  let payload;
  try {
    const body = await request.json();
    payload = savedQuerySchema.parse(body);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid payload', details: (error as Error).message }, { status: 400 });
  }

  try {
    const repo = getSupabaseRepository();
    const saved = await repo.createSavedQuery({
      userId: user.id,
      name: payload.name,
      logGroup: payload.logGroup,
      queryString: payload.queryString,
      description: payload.description,
      tags: payload.tags,
    });

    return NextResponse.json({ saved });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
