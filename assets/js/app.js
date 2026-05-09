document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('orderForm');
  const dateInput = document.getElementById('date');

  // запрет прошлых дат
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.min = today;
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const data = {
        name: document.getElementById('name')?.value.trim(),
        phone: document.getElementById('phone')?.value.trim(),
        region: document.getElementById('region')?.value.trim(),
        date: document.getElementById('date')?.value,
        time: document.getElementById('time')?.value,
        comment: document.getElementById('comment')?.value.trim()
      };

      try {
        // TODO: сюда твоя логика: Firebase / Telegram / backend
        // пример: await sendToTelegram(data);

        openModal('successModal');
        form.reset();
      } catch (err) {
        console.error(err);
        openModal('errorModal');
      }
    });
  }

  function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('modal--open');
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('modal--open');
  }

  document.getElementById('successClose')?.addEventListener('click', () => closeModal('successModal'));
  document.getElementById('errorClose')?.addEventListener('click', () => closeModal('errorModal'));
});
