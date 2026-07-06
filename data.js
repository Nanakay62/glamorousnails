/**
 * Glamorous Nails — shared data layer.
 *
 * This file is the single source of truth for services, pricing, and
 * salon settings. It is loaded by BOTH index.html (client) and admin.html
 * (dashboard). Overrides made in the admin dashboard are written to
 * localStorage and broadcast live to any open client tab via
 * BroadcastChannel — no refresh needed.
 *
 * ---------------------------------------------------------------------
 * GOING TO PRODUCTION / REAL-TIME ACROSS DEVICES
 * ---------------------------------------------------------------------
 * localStorage + BroadcastChannel only sync tabs on the SAME browser,
 * on the SAME device. That's enough to demo "admin edits a price, the
 * client screen updates instantly" — but a phone in a customer's hand
 * won't see an edit made on the salon's laptop.
 *
 * To get real cross-device live updates, swap STORE (below) for a thin
 * wrapper around Supabase or Firebase:
 *   - Replace store.get()/store.set() with reads/writes to a
 *     `salon_config` table/document.
 *   - Replace the BroadcastChannel listener with a realtime subscription
 *     (Supabase: `.channel().on('postgres_changes', ...)`,
 *      Firebase: `onSnapshot()` on the doc).
 * Everything else (rendering, booking flow, admin UI) stays the same,
 * because both already just call `Store.get()` / `Store.set()` and
 * react to a `salon:update` event.
 */

const SALON_DEFAULTS = {
  salon_name: "Glamorous Nails",
  currency: "GH₵",
  contact: {
    whatsapp_dispatch: "233240878736",
    backup_phone: "0502743916",
    instagram: "glamorousbeautyplus",
    facebook: "Arda Sodjina",
    location: "Haatso Supermarket Junction, Accra"
  },
  closed_dates: [],
  categories: [
    {
      id: "nail_services",
      name: "Nail Services",
      items: [
        { id: "n1", name: "Short Nails", price: 150, active: true },
        { id: "n2", name: "Medium Nails", price: 170, active: true },
        { id: "n3", name: "Long Acrylic", price: 200, note: "and above", active: true },
        { id: "n4", name: "Stick-on with Gel and Design", price: 100, active: true },
        { id: "n5", name: "Stick-on without Design", price: 80, active: true },
        { id: "n6", name: "Stick-on with Normal Polish", price: 50, active: true },
        { id: "n7", name: "Gel Polish", price: 45, active: true },
        { id: "n8", name: "Normal Polish", price: 20, active: true },
        { id: "n9", name: "Refill", price: 100, active: true }
      ]
    },
    {
      id: "lashes_brows",
      name: "Lashes & Eyebrows",
      items: [
        { id: "l1", name: "Lashes", price: 80, active: true },
        { id: "l2", name: "Strip Lashes", price: 30, active: true },
        { id: "e1", name: "Eyebrow Shaping", price: 15, active: true },
        { id: "e2", name: "Microblading", price: 500, active: true }
      ]
    },
    {
      id: "facials_mani_pedi",
      name: "Facial & Manicure/Pedicure",
      items: [
        { id: "f1", name: "Facials", price: 70, active: true },
        { id: "mp1", name: "Pedicure", price: 120, active: true },
        { id: "mp2", name: "Manicure", price: 80, active: true }
      ]
    },
    {
      id: "makeup_services",
      name: "Makeup Services",
      items: [
        { id: "m1", name: "Makeup", price: 170, active: true },
        { id: "m2", name: "Makeup with Lashes", price: 200, active: true }
      ]
    },
    {
      id: "piercing_services",
      name: "Piercing Services",
      items: [
        { id: "p1", name: "Nose Pierce", price: 80, active: true },
        { id: "p2", name: "Belly Pierce", price: 200, active: true },
        { id: "p3", name: "Tongue Pierce", price: 200, active: true },
        { id: "p4", name: "Tragus Pierce", price: 100, active: true },
        { id: "p5", name: "Rook Pierce", price: 100, active: true }
      ]
    }
  ]
};

const Store = (() => {
  const KEY = "glamorous_nails_data_v1";
  let channel = null;
  try { channel = new BroadcastChannel("glamorous-nails-sync"); } catch (e) { /* older Safari fallback via storage event only */ }

  function get() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(SALON_DEFAULTS);
      const parsed = JSON.parse(raw);
      // Shallow-merge so newly added default fields survive old saved data.
      return { ...structuredClone(SALON_DEFAULTS), ...parsed };
    } catch (e) {
      console.error("Store.get failed, falling back to defaults", e);
      return structuredClone(SALON_DEFAULTS);
    }
  }

  function set(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      if (channel) channel.postMessage({ type: "salon:update" });
      window.dispatchEvent(new CustomEvent("salon:update"));
      return true;
    } catch (e) {
      console.error("Store.set failed", e);
      return false;
    }
  }

  function onUpdate(cb) {
    if (channel) channel.onmessage = (e) => { if (e.data?.type === "salon:update") cb(); };
    window.addEventListener("storage", (e) => { if (e.key === KEY) cb(); });
    window.addEventListener("salon:update", cb);
  }

  function reset() {
    localStorage.removeItem(KEY);
    if (channel) channel.postMessage({ type: "salon:update" });
  }

  return { get, set, onUpdate, reset, KEY };
})();