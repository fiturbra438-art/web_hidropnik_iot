const form = document.querySelector('#contact-form');
const status = document.querySelector('#form-status');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  status.textContent = 'Mengirim...';

  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    status.textContent = result.message;
    form.reset();
  } catch (error) {
    status.textContent = error.message || 'Terjadi kesalahan. Coba lagi.';
  }
});
