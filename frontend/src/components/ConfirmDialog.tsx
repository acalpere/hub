import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface Props {
  title: string;
  text?: string;
  yes?: string;
  no?: string;
  onYes: () => void;
  onNo: () => void;
}

// Finestra de confirmació pròpia (en lloc de window.confirm): «Sí» en verd i «No» en vermell; el focus comença a «No».
export function ConfirmDialog({ title, text, yes = "Sí", no = "No", onYes, onNo }: Props) {
  const noButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    noButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onNo();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onNo]);

  return createPortal(
    <div className="dlg-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onNo()}>
      <div className="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dlg-title">
        <h2 id="dlg-title">{title}</h2>
        {text && <p>{text}</p>}
        <div className="dlg-actions">
          <button type="button" ref={noButton} className="no" onClick={onNo}>{no}</button>
          <button type="button" onClick={onYes}>{yes}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
