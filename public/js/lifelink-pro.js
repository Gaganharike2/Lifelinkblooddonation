$(function () {
  $('[data-toggle-theme]').on('click', function () {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('lifelink_theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
  });

  if (localStorage.getItem('lifelink_theme') === 'dark') {
    document.body.classList.add('dark-mode');
  }

  $('.ajax-search').on('input', function () {
    const value = $(this).val().toLowerCase();
    $('.searchable-row').each(function () {
      $(this).toggle($(this).text().toLowerCase().includes(value));
    });
  });
});

async function loadLifeLinkAnalytics() {
  const canvas = document.querySelector('#analyticsChart');
  if (!canvas || !window.Chart) return;
  try {
    const data = await LifeLink.api('/api/advanced/analytics');
    const labels = data.inventory.length ? data.inventory.map((item) => item.blood_group) : ['O+', 'A+', 'B+', 'AB+'];
    const values = data.inventory.length ? data.inventory.map((item) => item.units) : [18, 12, 8, 5];
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Available units',
          data: values,
          backgroundColor: '#e9194f',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  } catch (error) {
    if (window.LifeLink) LifeLink.toast(error.message, 'error');
  }
}

async function askLifeLinkAI(message) {
  const data = await LifeLink.api('/api/advanced/ai/assistant', {
    method: 'POST',
    body: JSON.stringify({ message })
  });
  return data.answer;
}
