import { useId } from "react";
import { createPortal } from "react-dom";

// Spinner amb el logo: el Cyrano quiet, amb la seva lluna de fusta a dalt a la dreta, i una llum de lluna que li il·lumina la cara i s'apaga lentament.
// `small` és la versió en línia (converses, botons); la gran és la de pantalla de càrrega.
export function LogoSpinner({ small = false, big = false, label = "Carregant…" }: { small?: boolean; big?: boolean; label?: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <span className={`logo-spin${small ? " small" : ""}${big ? " big" : ""}`} role="status">
      <img src="/logo-spinner.png" alt="" />
      <span className="lsp-light" aria-hidden="true" />
      <svg className="lsp-moon" viewBox="0 0 120 120" aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}w`} x1="0.1" y1="0" x2="0.9" y2="1">
            <stop offset="0" stopColor="#f8dfb0" />
            <stop offset="0.55" stopColor="#dba969" />
            <stop offset="1" stopColor="#a87a45" />
          </linearGradient>
          <pattern id={`${uid}p`} width="120" height="10" patternUnits="userSpaceOnUse">
            <rect width="120" height="1.4" fill="#5a3814" opacity="0.4" />
            <rect y="1.4" width="120" height="1" fill="#fff3d6" opacity="0.2" />
          </pattern>
          <mask id={`${uid}m`}>
            <rect width="120" height="120" fill="#000" />
            <circle cx="60" cy="60" r="52" fill="#fff" />
            <circle className="lsp-cut" cx="60" cy="60" r="52" fill="#000" />
          </mask>
        </defs>
        <g mask={`url(#${uid}m)`}>
          <rect width="120" height="120" fill={`url(#${uid}w)`} />
          <rect width="120" height="120" fill={`url(#${uid}p)`} />
        </g>
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function LoadingSpinner() {
  return (
    <div className="loading-screen">
      <LogoSpinner big />
      <span className="loading-caption" aria-hidden="true">Carregant…</span>
    </div>
  );
}

// Spinner al mig de la pantalla, a sobre de tot, mentre es carrega o es prepara alguna cosa (a qualsevol mida de pantalla).
export function CenterSpinner({ label = "Carregant…" }: { label?: string }) {
  return createPortal(
    <div className="center-spin">
      <LogoSpinner big label={label} />
    </div>,
    document.body,
  );
}
