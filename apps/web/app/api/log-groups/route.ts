import { NextResponse } from 'next/server';

import { requireSupabaseUser } from '../../../src/lib/auth';
import { getCloudWatchService } from '../../../src/lib/services';

export async function GET(request: Request) {
  const authResult = await requireSupabaseUser(request, ['GET']);
  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const cloudwatch = getCloudWatchService();
    const url = new URL(request.url);
    const nextToken = url.searchParams.get('nextToken') ?? undefined;
    const response = await cloudwatch.listLogGroups(nextToken);

    return NextResponse.json({
      logGroups: response.logGroups ?? [],
      nextToken: response.nextToken ?? null,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
