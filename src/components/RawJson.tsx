export function RawJson({ data }: { data: unknown }) {
  return (
    <details className="panel">
      <summary>Raw JSON</summary>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </details>
  );
}
