import { useState, type InputHTMLAttributes } from "react";

// Camp de clau amb l'ull per mostrar o amagar el text.
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <span className="pw">
      <input {...props} type={shown ? "text" : "password"} />
      <button
        type="button"
        className="pw-eye"
        aria-label={shown ? "Amaga la clau" : "Mostra la clau"}
        aria-pressed={shown}
        title={shown ? "Amaga la clau" : "Mostra la clau"}
        onClick={() => setShown((s) => !s)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 12s3.500-7 10-7 10 7 10 7-3.500 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {shown && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </span>
  );
}
