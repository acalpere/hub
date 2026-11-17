const form = document.querySelector("#search-form");
const resultsSection = document.querySelector("#results-section");
const resultsGrid = document.querySelector("#results-grid");
const resultCount = document.querySelector("#result-count");
const emptyState = document.querySelector("#empty-state");
const notice = document.querySelector("#notice");
const loadMore = document.querySelector("#load-more");
const modeSynonyms = document.querySelector("#mode-synonyms");
const modeRhymes = document.querySelector("#mode-rhymes");
const synonymsSection = document.querySelector("#synonyms-section");
const synonymsTitle = document.querySelector("#synonyms-title");
const synonymsCount = document.querySelector("#synonyms-count");
const synonymsList = document.querySelector("#synonyms-list");
const synonymsEmpty = document.querySelector("#synonyms-empty");
const wordDialog = document.querySelector("#word-dialog");
const wordDialogLabel = document.querySelector("#word-dialog-label");
const wordDialogTitle = document.querySelector("#word-dialog-title");
const wordDialogContent = document.querySelector("#word-dialog-content");
const closeWordDialog = document.querySelector("#close-word-dialog");
const wordInput = document.querySelector("#word");
const wordError = document.querySelector("#word-error");
const definitionToggle = form.elements.include_definitions;
const viewModeInputs = document.querySelectorAll("input[name='view_mode']");
const hubHome = document.querySelector("#hub-home");

if (window.MOTFINAL.homeUrl) {
  hubHome.href = window.MOTFINAL.homeUrl;
  hubHome.hidden = false;
}

let currentOffset = 0;
let currentItems = [];
let currentShowDefinitions = false;
let viewMode = "list";
const pageSize = 50;

function params(offset = 0) {
  const data = new FormData(form);
  const query = new URLSearchParams({
    word: data.get("word").trim(),
    syllable_count: data.get("syllable_count"),
    stress: data.get("stress"),
    include_definitions: data.has("include_definitions") ? "true" : "false",
    limit: pageSize,
    offset,
  });
  const context = data.get("context").trim();
  if (context) query.set("context", context);
  return query;
}

const wordInfo = new Map(); // paraula -> { synonyms, definition }

function badge(kind, label, title, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `word-badge ${kind}`;
  button.textContent = label;
  button.title = title;
  button.setAttribute("aria-label", title);
  button.addEventListener("click", onClick);
  return button;
}

function applyBadges(chip) {
  const word = chip.dataset.word;
  const info = wordInfo.get(word);
  chip.querySelector(".word-badges")?.remove();
  const showDefinitionBadge = info?.definition && !currentShowDefinitions;
  if (!info || (!info.synonyms && !showDefinitionBadge)) return;
  const wrap = document.createElement("span");
  wrap.className = "word-badges";
  if (info.synonyms) wrap.append(badge("syn", "S", `Sinònims de ${word}`, () => showSynonyms(word)));
  if (info.definition && !currentShowDefinitions) wrap.append(badge("def", "D", `Definició de ${word}`, () => showDefinition(word)));
  chip.prepend(wrap);
}

function resultCard(item, showDefinitions) {
  const chip = document.createElement("article");
  chip.className = "word-chip";
  chip.dataset.word = item.word;
  const title = document.createElement("h3");
  title.textContent = item.word;
  chip.append(title);
  if (showDefinitions) {
    chip.classList.add("with-definitions");
    const definitions = document.createElement(item.definitions.length ? "ol" : "p");
    if (item.definitions.length) {
      definitions.className = `definitions ${item.definitions.length === 1 ? "one" : ""}`;
      item.definitions.forEach((definition) => {
        const li = document.createElement("li");
        li.textContent = definition;
        definitions.append(li);
      });
    } else {
      definitions.className = "definitions unavailable";
      definitions.textContent = "Sense entrada al Viccionari.";
    }
    chip.append(definitions);
  }
  applyBadges(chip);
  return chip;
}

async function loadWordInfo(items) {
  const missing = items.map((item) => item.word).filter((word) => !wordInfo.has(word));
  if (!missing.length) return;
  try {
    const response = await fetch(`${window.MOTFINAL.api}/words/info?${new URLSearchParams({ words: missing.join(",") })}`);
    if (!response.ok) return;
    const data = await response.json();
    Object.entries(data.words).forEach(([word, info]) => wordInfo.set(word, info));
    resultsGrid.querySelectorAll(".word-chip").forEach(applyBadges);
  } catch {
    // Sense informació, simplement no es mostren les boles.
  }
}

function linkedWord(item) {
  const word = document.createElement("button");
  word.className = "linked-word";
  word.type = "button";
  word.textContent = item.word;
  word.title = `Veure la definició de ${item.word}`;
  word.addEventListener("click", () => showDefinition(item.word));
  return word;
}

function renderResults() {
  resultsGrid.replaceChildren();
  resultsGrid.classList.toggle("linked-view", viewMode === "linked");
  currentItems.forEach((item) => {
    resultsGrid.append(
      viewMode === "linked"
        ? linkedWord(item)
        : resultCard(item, currentShowDefinitions),
    );
  });
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

function showWordError(message) {
  wordError.textContent = message;
  wordError.hidden = false;
  wordInput.setAttribute("aria-invalid", "true");
  wordInput.focus();
}

function clearWordError() {
  wordError.hidden = true;
  wordError.textContent = "";
  wordInput.removeAttribute("aria-invalid");
}

function validateWord() {
  const word = wordInput.value.trim();
  if (!word) {
    showWordError("Escriu una paraula de referència.");
    return false;
  }
  if (!/^[a-zàáèéíïòóúüç·'’-]+$/i.test(word)) {
    showWordError("Escriu una sola paraula catalana, sense números ni signes.");
    return false;
  }
  clearWordError();
  return true;
}

function readableError(detail, fallback) {
  return typeof detail === "string" ? detail : fallback;
}

const SINGLE_WORD = /^[a-zàáèéíïòóúüç·'’-]+$/i;

function synonymItem(synonym) {
  const item = document.createElement("li");
  if (!SINGLE_WORD.test(synonym)) {
    item.textContent = synonym; // locució: no es pot fer servir com a referència
    return item;
  }
  const button = document.createElement("button");
  button.type = "button";
  button.className = "synonym-link";
  button.textContent = synonym;
  button.title = `Cercar a partir de «${synonym}»`;
  button.addEventListener("click", () => {
    if (wordDialog.open) wordDialog.close();
    wordInput.value = synonym;
    wordInput.dispatchEvent(new Event("input", { bubbles: true }));
    search(false);
  });
  item.append(button);
  return item;
}

async function showSynonyms(word) {
  prepareWordDialog("Sinònims", word);

  try {
    const response = await fetch(`${window.MOTFINAL.api}/words/synonyms?${new URLSearchParams({ word })}`);
    const body = await response.text();
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      throw new Error("No s'han pogut consultar els sinònims.");
    }
    if (!response.ok) throw new Error(data.detail || "No s'han pogut consultar els sinònims.");

    wordDialogContent.className = "word-dialog-content";
    if (!data.synonyms.length) {
      wordDialogContent.innerHTML = `<p class="no-word-info">No consten sinònims de «${escapeHtml(word)}» al diccionari de Softcatalà ni al Viccionari.</p>`;
      return;
    }
    const list = document.createElement("ul");
    data.synonyms.forEach((synonym) => list.append(synonymItem(synonym)));
    wordDialogContent.replaceChildren(list);
  } catch (error) {
    showDialogError(error);
  }
}

async function showDefinition(word) {
  prepareWordDialog("Definició", word);
  try {
    const response = await fetch(`${window.MOTFINAL.api}/words/definitions?${new URLSearchParams({ word })}`);
    const body = await response.text();
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      throw new Error("No s'ha pogut consultar la definició.");
    }
    if (!response.ok) throw new Error(readableError(data.detail, "No s'ha pogut consultar la definició."));

    wordDialogContent.className = "word-dialog-content";
    if (!data.definitions.length) {
      wordDialogContent.innerHTML = `<p class="no-word-info">No consta cap definició de «${escapeHtml(word)}» al Viccionari.</p>`;
      return;
    }
    const list = document.createElement("ol");
    list.className = "dialog-definitions";
    data.definitions.forEach((definition) => {
      const item = document.createElement("li");
      item.textContent = definition;
      list.append(item);
    });
    wordDialogContent.replaceChildren(list);
  } catch (error) {
    showDialogError(error);
  }
}

function prepareWordDialog(label, word) {
  wordDialogLabel.textContent = label;
  wordDialogTitle.textContent = word;
  wordDialogContent.className = "word-dialog-content loading";
  wordDialogContent.textContent = "Buscant…";
  wordDialog.showModal();
}

function showDialogError(error) {
  wordDialogContent.className = "word-dialog-content error";
  wordDialogContent.textContent = error.message;
}

const isOn = (button) => button.getAttribute("aria-pressed") === "true";

function toggleMode(button, other) {
  // Sempre n'hi ha d'haver almenys un d'actiu: sinònims, rimes o tots dos.
  if (isOn(button) && !isOn(other)) return;
  button.setAttribute("aria-pressed", String(!isOn(button)));
  form.classList.toggle("rhymes-off", !isOn(modeRhymes));
  if (!isOn(modeSynonyms)) synonymsSection.hidden = true;
  if (!isOn(modeRhymes)) {
    resultsSection.hidden = true;
    emptyState.hidden = true;
  }
  const searched = !synonymsSection.hidden || !resultsSection.hidden || !emptyState.hidden;
  if (searched && wordInput.value.trim()) search(false);
}

async function searchSynonyms() {
  const word = wordInput.value.trim();
  try {
    const response = await fetch(`${window.MOTFINAL.api}/words/synonyms?${new URLSearchParams({ word })}`);
    const data = await response.json();
    if (!response.ok) throw new Error(readableError(data.detail, "No s'han pogut consultar els sinònims."));
    synonymsTitle.textContent = `Sinònims de «${word}»`;
    synonymsCount.textContent = data.synonyms.length
      ? `${data.synonyms.length} ${data.synonyms.length === 1 ? "sinònim" : "sinònims"}`
      : "";
    synonymsList.replaceChildren(
      ...data.synonyms.map(synonymItem),
    );
    synonymsEmpty.textContent = data.synonyms.length
      ? ""
      : `No consten sinònims de «${word}» al diccionari de Softcatalà ni al Viccionari.`;
    synonymsEmpty.hidden = data.synonyms.length > 0;
  } catch (error) {
    synonymsList.replaceChildren();
    synonymsCount.textContent = "";
    synonymsEmpty.textContent = error.message;
    synonymsEmpty.hidden = false;
  }
  synonymsSection.hidden = false;
}

async function search(append = false) {
  if (!validateWord()) return;
  if (!append) {
    if (isOn(modeSynonyms)) searchSynonyms();
    else synonymsSection.hidden = true;
  }
  if (isOn(modeRhymes)) {
    await searchRhymes(append);
  } else {
    resultsSection.hidden = true;
    emptyState.hidden = true;
  }
}

async function searchRhymes(append = false) {
  const offset = append ? currentOffset : 0;
  if (!append) {
    currentItems = [];
    renderResults();
    currentOffset = 0;
  }
  emptyState.hidden = true;
  notice.hidden = true;
  notice.className = "notice";
  loadMore.hidden = true;
  const submit = form.querySelector("button[type='submit']");
  submit.disabled = true;
  submit.firstChild.textContent = "Buscant… ";

  try {
    const response = await fetch(`${window.MOTFINAL.api}/words/search?${params(offset)}`);
    const body = await response.text();
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      throw new Error("El servidor no ha pogut completar la cerca. Torna-ho a provar.");
    }
    if (!response.ok) {
      const message = readableError(data.detail, "No s'ha pogut completar la cerca.");
      if (response.status === 422) {
        showWordError(message);
        return;
      }
      throw new Error(message);
    }

    currentItems = append ? [...currentItems, ...data.results] : data.results;
    currentShowDefinitions = data.query.include_definitions;
    renderResults();
    loadWordInfo(currentItems);
    currentOffset = offset + data.results.length;
    resultsSection.hidden = data.total === 0;
    emptyState.hidden = data.total !== 0;
    const ending = data.query.ending_syllables.join("·");
    resultCount.textContent = `${data.total} ${data.total === 1 ? "paraula" : "paraules"} · rima «${ending}»`;
    loadMore.hidden = currentOffset >= data.total || data.contextual;
    if (data.truncated_candidates) {
      notice.textContent = "El filtre semàntic ha treballat amb una mostra de les coincidències. Afina la síl·laba o la tonicitat per obtenir un rànquing més complet.";
      notice.hidden = false;
    }
  } catch (error) {
    resultsSection.hidden = false;
    notice.className = "notice error";
    notice.textContent = error.message;
    notice.hidden = false;
  } finally {
    submit.disabled = false;
    submit.firstChild.textContent = "Buscar paraules ";
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  search(false);
});
loadMore.addEventListener("click", () => searchRhymes(true));
modeSynonyms.addEventListener("click", () => toggleMode(modeSynonyms, modeRhymes));
modeRhymes.addEventListener("click", () => toggleMode(modeRhymes, modeSynonyms));
form.classList.toggle("rhymes-off", !isOn(modeRhymes));
wordInput.addEventListener("input", clearWordError);
definitionToggle.addEventListener("change", () => {
  if (definitionToggle.checked && viewMode === "linked") {
    viewMode = "list";
    document.querySelector("input[name='view_mode'][value='list']").checked = true;
  }
  if (!resultsSection.hidden || !emptyState.hidden) searchRhymes(false);
});
viewModeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    viewMode = input.value;
    if (viewMode === "linked") {
      definitionToggle.checked = false;
      currentShowDefinitions = false;
    }
    renderResults();
  });
});
closeWordDialog.addEventListener("click", () => wordDialog.close());
wordDialog.addEventListener("click", (event) => {
  if (event.target === wordDialog) wordDialog.close();
});
