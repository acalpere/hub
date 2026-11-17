// Dictat per veu per a l'entorn semàntic (Web Speech API del navegador).
(() => {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const button = document.querySelector("#context-mic");
  const field = document.querySelector("#context");
  if (!Recognition || !button || !field) return; // navegador sense suport: el botó queda amagat
  button.hidden = false;

  let recognition = null;
  let base = "";

  const join = (a, b) => [a.trim(), b.trim()].filter(Boolean).join(" ");
  const setActive = (on) => {
    button.setAttribute("aria-pressed", String(on));
    button.title = on ? "Aturar el dictat" : "Dictar per veu";
  };

  function start() {
    recognition = new Recognition();
    recognition.lang = "ca-ES";
    recognition.continuous = true;
    recognition.interimResults = true;
    base = field.value;
    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) text += event.results[i][0].transcript;
      field.value = join(base, text).slice(0, field.maxLength);
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        alert("No tinc permís per usar el micròfon. Permet-ho a la configuració del navegador.");
      }
    };
    recognition.onend = () => {
      setActive(false);
      recognition = null;
    };
    recognition.start();
    setActive(true);
  }

  button.addEventListener("click", () => {
    if (recognition) recognition.stop();
    else start();
  });
})();
