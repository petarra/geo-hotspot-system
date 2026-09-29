/**
 * GeoFire Kalbar - Application Controller & Core Subsystems
 * Integrates Map, Date Slider, Bottom Drawer, Table Explorer, and UI Controller
 */

// ============================================================================
// 1. Table Explorer Module
// ============================================================================
const TableModule = (() => {
  let sourceRecords = [];
  let displayedRecords = [];
  let currentPage = 1;
  let pageSize = 50;
  let sortKey = null;
  let sortAsc = true;
  let searchQuery = '';

  const sortColumnMap = {
    'kab': 0,
    'kec': 1,
    'desa': 2,
    'tgl': 3,
    'waktu': 4,
    'conf': 5
  };

  function init(records) {
    sourceRecords = records;
    displayedRecords = records;
    currentPage = 1;

    setupEvents();
    render();
  }

  function setupEvents() {
    // Live in-table search
    const searchInput = document.getElementById('table-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', Utils.debounce((e) => {
        searchQuery = (e.target.value || '').trim().toLowerCase();
        currentPage = 1;
        applyTableFilter();
      }, 200));
    }

    // Page size selector
    const pageSizeSelect = document.getElementById('table-page-size');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        pageSize = parseInt(e.target.value, 10) || 50;
        currentPage = 1;
        render();
      });
    }

    // Sorting headers
    const sortHeaders = document.querySelectorAll('.data-table th[data-sort]');
    sortHeaders.forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (sortKey === key) {
          sortAsc = !sortAsc;
        } else {
          sortKey = key;
          sortAsc = true;
        }
        applyTableFilter();
      });
    });

    // Pagination buttons
    document.getElementById('page-first')?.addEventListener('click', () => goToPage(1));
    document.getElementById('page-prev')?.addEventListener('click', () => goToPage(currentPage - 1));
    document.getElementById('page-next')?.addEventListener('click', () => goToPage(currentPage + 1));
    document.getElementById('page-last')?.addEventListener('click', () => {
      const maxPage = Math.ceil(displayedRecords.length / pageSize) || 1;
      goToPage(maxPage);
    });

    // Delegated Action Click for "Lihat di Peta"
    const tableBody = document.getElementById('table-body');
    if (tableBody) {
      tableBody.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-table-action');
        if (!btn) return;
        const lat = parseFloat(btn.dataset.lat);
        const lng = parseFloat(btn.dataset.lng);
        if (!isNaN(lat) && !isNaN(lng)) {
          // Close drawer first so map is immediately visible
          DrawerModule.close();
          setTimeout(() => {
            MapModule.zoomToHotspot(lat, lng);
          }, 200);
        }
      });
    }

    // CSV Export button
    const btnExport = document.getElementById('btn-export-csv');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        const filename = `hotspot-kalbar-filtered-${Date.now()}.csv`;
        Utils.exportToCSV(displayedRecords, filename);
      });
    }
  }

  function applyTableFilter() {
    let list = sourceRecords;

    if (searchQuery) {
      list = list.filter(r => {
        return r[0].toLowerCase().includes(searchQuery) ||
               r[1].toLowerCase().includes(searchQuery) ||
               r[2].toLowerCase().includes(searchQuery);
      });
    }

    if (sortKey !== null && sortColumnMap[sortKey] !== undefined) {
      const colIdx = sortColumnMap[sortKey];
      list = [...list].sort((a, b) => {
        const valA = a[colIdx];
        const valB = b[colIdx];
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
    }

    displayedRecords = list;
    render();
  }

  function goToPage(page) {
    const totalPages = Math.ceil(displayedRecords.length / pageSize) || 1;
    currentPage = Math.max(1, Math.min(page, totalPages));
    render();
  }

  function updateData(newRecords) {
    sourceRecords = newRecords;
    currentPage = 1;
    applyTableFilter();
  }

  function render() {
    const tableBody = document.getElementById('table-body');
    if (!tableBody) return;

    const total = displayedRecords.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, total);
    const pageRecords = displayedRecords.slice(startIdx, endIdx);

    if (total === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 36px; color: var(--text-muted);">
            Tidak ada data titik api yang sesuai dengan filter pencarian.
          </td>
        </tr>
      `;
    } else {
      const confBadgeMap = {
        'H': '<span class="table-tag" style="background:var(--color-high-bg); color:var(--color-high);">High</span>',
        'M': '<span class="table-tag" style="background:var(--color-medium-bg); color:var(--color-medium);">Medium</span>',
        'L': '<span class="table-tag" style="background:var(--color-low-bg); color:var(--color-low);">Low</span>'
      };

      const rowsHtml = pageRecords.map((r, idx) => {
        const globalIndex = startIdx + idx + 1;
        const [kab, kec, desa, date, time, conf, lat, lng] = r;
        return `
          <tr>
            <td style="font-family:var(--font-mono); color:var(--text-muted);">${globalIndex}</td>
            <td><strong>${kab}</strong></td>
            <td>${kec}</td>
            <td>${desa !== '-' ? desa : '<em>-</em>'}</td>
            <td>${Utils.formatDateIndo(date)}</td>
            <td style="font-family:var(--font-mono);">${time}</td>
            <td>${confBadgeMap[conf] || conf}</td>
            <td class="table-coords">${lat.toFixed(5)}, ${lng.toFixed(5)}</td>
            <td>
              <button class="btn-table-action" data-lat="${lat}" data-lng="${lng}">
                Lihat di Peta
              </button>
            </td>
          </tr>
        `;
      }).join('');

      tableBody.innerHTML = rowsHtml;
    }

    // Update pagination info
    const info = document.getElementById('table-pagination-info');
    if (info) {
      if (total === 0) {
        info.textContent = 'Menampilkan 0 data';
      } else {
        info.textContent = `Menampilkan ${Utils.formatNumber(startIdx + 1)} - ${Utils.formatNumber(endIdx)} dari ${Utils.formatNumber(total)} data`;
      }
    }

    renderPaginationControls(totalPages);
  }

  function renderPaginationControls(totalPages) {
    const pageNumbersContainer = document.getElementById('page-numbers');
    if (!pageNumbersContainer) return;

    const btnFirst = document.getElementById('page-first');
    const btnPrev = document.getElementById('page-prev');
    const btnNext = document.getElementById('page-next');
    const btnLast = document.getElementById('page-last');

    if (btnFirst) btnFirst.disabled = currentPage === 1;
    if (btnPrev) btnPrev.disabled = currentPage === 1;
    if (btnNext) btnNext.disabled = currentPage === totalPages || totalPages === 0;
    if (btnLast) btnLast.disabled = currentPage === totalPages || totalPages === 0;

    let pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, start + maxVisible - 1);

      if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1);
      }

      for (let i = start; i <= end; i++) pages.push(i);
    }

    pageNumbersContainer.innerHTML = pages.map(p => `
      <button class="page-num-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">
        ${p}
      </button>
    `).join('');

    pageNumbersContainer.querySelectorAll('.page-num-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        goToPage(parseInt(btn.dataset.page, 10));
      });
    });
  }

  return {
    init,
    updateData
  };
})();

// ============================================================================
// 2. Bottom Drawer Module (Secondary features popup)
// ============================================================================
const DrawerModule = (() => {
  let activePanel = 'stats';
  let isExpanded = false;

  function init() {
    setupEvents();
  }

  function setupEvents() {
    // FAB buttons on map
    document.querySelectorAll('.fab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const panel = btn.dataset.drawer;
        open(panel);
      });
    });

    // Drawer tabs
    document.querySelectorAll('.drawer-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        setPanel(tab.dataset.panel);
      });
    });

    // Close button & backdrop click
    document.getElementById('btn-close-drawer')?.addEventListener('click', close);
    document.getElementById('drawer-backdrop')?.addEventListener('click', close);

    // Expand button
    document.getElementById('btn-expand-drawer')?.addEventListener('click', toggleExpand);

    // ESC key closes drawer
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  function open(panelId = 'stats') {
    setPanel(panelId);
    document.getElementById('bottom-drawer')?.classList.add('active');
    document.getElementById('drawer-backdrop')?.classList.add('active');
    setTimeout(() => {
      ChartModule.resize();
    }, 350);
  }

  function close() {
    document.getElementById('bottom-drawer')?.classList.remove('active');
    document.getElementById('drawer-backdrop')?.classList.remove('active');
  }

  function toggleExpand() {
    const drawer = document.getElementById('bottom-drawer');
    if (!drawer) return;
    isExpanded = !isExpanded;
    drawer.classList.toggle('expanded', isExpanded);
    setTimeout(() => {
      ChartModule.resize();
    }, 320);
  }

  function setPanel(panelId) {
    activePanel = panelId;
    document.querySelectorAll('.drawer-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.panel === panelId);
    });
    document.querySelectorAll('.drawer-panel').forEach(p => {
      p.classList.toggle('active', p.id === `panel-${panelId}`);
    });
    if (panelId === 'stats') {
      setTimeout(() => {
        ChartModule.resize();
      }, 60);
    }
  }

  return {
    init,
    open,
    close,
    setPanel
  };
})();

// ============================================================================
// 3. Date Slider Module (Core Map-Centric Timeline)
// ============================================================================
const SliderModule = (() => {
  let summaryData = null;
  let datesList = []; // 116 dates: ['2026-06-01', ..., '2026-09-29']
  let dailyCounts = {};
  let currentMode = 'all'; // 'single' | 'range' | 'all'
  let isPlaying = false;
  let playInterval = null;
  let playbackSpeed = 400;

  function init(summary) {
    summaryData = summary;
    datesList = Object.keys(summary.byDate).sort();
    dailyCounts = summary.byDate;

    renderSparkline();
    setupEvents();
  }

  function renderSparkline() {
    const canvas = document.getElementById('timeline-sparkline');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.parentElement.offsetWidth || 1000;
    const height = 28;
    canvas.width = width;
    canvas.height = height;

    const maxCount = Math.max(...Object.values(dailyCounts), 1);
    const n = datesList.length;
    const barWidth = width / n;

    ctx.clearRect(0, 0, width, height);

    datesList.forEach((d, i) => {
      const count = dailyCounts[d] || 0;
      const h = Math.max(2, (count / maxCount) * (height - 4));
      const x = i * barWidth;
      const y = height - h;

      if (count > 1500) ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
      else if (count > 500) ctx.fillStyle = 'rgba(249, 115, 22, 0.75)';
      else if (count > 100) ctx.fillStyle = 'rgba(245, 158, 11, 0.65)';
      else ctx.fillStyle = 'rgba(16, 185, 129, 0.5)';

      ctx.fillRect(x, y, Math.max(barWidth - 1, 1), h);
    });
  }

  function setupEvents() {
    // Mode buttons
    const btnSingle = document.getElementById('mode-single-date');
    const btnRange = document.getElementById('mode-range-date');
    const btnAll = document.getElementById('mode-all-date');

    btnSingle?.addEventListener('click', () => setMode('single'));
    btnRange?.addEventListener('click', () => setMode('range'));
    btnAll?.addEventListener('click', () => setMode('all'));

    // Single slider input
    const singleInput = document.getElementById('single-date-slider');
    singleInput?.addEventListener('input', (e) => {
      const idx = parseInt(e.target.value, 10);
      onSingleDateChange(idx);
    });

    // Dual Range Slider inputs
    const rangeStart = document.getElementById('range-slider-start');
    const rangeEnd = document.getElementById('range-slider-end');

    rangeStart?.addEventListener('input', () => {
      let s = parseInt(rangeStart.value, 10);
      let e = parseInt(rangeEnd.value, 10);
      if (s > e) { rangeStart.value = e; s = e; }
      onRangeDateChange(s, e);
    });

    rangeEnd?.addEventListener('input', () => {
      let s = parseInt(rangeStart.value, 10);
      let e = parseInt(rangeEnd.value, 10);
      if (e < s) { rangeEnd.value = s; e = s; }
      onRangeDateChange(s, e);
    });

    // Play / Pause button
    const btnPlay = document.getElementById('btn-slider-play');
    btnPlay?.addEventListener('click', togglePlayback);

    // Playback speed select
    const speedSelect = document.getElementById('playback-speed');
    speedSelect?.addEventListener('change', (e) => {
      playbackSpeed = parseInt(e.target.value, 10) || 400;
      if (isPlaying) {
        pausePlayback();
        startPlayback();
      }
    });

    // Milestones click (1 Jun, 1 Jul, 1 Agu, 1 Sep, 29 Sep)
    document.querySelectorAll('.slider-month-milestones .milestone').forEach(m => {
      m.addEventListener('click', () => {
        const idx = parseInt(m.dataset.idx, 10);
        if (currentMode === 'all') setMode('single');
        if (singleInput) singleInput.value = idx;
        onSingleDateChange(idx);
      });
    });

    // Re-render sparkline on window resize
    window.addEventListener('resize', Utils.debounce(renderSparkline, 250));

    // Listen for filter date changes from sidebar (e.g. quick month pills)
    window.addEventListener('filter-dates-changed', (e) => {
      const { start, end, month } = e.detail;
      if (month === 'ALL') {
        setMode('all', false);
      } else {
        const startIdx = datesList.indexOf(start);
        const endIdx = datesList.indexOf(end);
        if (startIdx !== -1 && endIdx !== -1) {
          setMode('range', false);
          if (rangeStart) rangeStart.value = startIdx;
          if (rangeEnd) rangeEnd.value = endIdx;
          updateRangeText(startIdx, endIdx);
        }
      }
    });
  }

  function setMode(mode, triggerFilter = true) {
    currentMode = mode;
    pausePlayback();

    const btnSingle = document.getElementById('mode-single-date');
    const btnRange = document.getElementById('mode-range-date');
    const btnAll = document.getElementById('mode-all-date');
    const singleInput = document.getElementById('single-date-slider');
    const dualContainer = document.getElementById('dual-range-container');
    const allNotice = document.getElementById('all-period-display');

    [btnSingle, btnRange, btnAll].forEach(b => b?.classList.remove('active'));

    if (mode === 'single') {
      btnSingle?.classList.add('active');
      if (singleInput) singleInput.style.display = 'block';
      if (dualContainer) dualContainer.style.display = 'none';
      if (allNotice) allNotice.style.display = 'none';

      const idx = singleInput ? parseInt(singleInput.value, 10) : 68;
      if (triggerFilter) onSingleDateChange(idx);
      else updateSingleText(idx);

    } else if (mode === 'range') {
      btnRange?.classList.add('active');
      if (singleInput) singleInput.style.display = 'none';
      if (dualContainer) dualContainer.style.display = 'block';
      if (allNotice) allNotice.style.display = 'none';

      const rangeStart = document.getElementById('range-slider-start');
      const rangeEnd = document.getElementById('range-slider-end');
      const s = rangeStart ? parseInt(rangeStart.value, 10) : 0;
      const e = rangeEnd ? parseInt(rangeEnd.value, 10) : 115;
      if (triggerFilter) onRangeDateChange(s, e);
      else updateRangeText(s, e);

    } else { // 'all'
      btnAll?.classList.add('active');
      if (singleInput) singleInput.style.display = 'none';
      if (dualContainer) dualContainer.style.display = 'none';
      if (allNotice) allNotice.style.display = 'block';

      const dateText = document.getElementById('slider-date-text');
      const countBadge = document.getElementById('slider-count-badge');
      if (dateText) dateText.textContent = 'Semua Periode (1 Jun - 29 Sep 2026)';
      if (countBadge) countBadge.textContent = `${Utils.formatNumber(summaryData.total)} Titik`;

      if (triggerFilter) FilterModule.setDateAll();
    }
  }

  function onSingleDateChange(idx) {
    const date = datesList[idx];
    if (!date) return;
    updateSingleText(idx);
    FilterModule.setDateSingle(date);
  }

  function updateSingleText(idx) {
    const date = datesList[idx];
    const count = dailyCounts[date] || 0;
    const dateText = document.getElementById('slider-date-text');
    const countBadge = document.getElementById('slider-count-badge');

    if (dateText) dateText.textContent = Utils.formatDateIndo(date);
    if (countBadge) countBadge.textContent = `${Utils.formatNumber(count)} Titik`;
  }

  function onRangeDateChange(sIdx, eIdx) {
    const startDate = datesList[sIdx];
    const endDate = datesList[eIdx];
    if (!startDate || !endDate) return;

    updateRangeText(sIdx, eIdx);
    FilterModule.setDateRange(startDate, endDate);
  }

  function updateRangeText(sIdx, eIdx) {
    const startDate = datesList[sIdx];
    const endDate = datesList[eIdx];
    let totalInRange = 0;
    for (let i = sIdx; i <= eIdx; i++) {
      totalInRange += (dailyCounts[datesList[i]] || 0);
    }

    const dateText = document.getElementById('slider-date-text');
    const countBadge = document.getElementById('slider-count-badge');
    if (dateText) {
      dateText.textContent = `${Utils.formatDateIndo(startDate)} - ${Utils.formatDateIndo(endDate)}`;
    }
    if (countBadge) {
      countBadge.textContent = `${Utils.formatNumber(totalInRange)} Titik`;
    }
  }

  function togglePlayback() {
    if (isPlaying) pausePlayback();
    else startPlayback();
  }

  function startPlayback() {
    if (currentMode !== 'single') {
      setMode('single', false);
    }
    isPlaying = true;
    const playIcon = document.getElementById('play-icon');
    const playText = document.getElementById('play-text');
    if (playIcon) playIcon.textContent = '⏸';
    if (playText) playText.textContent = 'Jeda';

    const singleInput = document.getElementById('single-date-slider');
    playInterval = setInterval(() => {
      let cur = parseInt(singleInput.value, 10);
      cur++;
      if (cur >= datesList.length) cur = 0;
      singleInput.value = cur;
      onSingleDateChange(cur);
    }, playbackSpeed);
  }

  function pausePlayback() {
    isPlaying = false;
    clearInterval(playInterval);
    const playIcon = document.getElementById('play-icon');
    const playText = document.getElementById('play-text');
    if (playIcon) playIcon.textContent = '▶';
    if (playText) playText.textContent = 'Putar';
  }

  return {
    init,
    setMode
  };
})();

// ============================================================================
// 4. Main Application Controller
// ============================================================================
const App = (() => {
  let summaryData = null;
  let detailRecords = [];
  let kalbarGeoJSON = null;

  async function bootstrap() {
    setupTheme();
    setupSidebarToggle();

    try {
      // Step 1: Load lightweight summary first
      updateLoader(10, 'Memuat ringkasan data dan metrik...');
      summaryData = await Utils.loadSummary();
      populateMiniStats(summaryData);

      // Step 2: Load 68K points dataset with streaming progress
      updateLoader(25, 'Mengunduh 68.595 titik koordinat hotspot...');
      detailRecords = await Utils.loadDetail((percent) => {
        const scaled = 25 + Math.round(percent * 0.55); // 25% to 80%
        updateLoader(scaled, `Mengunduh koordinat titik api (${percent}%)...`);
      });

      // Step 3: Load Kalbar Province boundary GeoJSON
      updateLoader(85, 'Memuat batas wilayah Kalimantan Barat...');
      kalbarGeoJSON = await Utils.loadKalbarBoundary();

      // Step 4: Initialize Modules
      updateLoader(90, 'Menginisialisasi peta citra satelit...');
      MapModule.init(summaryData, kalbarGeoJSON);

      updateLoader(94, 'Menyiapkan timeline slider...');
      SliderModule.init(summaryData);

      updateLoader(96, 'Menyiapkan modul drawer & grafik...');
      DrawerModule.init();
      ChartModule.init(summaryData, detailRecords);
      ChartModule.updateData(detailRecords);

      updateLoader(98, 'Menyiapkan penjelajah data...');
      TableModule.init(detailRecords);

      FilterModule.init(summaryData, detailRecords);

      // Register filter listener to synchronize map, charts, and table
      FilterModule.onFilterChange((filtered) => {
        MapModule.updateData(filtered);
        ChartModule.updateData(filtered);
        TableModule.updateData(filtered);
      });

      // Initial load on map
      MapModule.updateData(detailRecords);

      // Finalize loading
      updateLoader(100, 'Selesai! Citra satelit siap.');
      setTimeout(hideLoader, 350);

    } catch (err) {
      console.error('Fatal initialization error:', err);
      const statusEl = document.getElementById('loader-status');
      if (statusEl) {
        statusEl.textContent = 'Terjadi kesalahan saat memuat data: ' + err.message;
        statusEl.style.color = '#ef4444';
      }
    }
  }

  function updateLoader(percent, statusText) {
    const bar = document.getElementById('loader-bar');
    const pctText = document.getElementById('loader-percent');
    const status = document.getElementById('loader-status');

    if (bar) bar.style.width = `${percent}%`;
    if (pctText) pctText.textContent = `${percent}%`;
    if (status && statusText) status.textContent = statusText;
  }

  function hideLoader() {
    const screen = document.getElementById('loading-screen');
    if (screen) {
      screen.classList.add('hidden');
    }
  }

  function setupSidebarToggle() {
    const btnToggle = document.getElementById('btn-toggle-sidebar');
    const btnClose = document.getElementById('btn-close-sidebar');
    const sidebar = document.getElementById('app-sidebar');

    const toggle = () => {
      sidebar?.classList.toggle('collapsed');
      setTimeout(() => {
        MapModule.invalidateSize();
      }, 320);
    };

    btnToggle?.addEventListener('click', toggle);
    btnClose?.addEventListener('click', toggle);
  }

  function populateMiniStats(summary) {
    if (!summary) return;

    // Mini sidebar stats
    if (summary.byKabupaten && summary.byKabupaten.length > 0) {
      const topKab = summary.byKabupaten[0];
      const miniTop = document.getElementById('mini-top-kab');
      const miniTopSub = document.getElementById('mini-top-kab-sub');
      const statTop = document.getElementById('stat-top-kab');
      const statTopSub = document.getElementById('stat-top-kab-sub');

      const pct = ((topKab.total / summary.total) * 100).toFixed(1);
      const subText = `${Utils.formatNumber(topKab.total)} Titik (${pct}%)`;

      if (miniTop) miniTop.textContent = topKab.name;
      if (miniTopSub) miniTopSub.textContent = subText;
      if (statTop) statTop.textContent = topKab.name;
      if (statTopSub) statTopSub.textContent = subText;
    }

    if (summary.byMonth) {
      let peakMonth = '';
      let peakCount = 0;
      Object.entries(summary.byMonth).forEach(([m, count]) => {
        if (count > peakCount) {
          peakCount = count;
          peakMonth = m;
        }
      });
      const miniPeak = document.getElementById('mini-peak-month');
      const miniPeakSub = document.getElementById('mini-peak-month-sub');
      const statPeak = document.getElementById('stat-peak-month');
      const statPeakSub = document.getElementById('stat-peak-month-sub');

      const pct = ((peakCount / summary.total) * 100).toFixed(1);
      const subText = `${Utils.formatNumber(peakCount)} Titik (${pct}%)`;
      const name = Utils.getMonthName(peakMonth);

      if (miniPeak) miniPeak.textContent = name;
      if (miniPeakSub) miniPeakSub.textContent = subText;
      if (statPeak) statPeak.textContent = name;
      if (statPeakSub) statPeakSub.textContent = subText;
    }

    // High confidence stat in stats panel
    const statHigh = document.getElementById('stat-high');
    if (statHigh && summary.confidence) {
      statHigh.textContent = Utils.formatNumber(summary.confidence.High || 2479);
    }
  }

  function setupTheme() {
    const savedTheme = localStorage.getItem('geofire-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nextTheme);
        localStorage.setItem('geofire-theme', nextTheme);
        ChartModule.updateTheme();
      });
    }
  }

  return {
    bootstrap
  };
})();

// Initialize when DOM content is ready
document.addEventListener('DOMContentLoaded', () => {
  App.bootstrap();
});
