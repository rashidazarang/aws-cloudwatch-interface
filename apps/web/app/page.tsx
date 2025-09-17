import { LogExplorer } from '../src/components/log-explorer';

export default function HomePage() {
  return (
    <main>
      <h1>AWS CloudWatch Interface</h1>
      <p>
        Sign in to browse CloudWatch log groups, run Logs Insights queries, and manage saved searches.
        All operations run against your AWS account via secured serverless functions.
      </p>
      <LogExplorer />
    </main>
  );
}
