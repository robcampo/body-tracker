// Values are stored and displayed in kg (weight) and cm (length).

function unitFor(key) {
  return MEASUREMENTS_CONFIG[key].type === 'weight' ? 'kg' : 'cm';
}

function measurementToDisplay(storedVal) {
  if (storedVal == null) return '';
  return +storedVal.toFixed(1);
}

function displayToMeasurement(displayVal) {
  return +displayVal;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
