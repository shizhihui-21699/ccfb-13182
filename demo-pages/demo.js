/* Shared demo-page script: submits the form to /api/echo and shows what the
   server actually received — including everything autofill dropped into
   hidden fields. */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  const out = document.getElementById('received');
  if (!form || !out) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {};
    new FormData(form).forEach((v, k) => { data[k] = v; });
    const res = await fetch('/api/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    const rows = Object.entries(json.fields)
      .map(([k, v]) => `<tr><td>${k}</td><td>${String(v) || '<i>(空)</i>'}</td></tr>`)
      .join('');
    out.innerHTML =
      `<h3>⚠️ 服务器实际收到的字段 (${Object.keys(json.fields).length} 个)</h3>` +
      `<table border="1" cellpadding="6" cellspacing="0">${rows}</table>`;
    out.style.display = 'block';
  });
});
