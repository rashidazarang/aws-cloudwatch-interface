'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from '@supabase/auth-helpers-react';

import type { LogQueryResultRecord } from '@aws-cloudwatch-interface/services';

import { AuthPanel } from './auth-panel';

interface SavedQuery {
  id: string;
  name: string;
  log_group: string;
  query_string: string;
  description: string | null;
  tags: string[] | null;
  created_at: string;
}

interface QueryResponse {
  historyId: string;
  queryId: string;
  status: string;
  records: LogQueryResultRecord[];
  statistics: Record<string, unknown> | null;
}

interface QueryHistoryEntry {
  id: string;
  log_group: string;
  query_string: string;
  created_at: string;
  status: string;
  result_row_count: number | null;
  error_message: string | null;
}

function toInputValue(date: Date) {
  return date.toISOString().slice(0, 16);
}

function toIsoString(value: string) {
  const date = new Date(value);
  return date.toISOString();
}

export function LogExplorer() {
  const session = useSession();
  const accessToken = session?.access_token ?? null;

  const [logGroups, setLogGroups] = useState<string[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [isLoadingLogGroups, setIsLoadingLogGroups] = useState(false);
  const [selectedLogGroup, setSelectedLogGroup] = useState('');

  const now = useMemo(() => new Date(), []);
  const initialStart = useMemo(() => {
    const copy = new Date(now.getTime());
    copy.setMinutes(copy.getMinutes() - 15);
    return copy;
  }, [now]);

  const [startTime, setStartTime] = useState(toInputValue(initialStart));
  const [endTime, setEndTime] = useState(toInputValue(now));
  const [queryString, setQueryString] = useState(
    'fields @timestamp, @message\n| sort @timestamp desc\n| limit 20',
  );
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isRunningQuery, setIsRunningQuery] = useState(false);

  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);
  const [savedError, setSavedError] = useState<string | null>(null);

  const [queryHistory, setQueryHistory] = useState<QueryHistoryEntry[]>([]);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyHasMore, setHistoryHasMore] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      setLogGroups([]);
      setSelectedLogGroup('');
      setSavedQueries([]);
      setQueryHistory([]);
      setHistoryOffset(0);
      setHistoryHasMore(true);
      return;
    }

    void loadLogGroups(accessToken);
    void loadSavedQueries(accessToken);
    void loadQueryHistory(accessToken, { reset: true });
  }, [accessToken]);

  useEffect(() => {
    if (!selectedLogGroup && logGroups.length > 0) {
      setSelectedLogGroup(logGroups[0]);
    }
  }, [logGroups, selectedLogGroup]);

  const loadLogGroups = async (token: string, tokenArg?: string | null, append = false) => {
    setIsLoadingLogGroups(true);
    try {
      const params = tokenArg ? `?nextToken=${encodeURIComponent(tokenArg)}` : '';
      const response = await fetch(`/api/log-groups${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? 'Failed to load log groups');
      }

      const groups = (body.logGroups ?? [])
        .map((group: any) => (typeof group === 'string' ? group : group?.logGroupName))
        .filter(Boolean) as string[];

      setLogGroups((prev) => {
        const combined = append ? [...prev, ...groups] : groups;
        return Array.from(new Set(combined));
      });
      setNextToken(body.nextToken ?? null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingLogGroups(false);
    }
  };

  const loadSavedQueries = async (token: string) => {
    try {
      const response = await fetch('/api/saved-queries', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? 'Failed to load saved queries');
      }

      setSavedQueries(body.saved ?? []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadQueryHistory = async (
    token: string,
    options: { reset?: boolean; offset?: number } = {},
  ) => {
    if (historyLoading) return;
    setHistoryLoading(true);
    try {
      const offset = options.reset ? 0 : options.offset ?? historyOffset;
      const limit = 10;
      const response = await fetch(`/api/query-history?offset=${offset}&limit=${limit}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? 'Failed to load query history');
      }

      const entries = (body.history ?? []) as QueryHistoryEntry[];
      setQueryHistory((prev) => (options.reset ? entries : [...prev, ...entries]));
      const nextOffset = offset + entries.length;
      setHistoryOffset(nextOffset);
      setHistoryHasMore(entries.length === limit);
    } catch (error) {
      console.error(error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRunQuery = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) return;

    setIsRunningQuery(true);
    setQueryError(null);
    setQueryResult(null);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          logGroupName: selectedLogGroup,
          queryString,
          startTime: toIsoString(startTime),
          endTime: toIsoString(endTime),
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? 'Query failed');
      }

      setQueryResult(body);
      if (accessToken) {
        await loadQueryHistory(accessToken, { reset: true });
      }
    } catch (error) {
      setQueryError((error as Error).message);
    } finally {
      setIsRunningQuery(false);
    }
  };

  const handleSaveQuery = async () => {
    if (!accessToken) return;
    setSavedStatus('Saving query...');
    setSavedError(null);

    try {
      const name = window.prompt('Name this saved query', `Query for ${selectedLogGroup}`);
      const trimmed = name?.trim();
      if (!trimmed) {
        setSavedStatus('Save cancelled');
        setTimeout(() => setSavedStatus(null), 1_500);
        return;
      }

      const response = await fetch('/api/saved-queries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name: trimmed,
          logGroup: selectedLogGroup,
          queryString,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? 'Unable to save query');
      }

      setSavedStatus('Query saved');
      await loadSavedQueries(accessToken);
    } catch (error) {
      setSavedError((error as Error).message);
    } finally {
      setTimeout(() => setSavedStatus(null), 2_000);
    }
  };

  const handleApplySavedQuery = (saved: SavedQuery) => {
    setSelectedLogGroup(saved.log_group);
    setQueryString(saved.query_string);
  };

  const handleDeleteSavedQuery = async (id: string) => {
    if (!accessToken) return;
    try {
      const response = await fetch(`/api/saved-queries/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? 'Unable to delete saved query');
      }

      await loadSavedQueries(accessToken);
    } catch (error) {
      setSavedError((error as Error).message);
    }
  };

  const renderQueryResult = () => {
    if (isRunningQuery) {
      return <p>Running query...</p>;
    }

    if (queryError) {
      return <p className="error">{queryError}</p>;
    }

    if (!queryResult) {
      return <p>Run a query to see results.</p>;
    }

    return (
      <div className="query-result">
        <p>
          Status: <strong>{queryResult.status}</strong> | Rows: {queryResult.records.length}
        </p>
        {queryResult.statistics && (
          <pre>{JSON.stringify(queryResult.statistics, null, 2)}</pre>
        )}
        <pre>{JSON.stringify(queryResult.records, null, 2)}</pre>
      </div>
    );
  };

  return (
    <section className="log-explorer">
      <AuthPanel />

      {!accessToken && <p>Please sign in to browse CloudWatch data.</p>}

      {accessToken && (
        <div className="explorer-grid">
          <div className="log-controls">
            <h2>Log Groups</h2>
            <button
              type="button"
              onClick={() => loadLogGroups(accessToken)}
              disabled={isLoadingLogGroups}
            >
              Refresh
            </button>
            <ul className="log-group-list">
              {logGroups.map((group) => (
                <li key={group}>
                  <button
                    type="button"
                    className={group === selectedLogGroup ? 'selected' : ''}
                    onClick={() => setSelectedLogGroup(group)}
                  >
                    {group}
                  </button>
                </li>
              ))}
            </ul>
            {nextToken && (
              <button
                type="button"
                onClick={() => loadLogGroups(accessToken, nextToken, true)}
                disabled={isLoadingLogGroups}
              >
                Load more
              </button>
            )}
          </div>

          <div className="query-panel">
            <h2>Run Query</h2>
            <form onSubmit={handleRunQuery}>
              <label htmlFor="logGroup">Log group</label>
              <input id="logGroup" type="text" value={selectedLogGroup} readOnly />

              <div className="time-range">
                <div>
                  <label htmlFor="startTime">Start</label>
                  <input
                    id="startTime"
                    type="datetime-local"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="endTime">End</label>
                  <input
                    id="endTime"
                    type="datetime-local"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    required
                  />
                </div>
              </div>

              <label htmlFor="query">Query</label>
              <textarea
                id="query"
                value={queryString}
                onChange={(event) => setQueryString(event.target.value)}
                rows={6}
                required
              />

              <div className="query-actions">
                <button type="submit" disabled={isRunningQuery || !selectedLogGroup}>
                  Run query
                </button>
                <button type="button" onClick={handleSaveQuery}>
                  Save query
                </button>
              </div>
            </form>

            {savedStatus && <p className="status">{savedStatus}</p>}
            {savedError && <p className="error">{savedError}</p>}

            {renderQueryResult()}
          </div>

          <div className="saved-queries">
            <h2>Saved Queries</h2>
            {savedQueries.length === 0 && <p>No saved queries yet.</p>}
            <ul>
              {savedQueries.map((saved) => (
                <li key={saved.id}>
                  <div>
                    <strong>{saved.name}</strong>
                    <p>{saved.log_group}</p>
                  </div>
                  <div className="saved-actions">
                    <button type="button" onClick={() => handleApplySavedQuery(saved)}>
                      Load
                    </button>
                    <button type="button" onClick={() => handleDeleteSavedQuery(saved.id)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="query-history">
            <h2>Query History</h2>
            {queryHistory.length === 0 && <p>No history yet.</p>}
            {queryHistory.length > 0 && (
              <ul>
                {queryHistory.map((entry) => (
                  <li key={entry.id}>
                    <div>
                      <strong>{new Date(entry.created_at).toLocaleString()}</strong>
                      <p>{entry.log_group}</p>
                      <p className="query-text">{entry.query_string}</p>
                    </div>
                    <div className="history-meta">
                      <span>Status: {entry.status}</span>
                      <span>Rows: {entry.result_row_count ?? 0}</span>
                      {entry.error_message && <span className="error">{entry.error_message}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {historyHasMore && (
              <button
                type="button"
                disabled={historyLoading}
                onClick={() => accessToken && loadQueryHistory(accessToken, { offset: historyOffset })}
              >
                {historyLoading ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
