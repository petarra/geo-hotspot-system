/**
 * GeoFire Kalbar - Map Module
 * Leaflet interactive map with MarkerCluster, Heatmap, and Regency Overview layers
 */

const MapModule = (() => {
  let map = null;
  let baseLayers = {};
  let currentBaseLayer = null;

  // Layer groups
  let clusterGroup = null;
  let heatLayer = null;
  let regencyLayer = null;
  let boundaryLayer = null;

  // State
  let currentMode = 'cluster'; // 'cluster' | 'heatmap' | 'regency'
  let summaryData = null;
  let currentRecords = [];
  const defaultCenter = [-0.10, 110.40];
  const defaultZoom = 7;

  /**
   * Initialize Leaflet map
   */
  function init(summary, kalbarGeoJSON) {
    summaryData = summary;

    // Create Map
    map = L.map('map-container', {
      center: defaultCenter,
      zoom: defaultZoom,
      minZoom: 5,
      maxZoom: 18,
      zoomControl: false,
      preferCanvas: true
    });

    // Add standard zoom control at top-left
    L.control.zoom({ position: 'topleft' }).addTo(map);

    // Setup Basemap Tile Layers (100% Free, No API Key Required)
    baseLayers = {
      dark: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
        maxZoom: 16
      }),
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, USGS, GeoEye',
        maxZoom: 18
      }),
      osm: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
      }),
      light: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
        maxZoom: 16
      })
    };

    // Default basemap is Esri World Satellite
    currentBaseLayer = baseLayers.satellite;
    currentBaseLayer.addTo(map);

    // Add Kalbar Province Boundary if available
    if (kalbarGeoJSON) {
      boundaryLayer = L.geoJSON(kalbarGeoJSON, {
        style: {
          color: '#f97316',
          weight: 2,
          opacity: 0.8,
          dashArray: '4, 6',
          fillColor: '#f97316',
          fillOpacity: 0.03
        }
      }).addTo(map);
    }

    // Initialize MarkerCluster group with chunked loading for smooth performance
    clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 40,
      chunkDelay: 10,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction(cluster) {
        const count = cluster.getChildCount();
        let sizeClass = 'marker-cluster-small';
        let size = 36;
        if (count > 250) {
          sizeClass = 'marker-cluster-large';
          size = 50;
        } else if (count > 50) {
          sizeClass = 'marker-cluster-medium';
          size = 42;
        }

        return L.divIcon({
          html: `<div><span>${count.toLocaleString('id-ID')}</span></div>`,
          className: `marker-cluster ${sizeClass}`,
          iconSize: L.point(size, size)
        });
      }
    });

    // Layer for Regency summary badges
    regencyLayer = L.layerGroup();

    // Map Event Listeners
    setupEvents();
  }

  /**
   * Set up UI controls and map movement listeners
   */
  function setupEvents() {
    const coordDisplay = document.getElementById('coord-display');
    const zoomDisplay = document.getElementById('zoom-display');

    // Coordinate & Zoom listener
    map.on('mousemove', (e) => {
      if (coordDisplay) {
        coordDisplay.textContent = `Lat: ${e.latlng.lat.toFixed(4)}°, Lng: ${e.latlng.lng.toFixed(4)}°`;
      }
    });

    map.on('zoomend', () => {
      if (zoomDisplay) {
        zoomDisplay.textContent = `Zoom: ${map.getZoom()}`;
      }
    });

    // Basemap selector (Navbar pills & dropdown support)
    const basemapSelect = document.getElementById('basemap-select');
    if (basemapSelect) {
      basemapSelect.addEventListener('change', (e) => {
        setBaseMap(e.target.value);
      });
    }

    const basemapButtons = document.querySelectorAll('.btn-basemap');
    basemapButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        basemapButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setBaseMap(btn.dataset.basemap);
      });
    });

    // Mode Switch Buttons
    const modeButtons = document.querySelectorAll('.mode-btn');
    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.mode;
        setMode(mode);
      });
    });

    // Reset View Button
    const btnResetMap = document.getElementById('btn-reset-map');
    if (btnResetMap) {
      btnResetMap.addEventListener('click', () => {
        map.setView(defaultCenter, defaultZoom, { animate: true });
      });
    }

    // Fullscreen Toggle Button
    const btnFullscreen = document.getElementById('btn-fullscreen-map');
    if (btnFullscreen) {
      btnFullscreen.addEventListener('click', () => {
        const viewport = document.querySelector('.map-viewport') || document.body;
        if (!document.fullscreenElement) {
          viewport.requestFullscreen().catch(err => console.warn(err));
        } else {
          document.exitFullscreen().catch(err => console.warn(err));
        }
      });
    }

    // Legend toggle
    const legendToggle = document.getElementById('legend-toggle');
    const legendContent = document.getElementById('legend-content');
    if (legendToggle && legendContent) {
      legendToggle.addEventListener('click', () => {
        const isHidden = legendContent.style.display === 'none';
        legendContent.style.display = isHidden ? 'block' : 'none';
        legendToggle.textContent = isHidden ? '−' : '+';
      });
    }
  }

  /**
   * Switch basemap tile layer
   */
  function setBaseMap(type) {
    if (!baseLayers[type]) return;
    if (currentBaseLayer) {
      map.removeLayer(currentBaseLayer);
    }
    currentBaseLayer = baseLayers[type];
    currentBaseLayer.addTo(map);

    // If sat, light or osm is chosen, adapt boundary layer opacity
    if (boundaryLayer) {
      boundaryLayer.bringToFront();
    }
  }

  /**
   * Set visual mode (cluster, heatmap, regency)
   */
  function setMode(mode) {
    currentMode = mode;
    renderCurrentMode();
  }

  /**
   * Re-render current mode with active filtered records
   */
  function renderCurrentMode() {
    showRenderIndicator(true);

    // Remove existing overlays
    if (map.hasLayer(clusterGroup)) map.removeLayer(clusterGroup);
    if (heatLayer && map.hasLayer(heatLayer)) map.removeLayer(heatLayer);
    if (map.hasLayer(regencyLayer)) map.removeLayer(regencyLayer);

    setTimeout(() => {
      if (currentMode === 'cluster') {
        renderClusterMode();
      } else if (currentMode === 'heatmap') {
        renderHeatmapMode();
      } else if (currentMode === 'regency') {
        renderRegencyMode();
      }
      showRenderIndicator(false);
    }, 40);
  }

  /**
   * Render Marker Cluster layer
   */
  function renderClusterMode() {
    clusterGroup.clearLayers();
    const markers = [];

    const colorConfig = {
      'H': { color: '#ef4444', label: 'Tinggi (High)', css: 'popup-tag-high' },
      'M': { color: '#f59e0b', label: 'Sedang (Medium)', css: 'popup-tag-med' },
      'L': { color: '#10b981', label: 'Rendah (Low)', css: 'popup-tag-low' }
    };

    const total = currentRecords.length;
    for (let i = 0; i < total; i++) {
      const item = currentRecords[i];
      // item: [kab, kec, desa, date, time, conf, lat, lng]
      const conf = item[5];
      const cfg = colorConfig[conf] || colorConfig['M'];
      const lat = item[6];
      const lng = item[7];

      // Lightweight CircleMarker
      const marker = L.circleMarker([lat, lng], {
        radius: conf === 'H' ? 6 : 4,
        fillColor: cfg.color,
        color: '#ffffff',
        weight: 1,
        opacity: 0.9,
        fillOpacity: 0.85
      });

      // Lazy popup creation on click
      marker.bindPopup(() => createPopupContent(item, cfg));
      markers.push(marker);
    }

    clusterGroup.addLayers(markers);
    map.addLayer(clusterGroup);
  }

  /**
   * Render Heatmap layer using Leaflet.heat
   */
  function renderHeatmapMode() {
    const heatData = [];
    const intensityMap = { 'H': 1.0, 'M': 0.6, 'L': 0.3 };

    const len = currentRecords.length;
    for (let i = 0; i < len; i++) {
      const item = currentRecords[i];
      const intensity = intensityMap[item[5]] || 0.5;
      heatData.push([item[6], item[7], intensity]);
    }

    if (heatLayer) {
      heatLayer.setLatLngs(heatData);
    } else {
      heatLayer = L.heatLayer(heatData, {
        radius: 20,
        blur: 18,
        maxZoom: 14,
        max: 1.0,
        gradient: {
          0.2: '#10b981',
          0.4: '#06b6d4',
          0.6: '#f59e0b',
          0.8: '#f97316',
          1.0: '#ef4444'
        }
      });
    }

    map.addLayer(heatLayer);
  }

  /**
   * Render Regency Overview mode with interactive badges
   */
  function renderRegencyMode() {
    regencyLayer.clearLayers();

    // Calculate dynamic counts based on current filtered records
    const counts = {};
    currentRecords.forEach(r => {
      const kab = r[0];
      counts[kab] = (counts[kab] || 0) + 1;
    });

    if (summaryData && summaryData.byKabupaten) {
      summaryData.byKabupaten.forEach(k => {
        const count = counts[k.name] || 0;
        if (count === 0 && currentRecords.length < summaryData.total) return;

        const badgeHtml = `
          <div class="regency-badge">
            <span class="regency-badge-name">${k.name}</span>
            <span class="regency-badge-count">${count.toLocaleString('id-ID')}</span>
          </div>
        `;

        const icon = L.divIcon({
          html: badgeHtml,
          className: 'regency-icon-container',
          iconSize: [120, 48],
          iconAnchor: [60, 24]
        });

        const marker = L.marker(k.center, { icon });

        marker.on('click', () => {
          // Trigger filter selection for this regency
          const sel = document.getElementById('filter-kabupaten');
          if (sel) {
            sel.value = k.name;
            sel.dispatchEvent(new Event('change'));
          }
          map.setView(k.center, 9, { animate: true });
        });

        regencyLayer.addLayer(marker);
      });
    }

    map.addLayer(regencyLayer);
  }

  /**
   * Create HTML content for marker popup
   */
  function createPopupContent(item, cfg) {
    // item: [kab, kec, desa, date, time, conf, lat, lng]
    return `
      <div class="hotspot-popup">
        <div class="hotspot-popup-head">
          <span class="popup-tag ${cfg.css}">${cfg.label}</span>
          <span style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted);">${item[4]} WIB</span>
        </div>
        <div class="hotspot-popup-title">${item[2] !== '-' ? item[2] : 'Desa ' + item[1]}</div>
        <div class="hotspot-popup-desc">Kec. ${item[1]}, Kab. ${item[0]}</div>
        <div class="hotspot-popup-grid">
          <div class="popup-item">
            <span>Tanggal</span>
            <strong>${Utils.formatDateIndo(item[3])}</strong>
          </div>
          <div class="popup-item">
            <span>Satelit</span>
            <strong>NASA-NOAA20</strong>
          </div>
          <div class="popup-item" style="grid-column: span 2;">
            <span>Koordinat (Lat, Lng)</span>
            <strong>${item[6].toFixed(5)}, ${item[7].toFixed(5)}</strong>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Show/hide rendering loading indicator
   */
  function showRenderIndicator(show) {
    const ind = document.getElementById('map-render-indicator');
    if (ind) {
      if (show) ind.classList.add('active');
      else ind.classList.remove('active');
    }
  }

  /**
   * Update map data with new filtered records
   */
  function updateData(records) {
    currentRecords = records;
    renderCurrentMode();
  }

  /**
   * Zoom directly to a specific hotspot coordinate (used by Table action)
   */
  function zoomToHotspot(lat, lng) {
    if (!map) return;
    map.setView([lat, lng], 13, { animate: true });

    // Scroll smoothly to map section
    const mapSection = document.getElementById('peta');
    if (mapSection) {
      mapSection.scrollIntoView({ behavior: 'smooth' });
    }

    // Highlight with temporary pulsing marker
    const pulseIcon = L.divIcon({
      html: '<div style="width:20px;height:20px;border-radius:50%;background:#ef4444;box-shadow:0 0 16px #ef4444;animation:pulse-ring 1s infinite;"></div>',
      className: '',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const tempMarker = L.marker([lat, lng], { icon: pulseIcon }).addTo(map);
    setTimeout(() => {
      map.removeLayer(tempMarker);
    }, 4000);
  }

  return {
    init,
    updateData,
    setMode,
    zoomToHotspot,
    invalidateSize: () => map?.invalidateSize(),
    getMap: () => map
  };
})();
