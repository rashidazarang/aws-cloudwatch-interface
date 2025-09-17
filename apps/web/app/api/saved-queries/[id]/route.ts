import { NextResponse } from 'next/server';

import { requireSupabaseUser } from '../../../../src/lib/auth';
import { getSupabaseRepository } from '../../../../src/lib/services';

export async function DELETE(request: Request, context: { params: { id: string } }) {
  const authResult = await requireSupabaseUser(request, ['DELETE']);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;
  const { id } = context.params;

  if (!id) {
    return NextResponse.json({ error: 'Missing saved query id' }, { status: 400 });
  }

  try {
    const repo = getSupabaseRepository();
    await repo.deleteSavedQuery(id, user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
