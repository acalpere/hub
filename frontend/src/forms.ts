// Validació pròpia dels formularis (amb `noValidate`): els errors surten amb el mateix aspecte
// que la resta, en lloc de les bombolles del navegador.
type Field = HTMLInputElement | HTMLSelectElement;

function labelOf(el: Field): string {
  const text = el.closest("label")?.childNodes[0]?.textContent?.trim();
  return text || (el as HTMLInputElement).placeholder || el.name;
}

export function validate(form: HTMLFormElement): string {
  for (const el of Array.from(form.elements) as Field[]) {
    if (!("validity" in el) || !el.willValidate || el.validity.valid) continue;
    el.focus();
    const label = labelOf(el);
    if (el.validity.valueMissing) return `${label}: és un camp obligatori.`;
    if (el.validity.tooShort) return `${label}: mínim ${(el as HTMLInputElement).minLength} caràcters.`;
    if (el.validity.typeMismatch) return `${label}: el format no és vàlid.`;
    if (el.validity.patternMismatch) return `${label}: el format no és vàlid.`;
    return `${label}: el valor no és vàlid.`;
  }
  return "";
}
