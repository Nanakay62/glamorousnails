/**
 * Glamorous Nails — client controller.
 * Depends on data.js (SALON_DEFAULTS, Store) loaded before this file.
 */

const TIME_SLOTS = [
  "9:00 AM","9:30 AM",
  "10:00 AM","10:30 AM",
  "11:00 AM","11:30 AM",
  "12:00 PM","12:30 PM",
  "1:00 PM","1:30 PM",
  "2:00 PM","2:30 PM",
  "3:00 PM","3:30 PM",
  "4:00 PM","4:30 PM",
  "5:00 PM","5:30 PM",
  "6:00 PM"
];


const state = {
  salon: Store.get(),
  activeCategory: null,
  selected: {},        // { itemId: qty(1) } — one of each service per booking
  date: "",
  time: "",
  name: "",
  phone: "",
  notes: ""
};

function fmt(n){ return `${state.salon.currency}${n}`; }

function flattenActiveItems(){
  const map = {};
  state.salon.categories.forEach(cat => cat.items.forEach(it => { if (it.active !== false) map[it.id] = { ...it, categoryId: cat.id }; }));
  return map;
}

function refreshFromStore(){
  state.salon = Store.get();
  // Drop any selections that no longer exist / were deactivated.
  const active = flattenActiveItems();
  Object.keys(state.selected).forEach(id => { if (!active[id]) delete state.selected[id]; });
  renderCategoryTabs();
  renderServiceGrid();
  renderDock();
  renderSelectedList();
  populateWhatsappLinks();
  validateDate();
}

/* ---------------- categories & grid ---------------- */

function renderCategoryTabs(){
  const el = document.getElementById("categoryTabs");
  if (!state.activeCategory) state.activeCategory = state.salon.categories[0]?.id;
  el.innerHTML = state.salon.categories.map(cat => `
    <button role="tab" aria-selected="${cat.id === state.activeCategory}" class="${cat.id === state.activeCategory ? "active" : ""}" data-cat="${cat.id}">${cat.name}</button>
  `).join("");
  el.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => { state.activeCategory = btn.dataset.cat; renderCategoryTabs(); renderServiceGrid(); });
  });
}

function renderServiceGrid(){
  const el = document.getElementById("serviceGrid");
  const cat = state.salon.categories.find(c => c.id === state.activeCategory);
  if (!cat){ el.innerHTML = ""; return; }
  const items = cat.items.filter(it => it.active !== false);
  if (!items.length){ el.innerHTML = `<p class="empty-note">No services available in this category right now.</p>`; return; }
  el.innerHTML = items.map(it => `
    <div class="card">
      <div class="card-top">
        <h3>${it.name}</h3>
        <span class="price-tag">${fmt(it.price)}${it.note ? " " + it.note : ""}</span>
      </div>
      <button class="card-add ${state.selected[it.id] ? "added" : ""}" data-id="${it.id}">${state.selected[it.id] ? "Added ✓" : "Add to booking"}</button>
    </div>
  `).join("");
  el.querySelectorAll(".card-add").forEach(btn => {
    btn.addEventListener("click", () => toggleService(btn.dataset.id));
  });
}

function toggleService(id){
  if (state.selected[id]) delete state.selected[id];
  else state.selected[id] = true;
  renderServiceGrid();
  renderDock();
  renderSelectedList();
  renderTimeChips();
  if (Object.keys(state.selected).length === 1 && !document.getElementById("dock").hidden === false){
    // first item added — surface the dock
  }
}

/* ---------------- dock + sheet ---------------- */

function selectedItems(){
  const active = flattenActiveItems();
  return Object.keys(state.selected).map(id => active[id]).filter(Boolean);
}
function selectedTotal(){ return selectedItems().reduce((sum, it) => sum + it.price, 0); }

function renderDock(){
  const items = selectedItems();
  const dock = document.getElementById("dock");
  dock.hidden = items.length === 0;
  document.getElementById("dockCount").textContent = `${items.length} service${items.length === 1 ? "" : "s"}`;
  document.getElementById("dockTotal").textContent = fmt(selectedTotal());
}

function renderSelectedList(){
  const items = selectedItems();
  const el = document.getElementById("selectedList");
  document.getElementById("sheetTotal").textContent = fmt(selectedTotal());
  updateConfirmState();
  if (!items.length){
    el.innerHTML = `<p class="empty-note">Nothing added yet — close this sheet and tap a service.</p>`;
    return;
  }
  el.innerHTML = items.map(it => `
    <div class="selected-row">
      <span>${it.name}</span>
      <span style="display:flex;align-items:center;gap:10px;">
        <span class="price-tag">${fmt(it.price)}</span>
        <button class="rm" data-id="${it.id}" aria-label="Remove ${it.name}">✕</button>
      </span>
    </div>
  `).join("");
  el.querySelectorAll(".rm").forEach(btn => btn.addEventListener("click", () => {
    delete state.selected[btn.dataset.id];
    renderServiceGrid(); renderDock(); renderSelectedList(); renderTimeChips();
  }));
}

function openSheet(){
  document.getElementById("scrim").classList.add("open");
  document.getElementById("sheet").classList.add("open");
  if (!state.date){
    const d = new Date();
    state.date = d.toISOString().slice(0,10);
    document.getElementById("dateInput").value = state.date;
  }
  renderTimeChips();
  validateDate();
}
function closeSheet(){
  document.getElementById("scrim").classList.remove("open");
  document.getElementById("sheet").classList.remove("open");
}

function isClosedDate(dateStr){
  return (state.salon.closed_dates || []).includes(dateStr);
}

function validateDate(){
  const warning = document.getElementById("dateWarning");
  const closed = state.date && isClosedDate(state.date);
  warning.style.display = closed ? "block" : "none";
  if (closed) state.time = "";
  renderTimeChips();
  updateConfirmState();
}

function renderTimeChips(){
  const el = document.getElementById("timeChips");
  const closed = state.date && isClosedDate(state.date);
  el.innerHTML = TIME_SLOTS.map(t => `
    <button class="chip ${state.time === t ? "active" : ""}" data-time="${t}" ${closed ? "disabled" : ""}>${t}</button>
  `).join("");
  el.querySelectorAll(".chip").forEach(btn => btn.addEventListener("click", () => {
    state.time = btn.dataset.time; renderTimeChips(); updateConfirmState();
  }));
}

function updateConfirmState(){
  const items = selectedItems();
  const ok = items.length > 0 && state.date && state.time && !isClosedDate(state.date) && document.getElementById("nameInput").value.trim() && document.getElementById("phoneInput").value.trim();
  document.getElementById("confirmBtn").disabled = !ok;
}

/* ---------------- WhatsApp dispatch ---------------- */

function buildWhatsappMessage(){
  const items = selectedItems();
  const lines = items.map(it => `• ${it.name} — ${fmt(it.price)}`).join("\n");
  const dateNice = state.date ? new Date(state.date + "T00:00:00").toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long", year:"numeric" }) : "";
  return [
    `*New booking — ${state.salon.salon_name}*`,
    ``,
    `*Name:* ${state.name}`,
    `*Number:* ${state.phone}`,
    `*Date:* ${dateNice}`,
    `*Time:* ${state.time}`,
    ``,
    `*Services:*`,
    lines,
    ``,
    `*Total:* ${fmt(selectedTotal())} (payable in person)`,
    state.notes ? `\n*Notes:* ${state.notes}` : ``
  ].filter(Boolean).join("\n");
}

function dispatchWhatsapp(){
  state.name = document.getElementById("nameInput").value.trim();
  state.phone = document.getElementById("phoneInput").value.trim();
  state.notes = document.getElementById("notesInput").value.trim();
  updateConfirmState();
  if (document.getElementById("confirmBtn").disabled) return;
  const text = encodeURIComponent(buildWhatsappMessage());
  const url = `https://wa.me/${state.salon.contact.whatsapp_dispatch}?text=${text}`;
  window.open(url, "_blank", "noopener");
  showToast("Opening WhatsApp to confirm your booking…");
}

function populateWhatsappLinks(){
  const genericMsg = encodeURIComponent(`Hi ${state.salon.salon_name}, I'd like to ask about an appointment.`);
  const url = `https://wa.me/${state.salon.contact.whatsapp_dispatch}?text=${genericMsg}`;
  document.getElementById("heroWhatsapp").href = url;
  document.getElementById("visitWhatsapp").href = url;
  document.getElementById("visitCall").href = `tel:${state.salon.contact.backup_phone.replace(/\s/g,"")}`;
}

/* ---------------- toast ---------------- */
let toastTimer;
function showToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------------- wire up ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  refreshFromStore();
  renderTimeChips();

  document.getElementById("dockOpen").addEventListener("click", openSheet);
  document.getElementById("sheetClose").addEventListener("click", closeSheet);
  document.getElementById("scrim").addEventListener("click", closeSheet);
  document.getElementById("dateInput").addEventListener("change", (e) => { state.date = e.target.value; validateDate(); });
  ["nameInput","phoneInput","notesInput"].forEach(id => {
    document.getElementById(id).addEventListener("input", updateConfirmState);
  });
  document.getElementById("confirmBtn").addEventListener("click", dispatchWhatsapp);

  Store.onUpdate(refreshFromStore);

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")){
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
});
