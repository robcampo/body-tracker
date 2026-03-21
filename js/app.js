const { createApp, reactive, ref, computed, watch, nextTick } = Vue;

createApp({
  setup() {
    // ── State ────────────────────────────────────────────────────────────────

    const appData       = reactive(loadData());
    const currentScreen = ref('dashboard');
    const entryDate     = ref(todayISO());
    const logInputs     = reactive({});
    const openEntries   = reactive(new Set());

    const chartKey       = ref('');
    const chartDateRange = ref('all');
    const chartCanvas    = ref(null);

    const dashboardDateRange  = ref('30');
    const dashboardCanvases   = {};       // canvas el refs from v-for
    const dashboardInstances  = {};       // Chart.js instances

    const toastMessage = ref('');
    const toastVisible = ref(false);
    let toastTimer     = null;
    let chartInstance  = null;

    // ── Auto-save whenever data changes ──────────────────────────────────────

    watch(appData, () => saveData(appData), { deep: true });

    // ── Computed ─────────────────────────────────────────────────────────────

    const trackedMeasurements = computed(() => appData.settings.trackedMeasurements);

    const sortedEntries = computed(() =>
      [...appData.entries].sort((a, b) => b.date.localeCompare(a.date))
    );

    const currentEntry = computed(() =>
      appData.entries.find(e => e.date === entryDate.value)
    );

    const chartMeasurementOptions = computed(() =>
      appData.settings.trackedMeasurements.map(key => ({
        value: key,
        label: MEASUREMENTS_CONFIG[key].label,
      }))
    );

    // Derived chart data for the Charts screen.
    const chartPoints = computed(() => {
      const key = chartKey.value;
      if (!key) return { labels: [], values: [] };

      let entries = [...appData.entries]
        .sort((a, b) => a.date.localeCompare(b.date))
        .filter(e => e.measurements[key] != null);

      if (chartDateRange.value !== 'all') {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - parseInt(chartDateRange.value));
        entries = entries.filter(e => new Date(e.date + 'T00:00:00') >= cutoff);
      }

      return {
        labels: entries.map(e => formatShortDate(e.date)),
        values: entries.map(e => measurementToDisplay(e.measurements[key])),
      };
    });

    const chartStats = computed(() => {
      const { values } = chartPoints.value;
      const key = chartKey.value;
      if (!key || values.length === 0) return null;

      const unit  = unitFor(key);
      const first = values[0];
      const last  = values[values.length - 1];
      const diff  = +(last - first).toFixed(1);

      return {
        current:     `${last} ${unit}`,
        change:      (diff > 0 ? '+' : '') + diff,
        changeColor: diff > 0 ? 'var(--warning)' : diff < 0 ? 'var(--success)' : 'var(--text)',
        range:       `${Math.min(...values)}–${Math.max(...values)} ${unit}`,
      };
    });

    // Dashboard data — one entry per tracked measurement.
    const dashboardData = computed(() => {
      const result = {};

      appData.settings.trackedMeasurements.forEach(key => {
        let entries = [...appData.entries]
          .sort((a, b) => a.date.localeCompare(b.date))
          .filter(e => e.measurements[key] != null);

        if (dashboardDateRange.value !== 'all') {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - parseInt(dashboardDateRange.value));
          entries = entries.filter(e => new Date(e.date + 'T00:00:00') >= cutoff);
        }

        const values  = entries.map(e => measurementToDisplay(e.measurements[key]));
        const labels  = entries.map(e => formatShortDate(e.date));
        const current = values.length > 0 ? values[values.length - 1] : null;
        const trend   = computeTrend(values);

        const first     = values[0];
        const last      = values[values.length - 1];
        const change    = values.length >= 2 ? +(last - first).toFixed(1) : null;
        const changePct = values.length >= 2 && first !== 0
          ? +((last - first) / Math.abs(first) * 100).toFixed(1)
          : null;

        result[key] = { values, labels, current, trend, change, changePct,
          trendInfo: getTrendInfo(key, trend) };
      });

      return result;
    });

    // ── Helpers ──────────────────────────────────────────────────────────────

    function entryPreview(entry) {
      const items = appData.settings.trackedMeasurements
        .filter(k => entry.measurements[k] != null)
        .slice(0, 3)
        .map(k => `${MEASUREMENTS_CONFIG[k].label}: ${measurementToDisplay(entry.measurements[k])} ${unitFor(k)}`);
      return items.join(' · ') || 'No tracked measurements';
    }

    function showToast(msg) {
      toastMessage.value = msg;
      toastVisible.value = true;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastVisible.value = false; }, 2500);
    }

    // ── Trend logic ───────────────────────────────────────────────────────────

    // Returns 'up' | 'down' | 'stable' | 'neutral' based on % change first→last.
    function computeTrend(values) {
      if (values.length < 2) return 'neutral';
      const pct = ((values[values.length - 1] - values[0]) / Math.abs(values[0])) * 100;
      if (Math.abs(pct) < 2) return 'stable';
      return pct > 0 ? 'up' : 'down';
    }

    function getTrendInfo(key, trend) {
      const type = MEASUREMENTS_CONFIG[key].type;
      const msgs = TREND_MESSAGES[type] ?? TREND_MESSAGES.length;
      const msg  = msgs[trend] ?? msgs.neutral;

      const color = trend === 'down'    ? 'var(--success)'
                  : trend === 'stable'  ? 'var(--primary-light)'
                  : trend === 'up'      ? 'var(--warning)'
                  : 'var(--text-muted)';

      return { ...msg, color };
    }

    // Chart line colour reflects the trend direction.
    function trendChartColor(trend) {
      if (trend === 'down')   return { border: '#10b981', bg: 'rgba(16,185,129,0.1)' };
      if (trend === 'up')     return { border: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
      return                         { border: '#a78bfa', bg: 'rgba(167,139,250,0.1)' };
    }

    // Shared Chart.js options for both dashboard mini-charts and the main chart.
    function baseChartOptions(unit, maxTicks = 6) {
      return {
        responsive:          true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#22223a',
            borderColor:     '#2a2a44',
            borderWidth:     1,
            titleColor:      '#a78bfa',
            bodyColor:       '#f0f0ff',
            callbacks: { label: ctx => `${ctx.parsed.y} ${unit}` },
          },
        },
        scales: {
          x: {
            ticks: { color: '#8080a8', maxTicksLimit: maxTicks, font: { size: 10 } },
            grid:  { color: '#22223a' },
          },
          y: {
            ticks: { color: '#8080a8', font: { size: 10 } },
            grid:  { color: '#22223a' },
          },
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
      };
    }

    // ── Log screen ───────────────────────────────────────────────────────────

    function populateLogInputs() {
      const entry = currentEntry.value;
      appData.settings.trackedMeasurements.forEach(key => {
        const stored = entry?.measurements[key];
        logInputs[key] = stored != null ? String(measurementToDisplay(stored)) : '';
      });
    }

    watch(entryDate, populateLogInputs);
    watch(() => [...appData.settings.trackedMeasurements], populateLogInputs);

    function saveEntry() {
      if (!entryDate.value) { showToast('Please select a date'); return; }

      const measurements = {};
      let hasAny = false;

      appData.settings.trackedMeasurements.forEach(key => {
        const raw = logInputs[key];
        if (raw !== '' && raw != null) {
          const num = parseFloat(raw);
          if (!isNaN(num) && num >= 0) {
            measurements[key] = displayToMeasurement(num);
            hasAny = true;
          }
        }
      });

      if (!hasAny) { showToast('Please enter at least one measurement'); return; }

      const idx = appData.entries.findIndex(e => e.date === entryDate.value);
      if (idx >= 0) {
        appData.entries[idx] = { date: entryDate.value, measurements };
      } else {
        appData.entries.push({ date: entryDate.value, measurements });
        appData.entries.sort((a, b) => a.date.localeCompare(b.date));
      }

      showToast('Entry saved!');
    }

    // ── History screen ───────────────────────────────────────────────────────

    function toggleEntry(date) {
      openEntries.has(date) ? openEntries.delete(date) : openEntries.add(date);
    }

    function deleteEntry(date) {
      if (!confirm(`Delete entry for ${formatDate(date)}?`)) return;
      const idx = appData.entries.findIndex(e => e.date === date);
      if (idx >= 0) appData.entries.splice(idx, 1);
      openEntries.delete(date);
      showToast('Entry deleted');
    }

    // ── Charts screen ────────────────────────────────────────────────────────

    function renderChart() {
      if (!chartCanvas.value) return;
      if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

      const { labels, values } = chartPoints.value;
      if (values.length === 0) return;

      const key   = chartKey.value;
      const unit  = unitFor(key);
      const color = trendChartColor(computeTrend(values));

      chartInstance = new Chart(chartCanvas.value.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data:               values,
            borderColor:        color.border,
            backgroundColor:    color.bg,
            borderWidth:        2.5,
            pointRadius:        values.length > 30 ? 2 : 5,
            pointHoverRadius:   7,
            pointBackgroundColor: color.border,
            pointBorderColor:   '#0d0d14',
            pointBorderWidth:   2,
            fill:               true,
            tension:            0.35,
          }],
        },
        options: baseChartOptions(unit, 6),
      });
    }

    watch(chartPoints, () => {
      if (currentScreen.value === 'charts') nextTick(renderChart);
    }, { deep: true });

    // ── Dashboard screen ──────────────────────────────────────────────────────

    // Called from v-for :ref to collect canvas elements.
    function setDashboardCanvasRef(key, el) {
      if (el) {
        dashboardCanvases[key] = el;
      } else {
        delete dashboardCanvases[key];
        if (dashboardInstances[key]) {
          dashboardInstances[key].destroy();
          delete dashboardInstances[key];
        }
      }
    }

    function renderDashboardCharts() {
      // Destroy all existing instances before re-drawing.
      Object.keys(dashboardInstances).forEach(key => {
        dashboardInstances[key].destroy();
        delete dashboardInstances[key];
      });

      appData.settings.trackedMeasurements.forEach(key => {
        const canvas = dashboardCanvases[key];
        const data   = dashboardData.value[key];
        if (!canvas || !data || data.values.length < 2) return;

        const unit  = unitFor(key);
        const color = trendChartColor(data.trend);

        dashboardInstances[key] = new Chart(canvas.getContext('2d'), {
          type: 'line',
          data: {
            labels: data.labels,
            datasets: [{
              data:             data.values,
              borderColor:      color.border,
              backgroundColor:  color.bg,
              borderWidth:      2,
              pointRadius:      data.values.length > 20 ? 0 : 3,
              pointHoverRadius: 5,
              fill:             true,
              tension:          0.35,
            }],
          },
          options: baseChartOptions(unit, 4),
        });
      });
    }

    // Re-render dashboard charts when data changes (range, units, new entries).
    watch(dashboardData, () => {
      if (currentScreen.value === 'dashboard') nextTick(renderDashboardCharts);
    }, { deep: true });

    // ── Settings screen ──────────────────────────────────────────────────────

    function toggleMeasurement(key, checked) {
      const list = appData.settings.trackedMeasurements;
      if (checked) {
        if (!list.includes(key)) list.push(key);
      } else {
        const idx = list.indexOf(key);
        if (idx >= 0) list.splice(idx, 1);
      }
    }

    function clearAllData() {
      if (!confirm('This will permanently delete ALL entries. Are you sure?')) return;
      appData.entries.splice(0);
      showToast('All data cleared');
    }

    // ── Navigation ───────────────────────────────────────────────────────────

    function navigate(screen) {
      currentScreen.value = screen;

      if (screen === 'log') populateLogInputs();

      if (screen === 'charts') {
        if (!chartKey.value && appData.settings.trackedMeasurements.length > 0) {
          chartKey.value = appData.settings.trackedMeasurements[0];
        }
        nextTick(renderChart);
      }

      if (screen === 'dashboard') {
        nextTick(renderDashboardCharts);
      }
    }

    // ── Init ─────────────────────────────────────────────────────────────────

    populateLogInputs();
    if (appData.settings.trackedMeasurements.length > 0) {
      chartKey.value = appData.settings.trackedMeasurements[0];
    }

    // Render dashboard charts on first load.
    nextTick(renderDashboardCharts);

    // ── Expose to template ───────────────────────────────────────────────────

    return {
      // Config
      MEASUREMENTS_CONFIG, DATE_RANGES, DASHBOARD_RANGES,

      // State
      appData, currentScreen, entryDate, logInputs, openEntries,
      chartKey, chartDateRange, chartCanvas,
      dashboardDateRange,
      toastMessage, toastVisible,

      // Computed
      trackedMeasurements, sortedEntries, currentEntry,
      chartMeasurementOptions, chartPoints, chartStats, dashboardData,

      // Methods
      navigate, saveEntry, deleteEntry, toggleEntry,
      toggleMeasurement, clearAllData,
      setDashboardCanvasRef,
      unitFor, entryPreview, formatDate, measurementToDisplay,
    };
  },
}).mount('#app');
