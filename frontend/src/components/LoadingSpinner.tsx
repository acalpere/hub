// Spinner amb el logo: el logo quiet i un anell vi amb un puntet de lluna que hi dona voltes.
// `small` és la versió en línia (converses, botons); la gran és la de pantalla de càrrega.
export function LogoSpinner({ small = false, label = "Carregant…" }: { small?: boolean; label?: string }) {
  return (
    <span className={`logo-spin${small ? " small" : ""}`} role="status">
      <img src="/logo.svg" alt="" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function LoadingSpinner() {
  return (
    <div className="loading-screen">
      <LogoSpinner />
    </div>
  );
}
