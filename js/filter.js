/**
 * GeoFire Kalbar - Filter Module
 * Multi-criteria geospatial filtering engine
 */

const FilterModule = (() => {
  let allRecords = [];
  let currentFilteredRecords = [];
  let summaryData = null;
  let onFilterChangeCallbacks = [];

  // Filter state
  const state = {
    kabupaten: 'ALL',
    confidences: new Set(['H', 'M', 'L']),
    dateStart: '2026-06-01',
    dateEnd: '2026-09-29',
    searchQuery: '',
    month: 'ALL'
  };

  /**
   * Initialize filter controls and data
   */
  function init(summary, records) {
    summaryData = summary;
    allRecords = records;
    currentFilteredRecords = records;

    populateKabupatenDropdown();
    setupListeners();
    updateCounterUI();
  }

  /**
   * Populate Kabupaten select with options
   */
  function populateKabupatenDropdown() {
    const select = document.getElementById('filter-kabupaten');
    if (!select || !summaryData || !summaryData.byKabupaten) return;

    summaryData.byKabupaten.forEach(k => {
      const opt = document.createElement('option');
      opt.value = k.name;
      opt.textContent = `${k.name} (${Utils.formatNumber(k.total)} titik)`;
      select.appendChild(opt);
    });
  }

  /**
   * Bind DOM event listeners
   */
  function setupListeners() {
    // 1. Kabupaten dropdown
    const selectKab = document.getElementById('filter-kabupaten');
    if (selectKab) {
      selectKab.addEventListener('change', (e) => {
        state.kabupaten = e.target.value;
        applyFilters();
      });
    }

    // 2. Confidence checkboxes
    ['conf-high', 'conf-med', 'conf-low'].forEach(id => {
      const chk = document.getElementById(id);
      if (chk) {
        chk.addEventListener('change', () => {
          const val = chk.value;
          if (chk.checked) state.confidences.add(val);
          else state.confidences.delete(val);
          applyFilters();
        });
      }
    });

    // 3. Date inputs
    const inputStart = document.getElementById('filter-date-start');
    const inputEnd = document.getElementById('filter-date-end');

    if (inputStart) {
      inputStart.addEventListener('change', (e) => {
        state.dateStart = e.target.value || '2026-06-01';
        // Reset month pill to custom if manually changed
        clearActiveMonthPills();
        applyFilters();
      });
    }

    if (inputEnd) {
      inputEnd.addEventListener('change', (e) => {
        state.dateEnd = e.target.value || '2026-09-29';
        clearActiveMonthPills();
        applyFilters();
      });
    }

    // 4. Search input (debounced)
    const inputSearch = document.getElementById('filter-search');
    if (inputSearch) {
      const handleSearch = Utils.debounce((e) => {
        state.searchQuery = (e.target.value || '').trim().toLowerCase();
        applyFilters();
      }, 200);
      inputSearch.addEventListener('input', handleSearch);
    }

    // 5. Quick Month Pills (.btn-month-pill)
    const monthButtons = document.querySelectorAll('.btn-month-pill');
    monthButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        monthButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const m = btn.dataset.month;
        state.month = m;

        if (m === 'ALL') {
          state.dateStart = '2026-06-01';
          state.dateEnd = '2026-09-29';
        } else if (m === '2026-06') {
          state.dateStart = '2026-06-01';
          state.dateEnd = '2026-06-30';
        } else if (m === '2026-07') {
          state.dateStart = '2026-07-01';
          state.dateEnd = '2026-07-31';
        } else if (m === '2026-08') {
          state.dateStart = '2026-08-01';
          state.dateEnd = '2026-08-31';
        } else if (m === '2026-09') {
          state.dateStart = '2026-09-01';
          state.dateEnd = '2026-09-29';
        }

        applyFilters();

        // Dispatch date sync event for slider
        window.dispatchEvent(new CustomEvent('filter-dates-changed', {
          detail: { start: state.dateStart, end: state.dateEnd, month: m }
        }));
      });
    });

    // 6. Reset button
    const btnReset = document.getElementById('btn-reset-filter');
    if (btnReset) {
      btnReset.addEventListener('click', resetFilters);
    }
  }

  function clearActiveMonthPills() {
    const monthButtons = document.querySelectorAll('.btn-month-pill');
    monthButtons.forEach(b => b.classList.remove('active'));
  }

  /**
   * Reset all filters to default
   */
  function resetFilters() {
    state.kabupaten = 'ALL';
    state.confidences = new Set(['H', 'M', 'L']);
    state.dateStart = '2026-06-01';
    state.dateEnd = '2026-09-29';
    state.searchQuery = '';
    state.month = 'ALL';

    // Reset DOM controls
    const selectKab = document.getElementById('filter-kabupaten');
    if (selectKab) selectKab.value = 'ALL';

    ['conf-high', 'conf-med', 'conf-low'].forEach(id => {
      const chk = document.getElementById(id);
      if (chk) chk.checked = true;
    });

    const inputStart = document.getElementById('filter-date-start');
    if (inputStart) inputStart.value = '2026-06-01';

    const inputEnd = document.getElementById('filter-date-end');
    if (inputEnd) inputEnd.value = '2026-09-29';

    const inputSearch = document.getElementById('filter-search');
    if (inputSearch) inputSearch.value = '';

    const monthButtons = document.querySelectorAll('.filter-quick-months .btn-pill');
    monthButtons.forEach(b => {
      if (b.dataset.month === 'ALL') b.classList.add('active');
      else b.classList.remove('active');
    });

    applyFilters();
  }

  /**
   * Apply all active filters on dataset
   */
  function applyFilters() {
    const { kabupaten, confidences, dateStart, dateEnd, searchQuery } = state;
    const isAllKab = kabupaten === 'ALL';
    const hasSearch = searchQuery.length > 0;

    const filtered = [];
    const len = allRecords.length;

    for (let i = 0; i < len; i++) {
      const row = allRecords[i];
      // row: [kab, kec, desa, date, time, conf, lat, lng]

      // 1. Kabupaten filter
      if (!isAllKab && row[0] !== kabupaten) continue;

      // 2. Confidence filter
      if (!confidences.has(row[5])) continue;

      // 3. Date range filter ('YYYY-MM-DD' comparison)
      const date = row[3];
      if (date < dateStart || date > dateEnd) continue;

      // 4. Text search in kec and desa
      if (hasSearch) {
        const kec = row[1].toLowerCase();
        const desa = row[2].toLowerCase();
        if (!kec.includes(searchQuery) && !desa.includes(searchQuery)) continue;
      }

      filtered.push(row);
    }

    currentFilteredRecords = filtered;
    updateCounterUI();
    notifySubscribers();
  }

  /**
   * Set specific date range from slider
   */
  function setDateRange(startDate, endDate) {
    state.dateStart = startDate;
    state.dateEnd = endDate;
    state.month = 'CUSTOM';
    clearActiveMonthPills();
    applyFilters();
  }

  /**
   * Set single date from slider
   */
  function setDateSingle(date) {
    state.dateStart = date;
    state.dateEnd = date;
    state.month = 'CUSTOM';
    clearActiveMonthPills();
    applyFilters();
  }

  /**
   * Set all period
   */
  function setDateAll() {
    state.dateStart = '2026-06-01';
    state.dateEnd = '2026-09-29';
    state.month = 'ALL';
    const monthButtons = document.querySelectorAll('.btn-month-pill');
    monthButtons.forEach(b => {
      if (b.dataset.month === 'ALL') b.classList.add('active');
      else b.classList.remove('active');
    });
    applyFilters();
  }

  /**
   * Update active filter counter pill in UI
   */
  function updateCounterUI() {
    const cur = currentFilteredRecords.length;
    const tot = allRecords.length;
    const pct = tot > 0 ? ((cur / tot) * 100).toFixed(1) : 0;

    // Navbar count
    const navCount = document.getElementById('nav-count-label');
    if (navCount) navCount.textContent = `${Utils.formatNumber(cur)} Titik Api`;

    // FAB Table count
    const fabTableCount = document.getElementById('fab-table-count');
    if (fabTableCount) fabTableCount.textContent = Utils.formatNumber(cur);

    // Navbar Date label
    const navDate = document.getElementById('nav-date-label');
    if (navDate) {
      if (state.dateStart === '2026-06-01' && state.dateEnd === '2026-09-29') {
        navDate.textContent = 'Semua Periode (1 Jun - 29 Sep 2026)';
      } else if (state.dateStart === state.dateEnd) {
        navDate.textContent = Utils.formatDateIndo(state.dateStart);
      } else {
        navDate.textContent = `${Utils.formatDateIndo(state.dateStart)} - ${Utils.formatDateIndo(state.dateEnd)}`;
      }
    }

    // High confidence stat in stats drawer
    const statHigh = document.getElementById('stat-high');
    if (statHigh) {
      const highCount = currentFilteredRecords.filter(r => r[5] === 'H').length;
      statHigh.textContent = Utils.formatNumber(highCount);
    }

    // Total in stats drawer
    const statTotal = document.getElementById('stat-total');
    if (statTotal) {
      statTotal.textContent = Utils.formatNumber(cur);
    }
  }

  /**
   * Subscribe to filter changes
   */
  function onFilterChange(callback) {
    if (typeof callback === 'function') {
      onFilterChangeCallbacks.push(callback);
    }
  }

  function notifySubscribers() {
    onFilterChangeCallbacks.forEach(cb => {
      try {
        cb(currentFilteredRecords);
      } catch (err) {
        console.error('Error in filter subscriber:', err);
      }
    });
  }

  return {
    init,
    resetFilters,
    setDateRange,
    setDateSingle,
    setDateAll,
    getDateState: () => ({ start: state.dateStart, end: state.dateEnd }),
    getFilteredRecords: () => currentFilteredRecords,
    getAllRecords: () => allRecords,
    onFilterChange
  };
})();
