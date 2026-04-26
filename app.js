const map = L.map("map", {
  zoomControl: true,
  preferCanvas: true
}).setView([-6.2, 106.816666], 12);

const baseLayers = {
  "OpenStreetMap": L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }),
  "Carto Light": L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
  })
};

baseLayers["OpenStreetMap"].addTo(map);
L.control.layers(baseLayers, {}, { position: "topright" }).addTo(map);

const measurementFileInput = document.getElementById("measurementFile");
const boundaryFileInput = document.getElementById("boundaryFile");
const clearMapButton = document.getElementById("clearMapButton");
const togglePoints = document.getElementById("togglePoints");
const toggleHeatmap = document.getElementById("toggleHeatmap");
const toggleBoundary = document.getElementById("toggleBoundary");

const statCount = document.getElementById("statCount");
const statMin = document.getElementById("statMin");
const statMax = document.getElementById("statMax");
const statAvg = document.getElementById("statAvg");
const dataStatus = document.getElementById("dataStatus");

const state = {
  pointLayer: null,
  heatLayer: null,
  boundaryLayer: null,
  measurementBounds: null,
  boundaryBounds: null,
  measurementStats: null
};

measurementFileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const geojson = await readGeoJSONFile(file);
    renderMeasurements(geojson);
  } catch (error) {
    updateStatus(error.message, true);
  }
});

boundaryFileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const geojson = await readGeoJSONFile(file);
    renderBoundary(geojson);
  } catch (error) {
    updateStatus(error.message, true);
  }
});

clearMapButton.addEventListener("click", () => {
  removeLayer("pointLayer");
  removeLayer("heatLayer");
  removeLayer("boundaryLayer");

  state.measurementBounds = null;
  state.boundaryBounds = null;
  state.measurementStats = null;

  measurementFileInput.value = "";
  boundaryFileInput.value = "";
  resetStats();
  updateStatus("Layer dibersihkan. Unggah GeoJSON hasil QGIS untuk menampilkan peta lagi.");
  map.setView([-6.2, 106.816666], 12);
});

togglePoints.addEventListener("change", syncLayerVisibility);
toggleHeatmap.addEventListener("change", syncLayerVisibility);
toggleBoundary.addEventListener("change", syncLayerVisibility);

tryAutoLoadData();

async function tryAutoLoadData() {
  if (window.location.protocol === "file:") {
    return;
  }

  try {
    const measurementCandidates = [
      "./data/noise_data.geojson",
      "./data/noise_measured.geojson"
    ];

    for (const candidate of measurementCandidates) {
      const measurementResponse = await fetch(candidate);
      if (!measurementResponse.ok) {
        continue;
      }

      const measurementData = await measurementResponse.json();
      renderMeasurements(measurementData);
      updateStatus(`GeoJSON titik ukur default berhasil dimuat dari ${candidate.replace("./", "")}.`);
      break;
    }
  } catch (error) {
    console.warn("Gagal memuat data default:", error);
  }

  try {
    const boundaryResponse = await fetch("./data/study_area.geojson");
    if (!boundaryResponse.ok) {
      return;
    }

    const boundaryData = await boundaryResponse.json();
    renderBoundary(boundaryData);
  } catch (error) {
    console.warn("Gagal memuat batas area default:", error);
  }
}

function renderMeasurements(geojson) {
  validateFeatureCollection(geojson, "GeoJSON titik ukur");

  const normalizedPoints = extractMeasuredPoints(geojson.features);
  if (!normalizedPoints.length) {
    throw new Error("Tidak ditemukan titik ukur valid dengan koordinat dan atribut noise_db numerik.");
  }

  removeLayer("pointLayer");
  removeLayer("heatLayer");

  const heatData = normalizedPoints.map((item) => [item.lat, item.lng, item.noise]);
  state.heatLayer = L.heatLayer(heatData, {
    radius: 32,
    blur: 24,
    minOpacity: 0.35,
    max: 90,
    gradient: {
      0.25: "#2f7d32",
      0.5: "#f39c12",
      0.72: "#d97706",
      0.88: "#c0392b"
    }
  });

  state.pointLayer = L.geoJSON(
    {
      type: "FeatureCollection",
      features: normalizedPoints.map((item) => item.feature)
    },
    {
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, pointStyle(feature.properties.noise_db)),
      onEachFeature: (feature, layer) => {
        const props = feature.properties || {};
        layer.bindPopup(`
          <div class="popup-title">Titik Pengukuran</div>
          <ul class="popup-list">
            <li><strong>Kebisingan:</strong> ${formatNoise(props.noise_db)}</li>
            <li><strong>Koordinat:</strong> ${layer.getLatLng().lat.toFixed(6)}, ${layer.getLatLng().lng.toFixed(6)}</li>
          </ul>
        `);
      }
    }
  );

  state.measurementBounds = state.pointLayer.getBounds();
  state.measurementStats = calculateStats(normalizedPoints.map((item) => item.noise));

  syncLayerVisibility();
  refreshStats();
  fitToAvailableBounds();
  updateStatus(
    `${normalizedPoints.length} titik ukur valid dimuat. Area tanpa titik tetap kosong dan tidak diinterpretasikan sebagai kebisingan rendah.`
  );
}

function renderBoundary(geojson) {
  validateFeatureCollection(geojson, "GeoJSON batas area");

  removeLayer("boundaryLayer");

  state.boundaryLayer = L.geoJSON(geojson, {
    style: {
      color: "#234e52",
      weight: 2,
      opacity: 0.9,
      fillOpacity: 0
    }
  });

  state.boundaryBounds = state.boundaryLayer.getBounds();
  syncLayerVisibility();
  fitToAvailableBounds();
  updateStatus("Batas area berhasil dimuat sebagai outline transparan.");
}

function syncLayerVisibility() {
  setLayerVisibility("boundaryLayer", toggleBoundary.checked);
  setLayerVisibility("heatLayer", toggleHeatmap.checked);
  setLayerVisibility("pointLayer", togglePoints.checked);
}

function setLayerVisibility(layerKey, shouldShow) {
  const layer = state[layerKey];
  if (!layer) {
    return;
  }

  const isAdded = map.hasLayer(layer);
  if (shouldShow && !isAdded) {
    layer.addTo(map);
  }

  if (!shouldShow && isAdded) {
    map.removeLayer(layer);
  }
}

function removeLayer(layerKey) {
  const layer = state[layerKey];
  if (layer && map.hasLayer(layer)) {
    map.removeLayer(layer);
  }

  state[layerKey] = null;
}

function fitToAvailableBounds() {
  if (state.measurementBounds?.isValid()) {
    map.fitBounds(state.measurementBounds.pad(0.18));
    return;
  }

  if (state.boundaryBounds?.isValid()) {
    map.fitBounds(state.boundaryBounds.pad(0.08));
  }
}

function extractMeasuredPoints(features) {
  const normalizedPoints = [];

  for (const feature of features) {
    if (!feature?.geometry || !feature.properties) {
      continue;
    }

    if (feature.geometry.type === "Point") {
      const normalizedFeature = normalizeMeasurementFeature(feature, feature.geometry.coordinates);
      if (normalizedFeature) {
        normalizedPoints.push(normalizedFeature);
      }
      continue;
    }

    if (feature.geometry.type === "MultiPoint") {
      for (const coordinates of feature.geometry.coordinates) {
        const normalizedFeature = normalizeMeasurementFeature(feature, coordinates);
        if (normalizedFeature) {
          normalizedPoints.push(normalizedFeature);
        }
      }
    }
  }

  return normalizedPoints;
}

function normalizeMeasurementFeature(sourceFeature, coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const [lng, lat] = coordinates;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
    return null;
  }

  const noise = resolveNoiseValue(sourceFeature.properties);
  if (noise === null) {
    return null;
  }

  return {
    lat,
    lng,
    noise,
    feature: {
      type: "Feature",
      properties: {
        ...sourceFeature.properties,
        noise_db: noise
      },
      geometry: {
        type: "Point",
        coordinates: [lng, lat]
      }
    }
  };
}

function resolveNoiseValue(properties) {
  if (!properties || typeof properties !== "object") {
    return null;
  }

  const preferredKeys = ["noise_db", "noise", "db", "noiselevel", "kebisingan"];
  for (const key of preferredKeys) {
    const matchedKey = Object.keys(properties).find((name) => name.toLowerCase() === key);
    if (!matchedKey) {
      continue;
    }

    const value = Number(properties[matchedKey]);
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function calculateStats(values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    avg: total / values.length
  };
}

function refreshStats() {
  if (!state.measurementStats) {
    resetStats();
    return;
  }

  statCount.textContent = String(state.measurementStats.count);
  statMin.textContent = formatNoise(state.measurementStats.min);
  statMax.textContent = formatNoise(state.measurementStats.max);
  statAvg.textContent = formatNoise(state.measurementStats.avg);
}

function resetStats() {
  statCount.textContent = "0";
  statMin.textContent = "-";
  statMax.textContent = "-";
  statAvg.textContent = "-";
}

function pointStyle(noise) {
  if (noise > 75) {
    return {
      radius: 7,
      color: "#8f2318",
      weight: 1.5,
      fillColor: "#c0392b",
      fillOpacity: 0.9
    };
  }

  if (noise >= 65) {
    return {
      radius: 7,
      color: "#9a5b00",
      weight: 1.5,
      fillColor: "#f39c12",
      fillOpacity: 0.88
    };
  }

  return {
    radius: 7,
    color: "#1f5c24",
    weight: 1.5,
    fillColor: "#2f7d32",
    fillOpacity: 0.88
  };
}

function formatNoise(value) {
  return `${value.toFixed(1)} dBA`;
}

function updateStatus(message, isError = false) {
  dataStatus.textContent = message;
  dataStatus.style.color = isError ? "#b23a2f" : "#5b6670";
}

function validateFeatureCollection(geojson, label) {
  if (!geojson || geojson.type !== "FeatureCollection" || !Array.isArray(geojson.features)) {
    throw new Error(`${label} harus berupa FeatureCollection GeoJSON yang valid.`);
  }
}

async function readGeoJSONFile(file) {
  const text = await file.text();
  let parsedData;

  try {
    parsedData = JSON.parse(text);
  } catch (error) {
    throw new Error(`File ${file.name} tidak bisa dibaca sebagai JSON valid.`);
  }

  return parsedData;
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}
