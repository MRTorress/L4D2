/* =========================================================
   CONFIGURAÇÃO DE ARMAZENAMENTO
   ---------------------------------------------------------
   - Vazio ("")  -> salva só no navegador (localStorage).
                    Só você vê o que salvou neste aparelho.
   - Com URL     -> salva online (Firebase Realtime Database),
                    todos que abrirem o site veem o mesmo conteúdo.
   Exemplo: "https://meu-projeto-default-rtdb.firebaseio.com"
   ========================================================= */
const FIREBASE_URL = "https://links-e0be1-default-rtdb.firebaseio.com";

/* ---------- Categorias ---------- */
const GROUPS = [
  { id: "sobreviventes", name: "Sobreviventes",
    items: ["Todos os Sobreviventes", "Bill", "Francis", "Louis", "Zoey", "Coach", "Ellis", "Nick", "Rochelle"] },
  { id: "infectados", name: "Infectados",
    items: ["Infectados Comuns", "Infectados Especiais", "Boomer", "Charger", "Hunter", "Jockey", "Smoker", "Spitter", "Tank", "Witch"] },
  { id: "conteudo", name: "Conteúdo do Jogo",
    items: ["Campanhas", "Itens", "Sons", "Scripts", "Interface", "Diversos", "Modelos", "Texturas"] },
  { id: "itens", name: "itens",
    items: ["Adrenalina", "Desfribilador", "Medkit", "Pills", "Outros"] },
  { id: "armas", name: "Armas",
    items: ["Pistolas", "Escopetas", "Submetralhadoras", "Rifles", "Franco-atiradores", "Corpo a Corpo", "Granadas", "Outras Armas"] }
];

/* ---------- Estado ---------- */
let products = [];            // [{id, group, item, name, url, img, note, ts}]
let current = null;           // {group, item}
let openGroups = new Set();
let search = "";

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- Armazenamento ---------- */
const LS_KEY = "catalogo_links_v1";
const online = !!FIREBASE_URL;
const api = (path) => FIREBASE_URL.replace(/\/$/, "") + path + ".json";

async function loadAll() {
  if (online) {
    const r = await fetch(api("/products"));
    if (!r.ok) throw new Error("Falha ao carregar");
    const data = (await r.json()) || {};
    return Object.entries(data).map(([id, p]) => ({ ...p, id }));
  }
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
  catch { return []; }
}

async function saveProduct(p) {
  if (online) {
    const r = await fetch(api("/products"), { method: "POST", body: JSON.stringify(p) });
    if (!r.ok) throw new Error("Falha ao salvar");
    const { name } = await r.json();
    return { ...p, id: name };
  }
  const full = { ...p, id: crypto.randomUUID() };
  const all = await loadAll();
  all.push(full);
  localStorage.setItem(LS_KEY, JSON.stringify(all));
  return full;
}

async function deleteProduct(id) {
  if (online) {
    const r = await fetch(api("/products/" + id), { method: "DELETE" });
    if (!r.ok) throw new Error("Falha ao remover");
    return;
  }
  const all = (await loadAll()).filter(p => p.id !== id);
  localStorage.setItem(LS_KEY, JSON.stringify(all));
}

/* ---------- Menu lateral ---------- */
function renderSidebar() {
  $("#menu").innerHTML = GROUPS.map(g => `
    <div class="group ${openGroups.has(g.id) ? "open" : ""}">
      <button class="group-title" data-group="${g.id}">
        <span>${esc(g.name)}</span><span class="chev">▶</span>
      </button>
      <div class="sub-list">
        ${g.items.map(it => {
          const n = products.filter(p => p.group === g.id && p.item === it).length;
          const active = current && current.group === g.id && current.item === it;
          return `
          <button class="sub-name ${active ? "active" : ""}" data-open="${g.id}|${esc(it)}">
            <span>${esc(it)}</span>
            ${n ? `<span class="count">${n}</span>` : ""}
          </button>`;
        }).join("")}
      </div>
    </div>`).join("");
}

$("#sidebar").addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t) return;

  if (t.dataset.group) {
    const id = t.dataset.group;
    openGroups.has(id) ? openGroups.delete(id) : openGroups.add(id);
    renderSidebar();
  } else if (t.dataset.open) {
    const [g, i] = t.dataset.open.split("|");
    select(g, i);
    setMenu(false);
  }
});

function select(g, i) {
  current = { group: g, item: i };
  search = "";
  openGroups.add(g);
  render();
}

/* ---------- Conteúdo principal ---------- */
function render() {
  renderSidebar();
  const view = $("#view");

  if (!current) {
    $("#title").textContent = "Catálogo de Links";
    view.innerHTML = `<div class="welcome">Escolha uma categoria no menu ao lado<br>e clique em um subitem para adicionar e ver os produtos.</div>`;
    return;
  }

  const group = GROUPS.find(g => g.id === current.group);
  $("#title").textContent = `${group.name} / ${current.item}`;

  const list = products
    .filter(p => p.group === current.group && p.item === current.item)
    .filter(p => (p.name + " " + (p.note || "")).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.ts - a.ts);

  view.innerHTML = `
    <form class="add-form" id="form">
      <h2>Adicionar produto em ${esc(current.item)}</h2>
      <div class="row">
        <input name="name" required maxlength="80" placeholder="Nome do produto">
        <input name="url" required placeholder="Link do produto (https://...)">
      </div>
      <div class="row">
        <input name="img" placeholder="Link da imagem (opcional)">
        <input name="note" maxlength="200" placeholder="Observação (opcional)">
        <button class="btn" type="submit">Salvar</button>
      </div>
    </form>

    <div class="toolbar">
      <input id="search" placeholder="Buscar produto..." value="${esc(search)}">
    </div>

    ${list.length ? `<div class="grid">${list.map(card).join("")}</div>`
      : `<div class="empty">Nenhum produto aqui ainda.</div>`}`;

  $("#form").addEventListener("submit", onSubmit);
  const s = $("#search");
  s.oninput = () => {
    search = s.value;
    render();
    const n = $("#search");
    n.focus();
    n.setSelectionRange(search.length, search.length);
  };
}

const card = (p) => {
  let host = "";
  try { host = new URL(p.url).hostname.replace(/^www\./, ""); } catch {}
  return `
  <div class="card">
    <button class="del" data-id="${esc(p.id)}" title="Remover produto">✕</button>
    <div class="thumb" ${p.img ? `style="background-image:url('${esc(p.img)}')"` : ""}>${p.img ? "" : "🔗"}</div>
    <div class="body">
      <h3>${esc(p.name)}</h3>
      <span class="host">${esc(host)}</span>
      ${p.note ? `<span class="note">${esc(p.note)}</span>` : ""}
      <a class="open" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Abrir link</a>
    </div>
  </div>`;
};

$("#view").addEventListener("click", async (e) => {
  const b = e.target.closest(".del");
  if (!b) return;
  if (!confirm("Remover este produto?")) return;
  try {
    await deleteProduct(b.dataset.id);
    products = products.filter(p => p.id !== b.dataset.id);
    render();
  } catch { setStatus("⚠ erro ao remover"); }
});

/* ---------- Formulário ---------- */
function cleanUrl(u) {
  u = u.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    const x = new URL(u);
    return /^https?:$/.test(x.protocol) ? x.href : null;
  } catch { return null; }
}

async function onSubmit(e) {
  e.preventDefault();
  const f = e.target.elements;
  const url = cleanUrl(f.url.value);
  if (!url) return alert("Link inválido.");
  const img = f.img.value.trim() ? cleanUrl(f.img.value) : "";

  const p = {
    group: current.group, item: current.item,
    name: f.name.value.trim(), url, img: img || "",
    note: f.note.value.trim(), ts: Date.now()
  };

  try {
    const saved = await saveProduct(p);
    products.push(saved);
    render();
  } catch { alert("Não foi possível salvar. Verifique a conexão."); }
}

/* ---------- Status / sincronização ---------- */
function setStatus(t) { $("#status").textContent = t; }

async function refresh() {
  try {
    products = await loadAll();
    setStatus(online ? "● online (compartilhado)" : "● local (só neste navegador)");
    render();
  } catch { setStatus("⚠ sem conexão"); }
}

// Abre/fecha o menu no celular
function setMenu(open) {
  $("#sidebar").classList.toggle("show", open);
  $("#overlay").classList.toggle("show", open);
}
$("#menuBtn").onclick = () => setMenu(!$("#sidebar").classList.contains("show"));
$("#closeBtn").onclick = () => setMenu(false);
$("#overlay").onclick = () => setMenu(false);

refresh();
// Atualiza a lista periodicamente (só no modo online), sem atrapalhar quem está digitando
if (online) setInterval(() => {
  const typing = document.activeElement && document.activeElement.tagName === "INPUT";
  if (!typing) refresh();
}, 20000);
