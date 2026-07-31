let toastTimer;

export function openModal(doc, id, scrim) {
  const el = doc.getElementById(id);
  if (!el) return;
  el.hidden = false;
  if (scrim) scrim.dataset.open = 'true';
}

export function closeAll(doc) {
  for (const el of doc.querySelectorAll('.modal')) el.hidden = true;
  const sheet = doc.getElementById('picker');
  if (sheet) delete sheet.dataset.open;
  const scrim = doc.getElementById('scrim');
  if (scrim) delete scrim.dataset.open;
}

export function showToast(doc, message) {
  const el = doc.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.dataset.open = 'true';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => delete el.dataset.open, 2400);
}
