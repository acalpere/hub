const poemTitle = document.querySelector("#poem-title");
const poemBody = document.querySelector("#poem-body");
const poemGutter = document.querySelector("#poem-gutter");
const poemStatus = document.querySelector("#poem-status");
const poemMessage = document.querySelector("#poem-message");
const poemDates = document.querySelector("#poem-dates");
const poemList = document.querySelector("#poem-list");
const savePoemButton = document.querySelector("#save-poem");
const newPoemButton = document.querySelector("#new-poem");

const STATUS_LABELS = { in_progress: "En procés", finished: "Acabat", published: "Publicat" };
let currentPoem = null;
let marks = new Set(); // números dels versos marcats
const markButton = document.querySelector("#mark-mode");
const poemMarks = document.querySelector("#poem-marks");
const poemEditor = document.querySelector(".poem-editor");

const loginCard = document.querySelector("#login-card");
const loginPassword = document.querySelector("#login-password");
const loginError = document.querySelector("#login-error");
const poemArea = document.querySelector("#poem-area");
const logoutButton = document.querySelector("#logout");

// Totes les peticions als poemes porten la capçalera anti-CSRF i gestionen la sessió caducada.
async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "X-Requested-With": window.MOTFINAL.csrf, ...(options.headers || {}) },
    credentials: "same-origin",
  });
  if (response.status === 401) needLogin();
  return response;
}

function needLogin() {
  // Incrustat al hub: la sessió és la del hub. Sola: formulari de contrasenya propi.
  if (window.MOTFINAL.auth === "host" && window.MOTFINAL.loginUrl) {
    (window.top || window).location.assign(window.MOTFINAL.loginUrl);
  } else {
    showLogin();
  }
}

function showLogin() {
  loginCard.hidden = false;
  poemArea.hidden = true;
  loginPassword.focus();
}

async function checkSession() {
  if (window.MOTFINAL.auth === "host") {
    loginCard.hidden = true;
    poemArea.hidden = false;
    loadList();
    return;
  }
  try {
    const response = await fetch(`${window.MOTFINAL.api}/session`, { credentials: "same-origin" });
    const status = await response.json();
    logoutButton.hidden = !status.required;
    if (status.authenticated) {
      loginCard.hidden = true;
      poemArea.hidden = false;
      loadList();
    } else {
      showLogin();
    }
  } catch {
    showMessage("No s'ha pogut comprovar la sessió.", true);
  }
}

loginCard.addEventListener("submit", async (event) => {
  event.preventDefault();
  const response = await api(`${window.MOTFINAL.api}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: loginPassword.value }),
  });
  if (response.ok) {
    loginPassword.value = "";
    loginError.hidden = true;
    checkSession();
    return;
  }
  const detail = (await response.json().catch(() => ({}))).detail;
  loginError.textContent = typeof detail === "string" ? detail : "No s'ha pogut entrar.";
  loginError.hidden = false;
});

logoutButton.addEventListener("click", async () => {
  await api(`${window.MOTFINAL.api}/session`, { method: "DELETE" });
  fill(null);
  showLogin();
});

const dateFormat = new Intl.DateTimeFormat("ca", { dateStyle: "long", timeStyle: "short" });
function formatDate(value) {
  return value ? dateFormat.format(new Date(value)) : "";
}

function esc(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function updateGutter() {
  // Numera els versos: línies no buides, i les estrofes (línies en blanc) no compten.
  const lines = poemBody.value.split("\n");
  let verse = 0;
  const bars = [];
  poemGutter.innerHTML = lines
    .map((line, i) => {
      if (!line.trim()) return "<li>&nbsp;</li>";
      const n = ++verse;
      if (marks.has(n)) bars.push(i);
      return `<li data-verse="${n}"${marks.has(n) ? ' class="marked"' : ""}>${n}</li>`;
    })
    .join("");
  poemBody.style.height = "auto";
  poemBody.style.height = `${Math.max(320, poemBody.scrollHeight)}px`;
  // Franges fluorescents darrere el text: una per vers marcat (cada línia fa sempre la mateixa alçada)
  const style = getComputedStyle(poemBody);
  const lineHeight = parseFloat(style.lineHeight) || 1.7 * parseFloat(style.fontSize);
  const top = parseFloat(style.paddingTop) || 0;
  poemMarks.innerHTML = bars.map((i) => `<i style="top:${top + i * lineHeight}px;height:${lineHeight}px"></i>`).join("");
}

markButton.addEventListener("click", () => {
  const on = markButton.getAttribute("aria-pressed") !== "true";
  markButton.setAttribute("aria-pressed", String(on));
  poemEditor.classList.toggle("marking", on);
});
poemGutter.addEventListener("click", (event) => {
  const item = event.target.closest("li[data-verse]");
  if (!item || markButton.getAttribute("aria-pressed") !== "true") return;
  const n = Number(item.dataset.verse);
  if (!marks.delete(n)) marks.add(n);
  updateGutter();
});

function showMessage(text, error = false) {
  poemMessage.hidden = !text;
  poemMessage.textContent = text;
  poemMessage.classList.toggle("error", error);
}

function renderDates() {
  if (!currentPoem) {
    poemDates.hidden = true;
    return;
  }
  const rows = [["Creat", currentPoem.created_at], ["Darrer desat", currentPoem.updated_at]];
  if (currentPoem.finished_at) rows.push(["Acabat", currentPoem.finished_at]);
  if (currentPoem.published_at) rows.push(["Publicat", currentPoem.published_at]);
  poemDates.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${formatDate(v)}</dd>`).join("");
  poemDates.hidden = false;
}

function renderList(poems) {
  if (!poems.length) {
    poemList.innerHTML = '<li class="poem-empty">Encara no n\'hi ha cap.</li>';
    return;
  }
  poemList.innerHTML = poems
    .map(
      (p) => `<li><button type="button" class="poem-item ${currentPoem?.id === p.id ? "current" : ""}" data-id="${p.id}">
        <strong>${esc(p.title) || "<em>Sense títol</em>"}</strong>
        <span class="badge ${p.status}">${STATUS_LABELS[p.status]}</span><small>${formatDate(p.updated_at)}</small>
      </button></li>`,
    )
    .join("");
}

function fill(poem) {
  currentPoem = poem;
  poemTitle.value = poem?.title ?? "";
  poemBody.value = poem?.body ?? "";
  poemStatus.value = poem?.status ?? "in_progress";
  marks = new Set(poem?.marks ?? []);
  updateGutter();
  renderDates();
  showMessage("");
}

async function loadList() {
  try {
    const response = await api(`${window.MOTFINAL.api}/poems`);
    if (!response.ok) throw new Error();
    renderList(await response.json());
  } catch {
    showMessage("No s'ha pogut carregar la llista de poemes.", true);
  }
}

async function savePoem() {
  savePoemButton.disabled = true;
  try {
    const payload = { title: poemTitle.value, body: poemBody.value, status: poemStatus.value, marks: [...marks].sort((a, b) => a - b) };
    const response = await api(currentPoem ? `${window.MOTFINAL.api}/poems/${currentPoem.id}` : `${window.MOTFINAL.api}/poems`, {
      method: currentPoem ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error();
    currentPoem = await response.json();
    poemTitle.value = currentPoem.title; // pot ser el títol provisional
    renderDates();
    showMessage(`Desat el ${formatDate(currentPoem.updated_at)}.`);
    await loadList();
  } catch {
    showMessage("No s'ha pogut desar el poema.", true);
  } finally {
    savePoemButton.disabled = false;
  }
}

poemBody.addEventListener("input", updateGutter);
poemBody.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    savePoem();
  }
});
savePoemButton.addEventListener("click", savePoem);
newPoemButton.addEventListener("click", () => {
  fill(null);
  loadList();
  poemTitle.focus();
});
poemList.addEventListener("click", async (event) => {
  const item = event.target.closest("[data-id]");
  if (!item) return;
  const response = await api(`${window.MOTFINAL.api}/poems/${item.dataset.id}`);
  if (!response.ok) return showMessage("No s'ha pogut obrir el poema.", true);
  fill(await response.json());
  loadList();
});

updateGutter();
checkSession();

// En seleccionar una paraula del poema, passa a «Paraula de referència».
const referenceInput = document.querySelector("#word");
function sendSelectionToReference() {
  const selected = poemBody.value.slice(poemBody.selectionStart, poemBody.selectionEnd).trim();
  if (!selected || selected.length > 160) return;
  if (!/^[\p{L}·'’-]+$/u.test(selected)) return; // una sola paraula
  if (selected === referenceInput.value && selected === lastAutoSearched) return;
  referenceInput.value = selected;
  referenceInput.dispatchEvent(new Event("input", { bubbles: true }));
  lastAutoSearched = selected;
  referenceInput.form.requestSubmit(); // busca paraules automàticament
}
let lastAutoSearched = "";
poemBody.addEventListener("mouseup", sendSelectionToReference);
poemBody.addEventListener("keyup", (event) => {
  if (event.shiftKey || event.key === "Shift") sendSelectionToReference();
});
poemBody.addEventListener("dblclick", sendSelectionToReference);
