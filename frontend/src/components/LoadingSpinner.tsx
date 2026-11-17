export function LoadingSpinner() {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">Carregant…</span>
    </div>
  );
}
