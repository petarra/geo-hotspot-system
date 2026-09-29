/**
 * GeoFire Kalbar - Utility Functions
 * Data loader, formatters, and helper utilities
 */

const Utils = {
  /**
   * Format number with Indonesian locale (1.234.567)
   */
  formatNumber(val) {
    if (val === null || val === undefined || isNaN(val)) return '0';
    return Number(val).toLocaleString('id-ID');
  },

  /**
   * Format ISO date 'YYYY-MM-DD' to Indonesian date 'DD MMMM YYYY'
   */
  formatDateIndo(dateStr) {
    if (!dateStr) return '-';
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    try {
      const parts = dateStr.split('-');
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return `${day} ${months[monthIdx]} ${year}`;
    } catch (e) {
      return dateStr;
    }
  },

  /**
   * Get month name from key 'YYYY-MM'
   */
  getMonthName(monthKey) {
    const monthsMap = {
      '2026-06': 'Juni 2026',
      '2026-07': 'Juli 2026',
      '2026-08': 'Agustus 2026',
      '2026-09': 'September 2026'
    };
    return monthsMap[monthKey] || monthKey;
  },

  /**
   * Animate a numeric DOM element from current value to target value
   */
  animateCounter(elem, targetVal, duration = 1200) {
    if (!elem) return;
    const startVal = 0;
    const startTime = performance.now();

    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (targetVal - startVal) * ease);
      elem.textContent = Utils.formatNumber(current);

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        elem.textContent = Utils.formatNumber(targetVal);
      }
    }

    requestAnimationFrame(update);
  },

  /**
   * Fetch summary data (lightweight JSON ~8KB)
   */
  async loadSummary() {
    const res = await fetch('data/hotspot-summary.json');
    if (!res.ok) throw new Error('Gagal memuat data ringkasan hotspot');
    return await res.json();
  },

  /**
   * Fetch detail data (5.6MB) with stream progress monitoring
   */
  async loadDetail(onProgress) {
    const response = await fetch('data/hotspot-detail.json');
    if (!response.ok) throw new Error('Gagal memuat basis data titik api');

    const contentLength = response.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 5910000;

    if (!response.body) {
      const data = await response.json();
      if (onProgress) onProgress(100);
      return data;
    }

    const reader = response.body.getReader();
    let receivedBytes = 0;
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      receivedBytes += value.length;
      if (onProgress && totalBytes) {
        const percent = Math.min(Math.round((receivedBytes / totalBytes) * 100), 99);
        onProgress(percent);
      }
    }

    // Merge chunks into a single Uint8Array
    const allChunks = new Uint8Array(receivedBytes);
    let position = 0;
    for (const chunk of chunks) {
      allChunks.set(chunk, position);
      position += chunk.length;
    }

    // Decode and parse JSON
    const text = new TextDecoder('utf-8').decode(allChunks);
    if (onProgress) onProgress(100);
    return JSON.parse(text);
  },

  /**
   * Fetch Kalbar Province boundary GeoJSON if available
   */
  async loadKalbarBoundary() {
    try {
      const res = await fetch('data/kalbar-province.geojson');
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Kalbar boundary GeoJSON not found, continuing without border overlay.');
    }
    return null;
  },

  /**
   * Debounce helper
   */
  debounce(func, wait = 250) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  },

  /**
   * Export records array to downloadable CSV
   */
  exportToCSV(records, filename = 'hotspot-kalbar-2026.csv') {
    if (!records || !records.length) {
      alert('Tidak ada data untuk diekspor!');
      return;
    }

    const headers = ['No', 'Provinsi', 'Kabupaten/Kota', 'Kecamatan', 'Desa', 'Tanggal', 'Waktu', 'Confidence', 'Latitude', 'Longitude'];
    const rows = [headers.join(',')];

    records.forEach((row, idx) => {
      // row format: [kab, kec, desa, date, time, conf, lat, lng]
      const confFull = row[5] === 'H' ? 'High' : (row[5] === 'L' ? 'Low' : 'Medium');
      const csvRow = [
        idx + 1,
        '"Kalimantan Barat"',
        `"${row[0]}"`,
        `"${row[1]}"`,
        `"${row[2]}"`,
        `"${row[3]}"`,
        `"${row[4]} WIB"`,
        `"${confFull}"`,
        row[6],
        row[7]
      ];
      rows.push(csvRow.join(','));
    });

    const csvContent = '\uFEFF' + rows.join('\r\n'); // Add BOM for Excel UTF-8 support
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};
