const STORAGE_KEY = 'bodyTrackerData';

const DEFAULT_DATA = {
  settings: {
    trackedMeasurements: ['weight', 'waist', 'hips'],
  },
  entries: [],
};

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load data from localStorage', e);
  }
  return structuredClone(DEFAULT_DATA);
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save data to localStorage', e);
  }
}
