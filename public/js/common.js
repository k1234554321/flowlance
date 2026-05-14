async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function showError(error) {
  alert(error.message || String(error));
}

function formatDate(date) {
  return new Date(date).toLocaleString('ru-RU');
}
