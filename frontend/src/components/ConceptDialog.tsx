import { useEffect } from "react";
import { createPortal } from "react-dom";
import { TutorChat } from "./TutorChat";

interface Props {
  service: string;
  concept: string;
  onClose: () => void;
}

// «?» d'un concepte: explicació més profunda feta pel tutor i espai per fer-li preguntes, escrivint o amb la veu.
export function ConceptDialog({ service, concept, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = before;
    };
  }, [onClose]);

  return createPortal(
    <div className="dlg-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dlg concept" role="dialog" aria-modal="true" aria-label={`Més detalls: ${service}`}>
        <button type="button" className="concept-x" aria-label="Tanca" onClick={onClose}>×</button>
        <p className="concept-service">{service}</p>
        <p className="concept-topic">{concept}</p>
        <TutorChat service={service} concept={concept} autoStart placeholder="Pregunta'n més…" />
      </div>
    </div>,
    document.body,
  );
}
