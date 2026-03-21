const MEASUREMENTS_CONFIG = {
  weight:      { label: 'Weight',       icon: '⚖️',  type: 'weight' },
  waist:       { label: 'Waist',        icon: '📏',  type: 'length' },
  hips:        { label: 'Hips',         icon: '📏',  type: 'length' },
  chest:       { label: 'Chest',        icon: '📏',  type: 'length' },
  arm_left:    { label: 'Left Arm',     icon: '💪',  type: 'length' },
  arm_right:   { label: 'Right Arm',    icon: '💪',  type: 'length' },
  thigh_left:  { label: 'Left Thigh',   icon: '🦵',  type: 'length' },
  thigh_right: { label: 'Right Thigh',  icon: '🦵',  type: 'length' },
  neck:        { label: 'Neck',         icon: '📏',  type: 'length' },
  shoulder:    { label: 'Shoulders',    icon: '📐',  type: 'length' },
  calf:        { label: 'Calf',         icon: '📏',  type: 'length' },
};


const DATE_RANGES = [
  { value: 'all', label: 'All time' },
  { value: '90',  label: '90 days' },
  { value: '30',  label: '30 days' },
];

const DASHBOARD_RANGES = [
  { value: '7',   label: '1 Week' },
  { value: '30',  label: '1 Month' },
  { value: '90',  label: '3 Months' },
  { value: 'all', label: 'All Time' },
];

// Trend messages per direction and measurement type.
const TREND_MESSAGES = {
  weight: {
    down:    { text: 'Well done, you\'re losing weight!', emoji: '🎉' },
    stable:  { text: 'Great, you\'re maintaining weight',  emoji: '👌' },
    up:      { text: 'You\'re gaining weight',             emoji: '📈' },
    neutral: { text: 'Log more entries to see a trend',    emoji: '📊' },
  },
  length: {
    down:    { text: 'Looking trimmer — keep it up!',  emoji: '🎉' },
    stable:  { text: 'Staying consistent',              emoji: '👌' },
    up:      { text: 'Trending up a little',            emoji: '📈' },
    neutral: { text: 'Log more entries to see a trend', emoji: '📊' },
  },
};
