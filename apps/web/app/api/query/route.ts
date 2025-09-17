import { NextResponse } from 'next/server';

import { requireSupabaseUser } from '../../../src/lib/auth';
import { getCloudWatchService, getSupabaseRepository } from '../../../src/lib/services';
import { logQuerySchema } from '../../../src/lib/validation';

export async function POST(request: Request) {
  const authResult = await requireSupabaseUser(request, ['POST']);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user } = authResult;

  let payload;
  try {
    const body = await request.json();
    payload = logQuerySchema.parse(body);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request payload', details: getErrorMessage(error) }, { status: 400 });
  }

  const cloudwatch = getCloudWatchService();
  const supabase = getSupabaseRepository();

  const history = await supabase.createQueryHistory({
    requesterType: 'user',
    requesterId: user.id,
    logGroup: payload.logGroupName,
    queryString: payload.queryString,
    status: 'pending',
  });

  try {
    const result = await cloudwatch.runQuery(
      {
        logGroupName: payload.logGroupName,
        queryString: payload.queryString,
        window: {
          startTime: new Date(payload.startTime),
          endTime: new Date(payload.endTime),
        },
        limit: payload.limit,
      },
      {
        pollIntervalMs: payload.pollIntervalMs,
        maxPollAttempts: payload.maxPollAttempts,
      },
    );

    await supabase.updateQueryHistory(history.id, {
      status: result.status === 'succeeded' ? 'succeeded' : 'failed',
      resultRowCount: result.records.length,
      cloudwatchQueryId: result.queryId,
    });

    return NextResponse.json({
      historyId: history.id,
      queryId: result.queryId,
      status: result.status,
      records: result.records,
      statistics: result.statistics ?? null,
    });
  } catch (error) {
    await supabase.updateQueryHistory(history.id, {
      status: 'failed',
      errorMessage: getErrorMessage(error),
    });

    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}
