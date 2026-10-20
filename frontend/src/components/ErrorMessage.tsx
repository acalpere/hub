// Missatge d'error únic per a tota l'app: mateix aspecte als formularis i a les pàgines.
export function ErrorMessage({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="alert">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.500v5.500M12 16.500v.01" />
      </svg>
      <span>{message}</span>
    </div>
  );
}
