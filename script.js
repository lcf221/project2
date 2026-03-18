/* ════════════════════════════════════════════════════════════
   MOOD TRACKER  ·  script.js
   ────────────────────────────────────────────────────────────
   Flow:
     Welcome (5 s) → Mood Selection → Mood Screen (3 s) →
     Monthly Calendar  ←→  Yearly Tracker
════════════════════════════════════════════════════════════ */

/* Set to true while adjusting plant-button positions */
const SHOW_DEBUG = false;

/* ─── Mood configuration ─────────────────────────────────── */
const MOODS = {
  happy: {
    color:  '#e8d878',
    emoji:  '🌻',
    label:  'Happy',
    screen: 'screen-happy',
  },
  sad: {
    color:  '#7ab8d8',
    emoji:  '🌸',
    label:  'Sad',
    screen: 'screen-sad',
  },
  meh: {
    color:  '#c4a8d8',
    emoji:  '🌿',
    label:  'Meh',
    screen: 'screen-meh',
  },
  stressed: {
    color:  '#e07858',
    emoji:  '🌺',
    label:  'Stressed',
    screen: 'screen-stressed',
  },
  angry: {
    color:  '#7fb87f',
    emoji:  '🌵',
    label:  'Angry',
    screen: 'screen-angry',
  },
};

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const MONTH_ABBRS  = ['J','F','M','A','M','J','J','A','S','O','N','D'];
const DAY_ABBRS    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/* ─── State ──────────────────────────────────────────────── */
let currentMood   = null;
let calendarDate  = new Date();   // month currently shown in calendar
let trackerYear   = new Date().getFullYear();
let moodTimer     = null;

/* ════════════════════════════════════════════════════════════
   DATA  –  localStorage helpers
════════════════════════════════════════════════════════════ */
function getMoodData() {
  try { return JSON.parse(localStorage.getItem('moodData') || '{}'); }
  catch { return {}; }
}

function saveMoodForDate(dateStr, mood) {
  const data = getMoodData();
  data[dateStr] = mood;
  localStorage.setItem('moodData', JSON.stringify(data));
}

function getMoodForDate(dateStr) {
  return getMoodData()[dateStr] || null;
}

/* ─── Date helpers ───────────────────────────────────────── */
function todayStr() {
  return formatDateStr(new Date());
}

function formatDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

/* ════════════════════════════════════════════════════════════
   SCREEN NAVIGATION
════════════════════════════════════════════════════════════ */
function showScreen(id, afterShow) {
  document.querySelectorAll('.screen.active').forEach(s => s.classList.remove('active'));
  const next = document.getElementById(id);
  if (!next) return;
  next.classList.add('active');
  if (afterShow) setTimeout(afterShow, 50);
}

/* ════════════════════════════════════════════════════════════
   SCREEN 1  ·  WELCOME
════════════════════════════════════════════════════════════ */
function initWelcome() {
  setTimeout(() => {
    showScreen('screen-mood-select', refreshDateDisplay);
  }, 5000);
}

/* ════════════════════════════════════════════════════════════
   SCREEN 2  ·  MOOD SELECTION
════════════════════════════════════════════════════════════ */
function refreshDateDisplay() {
  const now   = new Date();
  const month = MONTH_NAMES[now.getMonth()].toUpperCase();
  const day   = now.getDate();
  const year  = now.getFullYear();
  const el    = document.getElementById('current-date');
  if (el) el.textContent = `${month} ${day}, ${year}`;
}

function initMoodButtons() {
  /* Debug mode: show button outlines */
  if (SHOW_DEBUG) {
    document.querySelectorAll('.plant-btn').forEach(b => {
      b.style.outline = '2px solid red';
      b.style.background = 'rgba(255,0,0,0.12)';
    });
  }

  document.querySelectorAll('.plant-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mood = btn.dataset.mood;
      if (mood) selectMood(mood);
    });
  });
}

function selectMood(mood) {
  currentMood = mood;
  saveMoodForDate(todayStr(), mood);

  showScreen(MOODS[mood].screen, () => {
    startMoodScreenTimer();
  });
}

/* ════════════════════════════════════════════════════════════
   SCREENS 3–7  ·  INDIVIDUAL MOOD SCREENS
════════════════════════════════════════════════════════════ */
function startMoodScreenTimer() {
  clearTimeout(moodTimer);
  moodTimer = setTimeout(navigateToCalendar, 3000);
}

function navigateToCalendar() {
  clearTimeout(moodTimer);
  calendarDate = new Date();
  showScreen('screen-calendar', renderCalendar);
}

function initMoodScreens() {
  document.querySelectorAll('.mood-screen').forEach(screen => {
    screen.addEventListener('click', navigateToCalendar);
  });
}

/* ════════════════════════════════════════════════════════════
   SCREEN 8  ·  MONTHLY CALENDAR
════════════════════════════════════════════════════════════ */
function renderCalendar() {
  const year      = calendarDate.getFullYear();
  const month     = calendarDate.getMonth();
  const totalDays = daysInMonth(year, month);
  const firstDay  = new Date(year, month, 1).getDay();  /* 0=Sun */
  const today     = todayStr();
  const moodData  = getMoodData();

  let html = `<div class="cal-month-title">${MONTH_NAMES[month]}</div>`;

  /* Day-of-week headers */
  html += '<div class="cal-day-headers">';
  DAY_ABBRS.forEach(d => { html += `<div class="cal-day-header">${d}</div>`; });
  html += '</div>';

  /* Grid */
  html += '<div class="cal-grid">';

  /* Leading blank cells */
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="cal-day empty"></div>';
  }

  /* Day cells */
  for (let day = 1; day <= totalDays; day++) {
    const dateStr  = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const mood     = moodData[dateStr] || null;
    const isToday  = (dateStr === today);

    let classes    = 'cal-day';
    if (isToday)   classes += ' today';

    let moodAttr   = mood ? `data-mood="${mood}"` : '';
    let emoji      = mood ? `<span class="cal-day-emoji">${MOODS[mood].emoji}</span>` : '';

    html += `<div class="${classes}" ${moodAttr}>${emoji}<span class="cal-day-num">${day}</span></div>`;
  }

  html += '</div>';

  document.getElementById('calendar-body').innerHTML = html;
}

function initCalendar() {
  /* Month navigation */
  document.getElementById('cal-prev').addEventListener('click', () => {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
    renderCalendar();
  });

  document.getElementById('cal-next').addEventListener('click', () => {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
    renderCalendar();
  });

  /* Toolbar buttons */
  document.getElementById('tb-pencil-cal').addEventListener('click', () => {
    showScreen('screen-mood-select', refreshDateDisplay);
  });

  document.getElementById('tb-cal-to-tracker').addEventListener('click', () => {
    trackerYear = new Date().getFullYear();
    showScreen('screen-tracker', renderTracker);
  });
}

/* ════════════════════════════════════════════════════════════
   SCREEN 9  ·  YEARLY TRACKER
════════════════════════════════════════════════════════════ */
function renderTracker() {
  const moodData = getMoodData();
  const today    = todayStr();

  let html = `<div class="tracker-year-title">${trackerYear}</div>`;

  /* Month column headers */
  html += '<div class="tracker-month-headers">';
  MONTH_ABBRS.forEach(m => { html += `<div class="tracker-month-header">${m}</div>`; });
  html += '</div>';

  /* 31 rows × 12 columns */
  html += '<div class="tracker-grid">';

  for (let day = 1; day <= 31; day++) {
    for (let month = 0; month < 12; month++) {
      const maxDays = daysInMonth(trackerYear, month);

      if (day > maxDays) {
        /* Month doesn't have this many days — filler cell */
        html += '<div class="tracker-cell no-day"></div>';
      } else {
        const dateStr  = `${trackerYear}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const mood     = moodData[dateStr] || null;
        const isToday  = (dateStr === today);

        let moodAttr   = mood ? `data-mood="${mood}"` : '';
        let classes    = 'tracker-cell' + (isToday ? ' today-cell' : '');

        html += `<div class="${classes}" ${moodAttr}></div>`;
      }
    }
  }

  html += '</div>';

  document.getElementById('tracker-body').innerHTML = html;
}

function initTracker() {
  /* Year navigation */
  document.getElementById('yr-prev').addEventListener('click', () => {
    trackerYear--;
    renderTracker();
  });

  document.getElementById('yr-next').addEventListener('click', () => {
    trackerYear++;
    renderTracker();
  });

  /* Toolbar buttons */
  document.getElementById('tb-pencil-tracker').addEventListener('click', () => {
    showScreen('screen-mood-select', refreshDateDisplay);
  });

  document.getElementById('tb-tracker-to-cal').addEventListener('click', () => {
    calendarDate = new Date();
    showScreen('screen-calendar', renderCalendar);
  });
}

/* ════════════════════════════════════════════════════════════
   BOOT
════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initMoodButtons();
  initMoodScreens();
  initCalendar();
  initTracker();
  initWelcome();

  /* Update the date display immediately so it's ready when the
     welcome screen fades out and mood-select fades in */
  refreshDateDisplay();
});
