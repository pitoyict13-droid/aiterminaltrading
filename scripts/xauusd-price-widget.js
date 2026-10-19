// Widget Harga XAU/USD - Membaca dari GitHub Actions (data/market.json)
(function() {
  const container = document.getElementById('xauusd-price-widget');
  if (!container) return;

  async function loadPrice() {
    try {
      // 1. Ambil data dari file market.json (hasil update GitHub Actions)
      const res = await fetch(`data/market.json?t=${Date.now()}`); // ?t=... biar tidak kena cache browser
      if (!res.ok) throw new Error('Gagal load market.json');
      
      const data = await res.json();
      const price = parseFloat(data.price);

      if (!price || isNaN(price)) throw new Error('Harga kosong');

      // 2. Tampilkan ke layar
      const formatted = price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      
      container.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; font-family:monospace;">
          <span style="color:#94a3b8; font-size:12px; font-weight:600;">XAU/USD</span>
          <span style="color:#10b981; font-size:16px; font-weight:bold;">$${formatted}</span>
          <span style="color:#10b981; font-size:10px;">● LIVE</span>
        </div>
      `;
    } catch (err) {
      console.warn('Widget error:', err);
      container.innerHTML = `
        <div style="color:#f43f5e; font-size:12px; font-family:monospace; border:1px solid #f43f5e; padding:4px 8px; border-radius:4px;">
          XAU/USD ● OFFLINE
        </div>
      `;
    }
  }

  // Jalankan saat halaman dimuat
  loadPrice();

  // Refresh otomatis tiap 5 menit (300.000 ms)
  setInterval(loadPrice, 300000);
})();
