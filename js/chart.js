/**
 * GeoFire Kalbar - Chart Module
 * Interactive Chart.js visualizations for geospatial hotspot statistics
 */

const ChartModule = (() => {
  let chartKabupaten = null;
  let chartConfidence = null;
  let chartTrend = null;
  let chartKecamatan = null;

  let currentTrendMode = 'daily'; // 'daily' | 'monthly'
  let cachedRecords = [];
  let summaryData = null;

  /**
   * Helper to get theme-dependent chart colors
   */
  function getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    return {
      textColor: isDark ? '#94a3b8' : '#475569',
      gridColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      tooltipBg: isDark ? '#1e293b' : '#ffffff',
      tooltipText: isDark ? '#f8fafc' : '#0f172a'
    };
  }

  /**
   * Initialize all Chart.js instances
   */
  function init(summary, initialRecords) {
    summaryData = summary;
    cachedRecords = initialRecords;

    // Setup Chart.js global defaults
    Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
    Chart.defaults.font.size = 12;

    initKabupatenChart();
    initConfidenceChart();
    initTrendChart();
    initKecamatanChart();

    setupEventListeners();
  }

  /**
   * Chart 1: Bar Chart per Kabupaten/Kota
   */
  function initKabupatenChart() {
    const ctx = document.getElementById('chart-kabupaten');
    if (!ctx) return;

    const colors = getThemeColors();
    chartKabupaten = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: 'Jumlah Titik Api',
          data: [],
          backgroundColor: 'rgba(232, 93, 38, 0.7)',
          borderColor: '#e85d26',
          borderWidth: 1.5,
          borderRadius: 6,
          hoverBackgroundColor: '#dc2626'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label(context) {
                return ` ${Utils.formatNumber(context.raw)} titik api`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: colors.textColor, font: { size: 11 } }
          },
          y: {
            grid: { color: colors.gridColor },
            ticks: {
              color: colors.textColor,
              font: { family: "'JetBrains Mono', monospace", size: 11 },
              callback: (val) => Utils.formatNumber(val)
            }
          }
        }
      }
    });
  }

  /**
   * Chart 2: Donut Chart Confidence Distribution
   */
  function initConfidenceChart() {
    const ctx = document.getElementById('chart-confidence');
    if (!ctx) return;

    const colors = getThemeColors();
    chartConfidence = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['High (Tinggi)', 'Medium (Sedang)', 'Low (Rendah)'],
        datasets: [{
          data: [0, 0, 0],
          backgroundColor: ['#dc2626', '#d97706', '#16a34a'],
          borderWidth: 2,
          borderColor: document.documentElement.getAttribute('data-theme') === 'light' ? '#ffffff' : '#0e1420',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: colors.textColor,
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 18,
              font: { size: 12, weight: '600' }
            }
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const val = context.raw;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${Utils.formatNumber(val)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  /**
   * Chart 3: Line / Area Chart Trend
   */
  function initTrendChart() {
    const ctx = document.getElementById('chart-trend');
    if (!ctx) return;

    const colors = getThemeColors();
    chartTrend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Deteksi Titik Api',
          data: [],
          borderColor: '#dc2626',
          backgroundColor: 'rgba(220, 38, 38, 0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 2,
          pointHoverRadius: 6,
          pointBackgroundColor: '#dc2626',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              title(items) {
                return currentTrendMode === 'daily'
                  ? Utils.formatDateIndo(items[0].label)
                  : Utils.getMonthName(items[0].label);
              },
              label(context) {
                return ` ${Utils.formatNumber(context.raw)} titik api`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: colors.textColor,
              maxTicksLimit: 12,
              font: { size: 11 }
            }
          },
          y: {
            grid: { color: colors.gridColor },
            ticks: {
              color: colors.textColor,
              font: { family: "'JetBrains Mono', monospace", size: 11 },
              callback: (val) => Utils.formatNumber(val)
            }
          }
        }
      }
    });
  }

  /**
   * Chart 4: Horizontal Bar Chart Top 10 Kecamatan
   */
  function initKecamatanChart() {
    const ctx = document.getElementById('chart-kecamatan');
    if (!ctx) return;

    const colors = getThemeColors();
    chartKecamatan = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: 'Jumlah Titik Panas',
          data: [],
          backgroundColor: 'rgba(220, 38, 38, 0.7)',
          borderColor: '#dc2626',
          borderWidth: 1.5,
          borderRadius: 6,
          hoverBackgroundColor: '#e85d26'
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: colors.tooltipText,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label(context) {
                return ` ${Utils.formatNumber(context.raw)} titik api`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: colors.gridColor },
            ticks: {
              color: colors.textColor,
              font: { family: "'JetBrains Mono', monospace", size: 11 },
              callback: (val) => Utils.formatNumber(val)
            }
          },
          y: {
            grid: { display: false },
            ticks: { color: colors.textColor, font: { size: 11 } }
          }
        }
      }
    });
  }

  /**
   * Setup event listeners for trend mode buttons (Daily vs Monthly)
   */
  function setupEventListeners() {
    const trendButtons = document.querySelectorAll('.chart-toggle-btn');
    trendButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        trendButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTrendMode = btn.dataset.trend;
        updateTrendData(cachedRecords);
      });
    });
  }

  /**
   * Update all charts with newly filtered records
   */
  function updateData(records) {
    cachedRecords = records;

    // 1. Aggregation
    const kabCounts = {};
    const confCounts = { 'H': 0, 'M': 0, 'L': 0 };
    const kecCounts = {};

    const len = records.length;
    for (let i = 0; i < len; i++) {
      const row = records[i];
      // row: [kab, kec, desa, date, time, conf, lat, lng]
      const kab = row[0];
      const kec = `${row[1]} (${kab})`;
      const conf = row[5];

      kabCounts[kab] = (kabCounts[kab] || 0) + 1;
      kecCounts[kec] = (kecCounts[kec] || 0) + 1;
      if (conf in confCounts) confCounts[conf]++;
    }

    // 2. Update Kabupaten Chart
    if (chartKabupaten) {
      const sortedKab = Object.entries(kabCounts).sort((a, b) => b[1] - a[1]);
      chartKabupaten.data.labels = sortedKab.map(x => x[0]);
      chartKabupaten.data.datasets[0].data = sortedKab.map(x => x[1]);
      chartKabupaten.update();
    }

    // 3. Update Confidence Donut Chart
    if (chartConfidence) {
      chartConfidence.data.datasets[0].data = [
        confCounts['H'] || 0,
        confCounts['M'] || 0,
        confCounts['L'] || 0
      ];
      chartConfidence.update();
    }

    // 4. Update Trend Chart
    updateTrendData(records);

    // 5. Update Top 10 Kecamatan Chart
    if (chartKecamatan) {
      const sortedKec = Object.entries(kecCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
      chartKecamatan.data.labels = sortedKec.map(x => x[0]);
      chartKecamatan.data.datasets[0].data = sortedKec.map(x => x[1]);
      chartKecamatan.update();
    }
  }

  /**
   * Aggregate and render trend data (Daily vs Monthly)
   */
  function updateTrendData(records) {
    const ctx = document.getElementById('chart-trend');
    if (!ctx) return;

    const colors = getThemeColors();

    if (currentTrendMode === 'monthly') {
      const monthMap = {};
      records.forEach(r => {
        const monthKey = r[3].substring(0, 7); // 'YYYY-MM'
        monthMap[monthKey] = (monthMap[monthKey] || 0) + 1;
      });

      const sortedMonths = Object.keys(monthMap).sort();
      const labels = sortedMonths.map(k => Utils.getMonthName(k));
      const data = sortedMonths.map(k => monthMap[k]);

      if (chartTrend) chartTrend.destroy();

      chartTrend = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Deteksi Titik Api Bulanan',
            data: data,
            backgroundColor: 'rgba(220, 38, 38, 0.7)',
            borderColor: '#dc2626',
            borderWidth: 1.5,
            borderRadius: 8,
            hoverBackgroundColor: '#e85d26'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: colors.tooltipBg,
              titleColor: colors.tooltipText,
              bodyColor: colors.tooltipText,
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label(context) {
                  return ` ${Utils.formatNumber(context.raw)} titik api`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: colors.textColor, font: { size: 11 } }
            },
            y: {
              grid: { color: colors.gridColor },
              ticks: {
                color: colors.textColor,
                font: { family: "'JetBrains Mono', monospace", size: 11 },
                callback: (val) => Utils.formatNumber(val)
              }
            }
          }
        }
      });
    } else {
      const dailyMap = {};
      records.forEach(r => {
        const dateKey = r[3]; // 'YYYY-MM-DD'
        dailyMap[dateKey] = (dailyMap[dateKey] || 0) + 1;
      });

      const sortedDates = Object.keys(dailyMap).sort();
      const labels = sortedDates;
      const data = sortedDates.map(k => dailyMap[k]);

      if (chartTrend) chartTrend.destroy();

      chartTrend = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Deteksi Titik Api Harian',
            data: data,
            borderColor: '#dc2626',
            backgroundColor: 'rgba(220, 38, 38, 0.15)',
            fill: true,
            tension: 0.35,
            pointRadius: sortedDates.length > 50 ? 0 : 3,
            pointHoverRadius: 6,
            pointBackgroundColor: '#dc2626',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: colors.tooltipBg,
              titleColor: colors.tooltipText,
              bodyColor: colors.tooltipText,
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                title(items) {
                  return Utils.formatDateIndo(items[0].label);
                },
                label(context) {
                  return ` ${Utils.formatNumber(context.raw)} titik api`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                color: colors.textColor,
                maxTicksLimit: 12,
                font: { size: 11 }
              }
            },
            y: {
              grid: { color: colors.gridColor },
              ticks: {
                color: colors.textColor,
                font: { family: "'JetBrains Mono', monospace", size: 11 },
                callback: (val) => Utils.formatNumber(val)
              }
            }
          }
        }
      });
    }
  }

  /**
   * Update chart colors when user switches light/dark theme
   */
  function updateTheme() {
    const colors = getThemeColors();
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

    [chartKabupaten, chartTrend, chartKecamatan].forEach(chart => {
      if (!chart) return;
      if (chart.options.scales.x) {
        chart.options.scales.x.ticks.color = colors.textColor;
        if (chart.options.scales.x.grid) chart.options.scales.x.grid.color = colors.gridColor;
      }
      if (chart.options.scales.y) {
        chart.options.scales.y.ticks.color = colors.textColor;
        if (chart.options.scales.y.grid) chart.options.scales.y.grid.color = colors.gridColor;
      }
      chart.options.plugins.tooltip.backgroundColor = colors.tooltipBg;
      chart.options.plugins.tooltip.titleColor = colors.tooltipText;
      chart.options.plugins.tooltip.bodyColor = colors.tooltipText;
      chart.update();
    });

    if (chartConfidence) {
      chartConfidence.options.plugins.legend.labels.color = colors.textColor;
      chartConfidence.data.datasets[0].borderColor = isDark ? '#0e1420' : '#ffffff';
      chartConfidence.update();
    }
  }

  /**
   * Force resize on all active charts
   */
  function resize() {
    [chartKabupaten, chartConfidence, chartTrend, chartKecamatan].forEach(c => {
      try { c?.resize(); } catch(e) {}
    });
  }

  return {
    init,
    updateData,
    updateTheme,
    resize
  };
})();
