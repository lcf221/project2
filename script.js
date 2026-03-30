/* ════════════════════════════════════════════════════════════
   BloomBuddy  ·  script.js
   ────────────────────────────────────────────────────────────
   Flow:
     Welcome (wink → BloomBuddy → welcome text → Mood Selection) →
     Mood Screen (Grow once + 1 s hold) → Monthly Calendar  ←→  Yearly Tracker
════════════════════════════════════════════════════════════ */

/* Set to true while adjusting mood-select face positions */
const SHOW_DEBUG = false;

/* After Grow finishes, stay on the last frame this long before the calendar */
const MOOD_GROW_HOLD_AFTER_MS = 500;

/* Safety net if Lottie “complete” never fires */
const MOOD_GROW_FALLBACK_MS = 60000;

/** Mood select: frozen still (json3) + wiggle layer (face-tilt) per button */
const moodSelectStillLottieByBtn  = new WeakMap();
const moodSelectWiggleLottieByBtn = new WeakMap();

/* ════════════════════════════════════════════════════════════
   LOTTIE  ·  two animation sets
   ─────────────────────────────────────────────────────────
   Animation data is loaded via <script> tags as global
   variables (assets/js/anim/*.js), so this works with both
   file:// and http:// with zero async/fetch complexity.

   FACE TILT   → mood-select wiggle on hover (LOTTIE_FACE_*)
   FACE STILL  → mood-select idle pose (LOTTIE_FACE_STILL_* from json3)
   GROUND SWAY → calendar cells   (globals: LOTTIE_SWAY_*)
   GROW        → mood pages       (globals: LOTTIE_GROW_*)
════════════════════════════════════════════════════════════ */

/* Maps mood key → pre-loaded global variable */
const FACE_TILT_MAP = {
  happy:    () => window.LOTTIE_FACE_HAPPY,
  sad:      () => window.LOTTIE_FACE_SAD,
  meh:      () => window.LOTTIE_FACE_MEH,
  stressed: () => window.LOTTIE_FACE_STRESSED,
  angry:    () => window.LOTTIE_FACE_ANGRY,
};

const FACE_STILL_MAP = {
  happy:    () => window.LOTTIE_FACE_STILL_HAPPY,
  sad:      () => window.LOTTIE_FACE_STILL_SAD,
  meh:      () => window.LOTTIE_FACE_STILL_MEH,
  stressed: () => window.LOTTIE_FACE_STILL_STRESSED,
  angry:    () => window.LOTTIE_FACE_STILL_ANGRY,
};

const GROUND_SWAY_MAP = {
  happy:    () => window.LOTTIE_SWAY_HAPPY,
  sad:      () => window.LOTTIE_SWAY_SAD,
  meh:      () => window.LOTTIE_SWAY_MEH,
  stressed: () => window.LOTTIE_SWAY_STRESSED,
  angry:    () => window.LOTTIE_SWAY_ANGRY,
};

const GROW_MAP = {
  happy:    () => window.LOTTIE_GROW_HAPPY,
  sad:      () => window.LOTTIE_GROW_SAD,
  meh:      () => window.LOTTIE_GROW_MEH,
  stressed: () => window.LOTTIE_GROW_STRESSED,
  angry:    () => window.LOTTIE_GROW_ANGRY,
};

let welcomeWinkAnim     = null;
let welcomeSequenceDone = false;
let calLottieInstances  = [];
let moodGrowAnim        = null;
let moodFallbackTimer   = null;
let moodAfterGrowTimer  = null;

/** Hold on last wink frame + visible welcomeback.svg before mood-select */
const WELCOME_HOLD_AFTER_MS = 2500;
/** BloomBuddy at bottom fades in, then welcome-back art */
const WELCOME_BRAND_BEFORE_TEXT_MS = 480;

function finishWelcomeIntro() {
  if (welcomeSequenceDone) return;
  welcomeSequenceDone = true;

  if (welcomeWinkAnim) {
    const last = Math.max(0, welcomeWinkAnim.totalFrames - 1);
    try {
      welcomeWinkAnim.goToAndStop(last, true);
    } catch (e) { /* ignore */ }
    try {
      if (typeof welcomeWinkAnim.resize === 'function') welcomeWinkAnim.resize();
    } catch (e) { /* ignore */ }
  }

  const brand = document.getElementById('welcome-brand');
  if (brand) {
    brand.classList.add('is-visible');
    brand.setAttribute('aria-hidden', 'false');
  }

  setTimeout(() => {
    const textWrap = document.getElementById('welcome-text-wrap');
    if (textWrap) {
      textWrap.classList.add('is-visible');
      textWrap.setAttribute('aria-hidden', 'false');
    }

    setTimeout(() => {
      showScreen('screen-mood-select', refreshDateDisplay);
    }, WELCOME_HOLD_AFTER_MS);
  }, WELCOME_BRAND_BEFORE_TEXT_MS);
}

function initWelcomeWink() {
  welcomeSequenceDone = false;
  const brand = document.getElementById('welcome-brand');
  if (brand) {
    brand.classList.remove('is-visible');
    brand.setAttribute('aria-hidden', 'true');
  }
  const textWrapReset = document.getElementById('welcome-text-wrap');
  if (textWrapReset) {
    textWrapReset.classList.remove('is-visible');
    textWrapReset.setAttribute('aria-hidden', 'true');
  }
  const host = document.getElementById('welcome-wink');
  if (!host || typeof lottie === 'undefined') {
    finishWelcomeIntro();
    return;
  }

  welcomeWinkAnim = lottie.loadAnimation({
    container: host,
    renderer: 'svg',
    loop:      false,
    autoplay:  true,
    path:      'assets/wink.json',
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid meet',
    },
  });

  welcomeWinkAnim.addEventListener('complete', finishWelcomeIntro, { once: true });
  welcomeWinkAnim.addEventListener('DOMLoaded', () => {
    if (welcomeWinkAnim && typeof welcomeWinkAnim.resize === 'function') {
      welcomeWinkAnim.resize();
    }
  }, { once: true });

  /* If load or complete fails */
  setTimeout(() => {
    if (!welcomeSequenceDone) finishWelcomeIntro();
  }, 12000);
}

/* ── Calendar cells (Ground Sway) ───────────────────────── */
function destroyCalLottie() {
  calLottieInstances.forEach(anim => anim.destroy());
  calLottieInstances = [];
}

function initCalLottie() {
  document.querySelectorAll('#calendar-body .cal-day-lottie').forEach(el => {
    const mood = el.dataset.lottieMood;
    const data = GROUND_SWAY_MAP[mood]?.();
    if (!data) return;
    const anim = lottie.loadAnimation({
      container:     el,
      renderer:      'svg',
      loop:          true,
      autoplay:      true,
      animationData: data,
      rendererSettings: {
        preserveAspectRatio: 'xMidYMax meet',
      },
    });
    if (typeof anim.resize === 'function') anim.resize();
    calLottieInstances.push(anim);
  });
  requestAnimationFrame(() => {
    calLottieInstances.forEach(a => {
      if (a && typeof a.resize === 'function') a.resize();
    });
  });
}

/* ─── Mood configuration ───────────────────────────────────
   dayColor      = calendar / tracker page bg + mood-page bg
   toolbarColor  = nav bars + yearly tracker cell fills (grid matches nav)
─────────────────────────────────────────────────────────── */
const MOODS = {
  happy: {
    dayColor:     'rgba(255, 234, 158, 1)',
    toolbarColor: 'rgba(255, 214, 67, 1)',
    emoji:        '🌻',
    label:        'Happy',
    screen:       'screen-happy',
  },
  sad: {
    dayColor:     'rgba(200, 226, 255, 1)',
    toolbarColor: 'rgba(142, 196, 255, 1)',
    emoji:        '🌸',
    label:        'Sad',
    screen:       'screen-sad',
  },
  meh: {
    dayColor:     'rgba(255, 207, 255, 1)',
    toolbarColor: 'rgba(250, 162, 255, 1)',
    emoji:        '🌿',
    label:        'Meh',
    screen:       'screen-meh',
  },
  stressed: {
    dayColor:     'rgba(255, 196, 174, 1)',
    toolbarColor: 'rgba(255, 142, 98, 1)',
    emoji:        '🌺',
    label:        'Stressed',
    screen:       'screen-stressed',
  },
  angry: {
    dayColor:     'rgba(196, 255, 186, 1)',
    toolbarColor: 'rgba(147, 239, 118, 1)',
    emoji:        '🌵',
    label:        'Angry',
    screen:       'screen-angry',
  },
};

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const MONTH_ABBRS  = ['J','F','M','A','M','J','J','A','S','O','N','D'];

/* ─── State ──────────────────────────────────────────────── */
let currentMood   = null;
let calendarDate  = new Date();   // month currently shown in calendar

/* ════════════════════════════════════════════════════════════
   DATA  –  localStorage helpers  (+ optional cloud sync in assets/js/sync.js)
════════════════════════════════════════════════════════════ */
window.BloomBuddy = window.BloomBuddy || { onMoodSaved: null };

function getMoodData() {
  try { return JSON.parse(localStorage.getItem('moodData') || '{}'); }
  catch { return {}; }
}

function saveMoodForDate(dateStr, mood) {
  const data = getMoodData();
  data[dateStr] = mood;
  try {
    localStorage.setItem('moodData', JSON.stringify(data));
  } catch (e) {
    console.warn('[BloomBuddy] Could not save mood for', dateStr, e);
  }
  try {
    window.BloomBuddy.onMoodSaved?.(dateStr, mood);
  } catch (e) {
    console.warn('[BloomBuddy] sync hook', e);
  }
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

/** Stable “demo” mood for a date (same string → same mood every time). Never overwrites real user picks. */
function demoMoodForDate(dateStr) {
  const moodKeys = Object.keys(MOODS);
  if (moodKeys.length === 0) return null;
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = ((h << 5) - h) + dateStr.charCodeAt(i);
    h |= 0;
  }
  return moodKeys[Math.abs(h) % moodKeys.length];
}

/**
 * Fill Jan 1 → yesterday (current year) with demo moods only where no entry exists — persists once.
 * Skips today so today is never auto-filled; only selectMood() writes today’s real pick.
 */
function seedMissingMoodsYearToDate() {
  const data = getMoodData();
  const moodKeys = Object.keys(MOODS);
  if (moodKeys.length === 0) return;

  const now = new Date();
  const year = now.getFullYear();
  const today = todayStr();
  const end = new Date(year, now.getMonth(), now.getDate());
  const cursor = new Date(year, 0, 1);
  let changed = false;

  while (cursor <= end) {
    const dateStr = formatDateStr(cursor);
    if (dateStr === today) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }
    if (!data[dateStr]) {
      data[dateStr] = demoMoodForDate(dateStr);
      changed = true;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  if (changed) {
    try {
      localStorage.setItem('moodData', JSON.stringify(data));
    } catch (e) {
      console.warn('[BloomBuddy] Could not save moodData', e);
    }
  }
}

/* ════════════════════════════════════════════════════════════
   SCREEN NAVIGATION
════════════════════════════════════════════════════════════ */
function showScreen(id, afterShow) {
  /* Mood-tinted screens: set inline colors before .active so first paint matches (no cream/yellow flash) */
  if (id === 'screen-calendar' || id === 'screen-tracker') {
    applyTodayMoodThemeToCalAndTracker();
  }
  document.querySelectorAll('.screen.active').forEach(s => s.classList.remove('active'));
  const next = document.getElementById(id);
  if (!next) return;
  next.classList.add('active');
  /* Face Lotties must init after this screen is visible — opacity:0 during welcome blocks first paint */
  if (id === 'screen-mood-select') prepareMoodSelectFacesVisible();
  if (!afterShow) return;
  /* Calendar / year: run in same turn so the grid exists before paint (50ms delay caused empty / glitchy frame) */
  if (id === 'screen-calendar' || id === 'screen-tracker') {
    afterShow();
  } else {
    setTimeout(afterShow, 50);
  }
}

/* ════════════════════════════════════════════════════════════
   SCREEN 1  ·  WELCOME  (see initWelcomeWink)
════════════════════════════════════════════════════════════ */

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

  const ms = document.getElementById('screen-mood-select');
  if (ms?.classList.contains('active')) {
    resetMoodSelectLottiesToStill();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => syncMoodSelectFaceFrames());
    });
  }
}

/** Pause and show frame 0 — the “frozen face” until hover plays the loop. */
function freezeMoodFaceLottie(anim) {
  if (!anim) return;
  anim.pause();
  anim.goToAndStop(0, true);
}

/** Resize + seek frame 0 (call after layout when the mood screen is visible). */
function syncMoodSelectFaceFrames() {
  if (typeof lottie === 'undefined') return;
  document.querySelectorAll('#screen-mood-select .mood-face-btn').forEach(btn => {
    const still = moodSelectStillLottieByBtn.get(btn);
    if (still) {
      try {
        if (typeof still.resize === 'function') still.resize();
      } catch (e) { /* ignore */ }
      freezeMoodFaceLottie(still);
    }
    const wig = moodSelectWiggleLottieByBtn.get(btn);
    if (wig) {
      try {
        if (typeof wig.resize === 'function') wig.resize();
      } catch (e) { /* ignore */ }
      freezeMoodFaceLottie(wig);
    }
  });
}

/**
 * Run when #screen-mood-select becomes .active (not during welcome).
 * Lottie’s first frame often does not paint if the parent had opacity:0 at load time.
 */
function prepareMoodSelectFacesVisible() {
  if (typeof lottie === 'undefined') return;
  document.querySelectorAll('#screen-mood-select .mood-face-btn').forEach(btn => {
    ensureMoodSelectStill(btn);
    /* Wiggle also mounted (paused at 0, hidden) so first hover has no empty flash */
    ensureMoodSelectWiggle(btn);
  });
  requestAnimationFrame(() => {
    requestAnimationFrame(() => syncMoodSelectFaceFrames());
  });
  setTimeout(syncMoodSelectFaceFrames, 0);
  setTimeout(syncMoodSelectFaceFrames, 48);
  setTimeout(syncMoodSelectFaceFrames, 160);
}

function mountMoodSelectLottie(host, data, weakMap, btn) {
  if (!host || !data || typeof lottie === 'undefined') return null;
  const anim = lottie.loadAnimation({
    container:     host,
    renderer:      'svg',
    loop:          true,
    autoplay:      false,
    animationData: data,
  });
  weakMap.set(btn, anim);
  const snap = () => freezeMoodFaceLottie(anim);
  anim.addEventListener('DOMLoaded', snap, { once: true });
  anim.addEventListener('data_ready', snap, { once: true });
  queueMicrotask(snap);
  return anim;
}

/** Idle face: assets/json3 still JSON (same layout as wiggle art). */
function ensureMoodSelectStill(btn) {
  const existing = moodSelectStillLottieByBtn.get(btn);
  if (existing) {
    freezeMoodFaceLottie(existing);
    return existing;
  }
  const mood = btn.dataset.mood;
  const host = btn.querySelector('.mood-face-still');
  const data = mood && FACE_STILL_MAP[mood]?.();
  return mountMoodSelectLottie(host, data, moodSelectStillLottieByBtn, btn);
}

/** Wiggle / tilt loop — only while .is-ms-wiggle (hover). */
function ensureMoodSelectWiggle(btn) {
  const existing = moodSelectWiggleLottieByBtn.get(btn);
  if (existing) {
    freezeMoodFaceLottie(existing);
    return existing;
  }
  const mood = btn.dataset.mood;
  const host = btn.querySelector('.mood-face-wiggle');
  const data = mood && FACE_TILT_MAP[mood]?.();
  return mountMoodSelectLottie(host, data, moodSelectWiggleLottieByBtn, btn);
}

/** Pause still + wiggle; hide wiggle layer. */
function resetMoodSelectLottiesToStill() {
  document.querySelectorAll('#screen-mood-select .mood-face-btn').forEach(btn => {
    btn.classList.remove('is-ms-wiggle');
    freezeMoodFaceLottie(moodSelectStillLottieByBtn.get(btn));
    const wig = moodSelectWiggleLottieByBtn.get(btn);
    if (wig) {
      wig.pause();
      wig.goToAndStop(0, true);
    }
  });
}

function playMoodSelectHover(btn) {
  const w = ensureMoodSelectWiggle(btn);
  if (!w) return;
  w.goToAndStop(0, true);
  requestAnimationFrame(() => {
    btn.classList.add('is-ms-wiggle');
    w.play();
  });
}

function stopMoodSelectHover(btn) {
  btn.classList.remove('is-ms-wiggle');
  const wig = moodSelectWiggleLottieByBtn.get(btn);
  if (wig) {
    wig.pause();
    wig.goToAndStop(0, true);
  }
  const st = moodSelectStillLottieByBtn.get(btn);
  if (st) {
    try {
      if (typeof st.resize === 'function') st.resize();
    } catch (e) { /* ignore */ }
    freezeMoodFaceLottie(st);
  }
}

function initMoodButtons() {
  if (SHOW_DEBUG) {
    document.querySelectorAll('.mood-face-btn').forEach(b => {
      b.style.outline = '2px solid red';
      b.style.background = 'rgba(255,0,0,0.08)';
    });
  }

  const canFineHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  document.querySelectorAll('.mood-face-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mood = btn.dataset.mood;
      if (mood) selectMood(mood);
    });

    if (canFineHover) {
      btn.addEventListener('mouseenter', () => playMoodSelectHover(btn));
      btn.addEventListener('mouseleave', () => stopMoodSelectHover(btn));
    } else {
      /* Phones / coarse pointers: show tilt while finger is down */
      btn.addEventListener('touchstart', () => playMoodSelectHover(btn), { passive: true });
      btn.addEventListener('touchcancel', () => stopMoodSelectHover(btn), { passive: true });
      btn.addEventListener('touchend', () => {
        setTimeout(() => stopMoodSelectHover(btn), 420);
      }, { passive: true });
    }

    /* Keyboard focus — same as hover */
    btn.addEventListener('focus', () => playMoodSelectHover(btn));
    btn.addEventListener('blur', () => stopMoodSelectHover(btn));
  });
}

function selectMood(mood) {
  currentMood = mood;
  saveMoodForDate(todayStr(), mood);

  document.querySelectorAll('.mood-screen').forEach(el => el.classList.remove('screen--instant'));

  showScreen(MOODS[mood].screen, () => {
    startMoodGrow(mood);
  });
}

/* ════════════════════════════════════════════════════════════
   SCREENS 3–7  ·  INDIVIDUAL MOOD SCREENS  (Grow, then short hold)
════════════════════════════════════════════════════════════ */
function clearMoodGrowTimers() {
  if (moodFallbackTimer) {
    clearTimeout(moodFallbackTimer);
    moodFallbackTimer = null;
  }
  if (moodAfterGrowTimer) {
    clearTimeout(moodAfterGrowTimer);
    moodAfterGrowTimer = null;
  }
}

function destroyMoodGrow() {
  if (moodGrowAnim) {
    moodGrowAnim.destroy();
    moodGrowAnim = null;
  }
}

/** Full Grow once (loop: false), hold last frame MOOD_GROW_HOLD_AFTER_MS, then calendar. */
function startMoodGrow(mood) {
  destroyMoodGrow();
  clearMoodGrowTimers();

  const screenId = MOODS[mood]?.screen;
  if (!screenId || typeof lottie === 'undefined') {
    navigateToCalendar();
    return;
  }

  const growWrap = document.querySelector(`#${screenId} .mood-grow-lottie`);
  const growHost = growWrap?.querySelector('.mood-grow-inner');
  const growData = GROW_MAP[mood]?.();

  if (!growWrap || !growHost || !growData) {
    navigateToCalendar();
    return;
  }

  moodFallbackTimer = setTimeout(() => {
    console.warn('[Mood] Grow fallback timeout — advancing to calendar');
    navigateToCalendar();
  }, MOOD_GROW_FALLBACK_MS);

  moodGrowAnim = lottie.loadAnimation({
    container:     growHost,
    renderer:      'svg',
    loop:          false,
    autoplay:      true,
    animationData: growData,
    rendererSettings: {
      preserveAspectRatio: 'xMidYMax meet',
    },
  });

  moodGrowAnim.addEventListener('DOMLoaded', () => {
    moodGrowAnim.resize();
  }, { once: true });

  moodGrowAnim.addEventListener('complete', () => {
    moodAfterGrowTimer = setTimeout(() => {
      moodAfterGrowTimer = null;
      navigateToCalendar();
    }, MOOD_GROW_HOLD_AFTER_MS);
  }, { once: true });
}

function navigateToCalendar() {
  clearMoodGrowTimers();
  destroyMoodGrow();
  calendarDate = new Date();
  const cal = document.getElementById('screen-calendar');
  if (cal) cal.classList.add('screen--instant');
  /* Instant-hide grow screen (no 150ms fade) so it doesn’t fight the calendar swap */
  document.querySelectorAll('.mood-screen.active').forEach(el => el.classList.add('screen--instant'));
  /* Build month while still hidden — avoids one frame of empty calendar */
  renderCalendar();
  showScreen('screen-calendar', null);
}

function initMoodScreens() {
  document.querySelectorAll('.mood-screen').forEach(screen => {
    screen.addEventListener('click', navigateToCalendar);
  });
}

/* ════════════════════════════════════════════════════════════
   SCREEN 8  ·  MONTHLY CALENDAR
════════════════════════════════════════════════════════════ */
/** Today’s mood → page + nav pill on both month and year screens (call before .active) */
function applyTodayMoodThemeToCalAndTracker() {
  const today     = todayStr();
  const moodData  = getMoodData();
  const todayMood = moodData[today] || null;
  const pageBg    = (todayMood && MOODS[todayMood])
    ? MOODS[todayMood].dayColor
    : '#FFF5EA';
  const barBg     = (todayMood && MOODS[todayMood]?.toolbarColor)
    ? MOODS[todayMood].toolbarColor
    : '#f0df85';

  const calScreen = document.getElementById('screen-calendar');
  const calBar    = calScreen?.querySelector('.cal-nav-bar');
  if (calScreen) calScreen.style.backgroundColor = pageBg;
  if (calBar) calBar.style.backgroundColor = barBg;

  const trackerScreen = document.getElementById('screen-tracker');
  const trackerBar    = trackerScreen?.querySelector('.cal-nav-bar');
  if (trackerScreen) trackerScreen.style.backgroundColor = pageBg;
  if (trackerBar) trackerBar.style.backgroundColor = barBg;
}

function renderCalendar() {
  /* Tear down any live Lottie animations before wiping the DOM */
  destroyCalLottie();

  const year      = calendarDate.getFullYear();
  const month     = calendarDate.getMonth();
  const totalDays = daysInMonth(year, month);
  const firstDay  = new Date(year, month, 1).getDay();  /* 0=Sun */
  const today     = todayStr();
  const moodData  = getMoodData();

  applyTodayMoodThemeToCalAndTracker();

  let html = `<div class="cal-month-title">${MONTH_NAMES[month]}</div>`;

  /* Grid — rows of 7; dirt.svg mound + sway Lottie behind it when logged (no weekday row) */
  html += '<div class="cal-grid">';

  /* Leading padding cells */
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="cal-day cal-day--pad" aria-hidden="true"></div>';
  }

  /* Day cells */
  for (let day = 1; day <= totalDays; day++) {
    const dateStr  = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const mood     = moodData[dateStr] || null;
    const isToday  = (dateStr === today);

    let classes  = 'cal-day';
    if (isToday) classes += ' today';

    let moodAttr = mood ? `data-mood="${mood}"` : '';

    let moundBack = '';
    if (mood) {
      if (GROUND_SWAY_MAP[mood]?.()) {
        moundBack = `<div class="cal-day-lottie" data-lottie-mood="${mood}"></div>`;
      } else {
        moundBack = `<span class="cal-day-emoji">${MOODS[mood].emoji}</span>`;
      }
    }

    html += `<div class="${classes}" ${moodAttr}>
      <div class="cal-day-stack">
        <div class="cal-day-plant" aria-hidden="true"></div>
        <div class="cal-day-mound">
          ${moundBack ? `<div class="cal-day-mound-back">${moundBack}</div>` : ''}
          <img class="cal-day-dirt" src="assets/dirt.svg" alt="" width="196" height="182" decoding="async">
        </div>
        <span class="cal-day-num">${day}</span>
      </div>
    </div>`;
  }

  html += '</div>';

  document.getElementById('calendar-body').innerHTML = html;

  initCalLottie();

  requestAnimationFrame(() => {
    document.getElementById('screen-calendar')?.classList.remove('screen--instant');
  });
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

  document.getElementById('tb-flower-cal').addEventListener('click', () => {
    showScreen('screen-mood-select', refreshDateDisplay);
  });

  document.getElementById('tb-cal-to-tracker').addEventListener('click', () => {
    showScreen('screen-tracker', renderTracker);
  });
}

/* ════════════════════════════════════════════════════════════
   SCREEN 9  ·  YEARLY TRACKER
════════════════════════════════════════════════════════════ */
function renderTracker() {
  const moodData = getMoodData();
  const today    = todayStr();
  const year       = new Date().getFullYear(); /* single-year view */

  applyTodayMoodThemeToCalAndTracker();

  let html = '<div class="tracker-sheet">';

  /* Top row: corner + J F M A M J J A S O N D */
  html += '<div class="tracker-data-row tracker-data-row--header">';
  html += '<div class="tracker-corner" aria-hidden="true"></div>';
  MONTH_ABBRS.forEach(m => {
    html += `<div class="tracker-month-header">${m}</div>`;
  });
  html += '</div>';

  /* Rows 1–31: day label + 12 cells */
  for (let day = 1; day <= 31; day++) {
    html += '<div class="tracker-data-row">';
    html += `<div class="tracker-day-label">${day}</div>`;

    for (let month = 0; month < 12; month++) {
      const maxDays = daysInMonth(year, month);

      if (day > maxDays) {
        html += '<div class="tracker-cell no-day"></div>';
      } else {
        const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const mood    = moodData[dateStr] || null;
        const isToday = (dateStr === today);

        let moodAttr = mood ? `data-mood="${mood}"` : '';
        let classes  = 'tracker-cell' + (isToday ? ' today-cell' : '');
        const barFill  = mood && MOODS[mood]?.toolbarColor
          ? ` style="background-color:${MOODS[mood].toolbarColor}"`
          : '';

        html += `<div class="${classes}" ${moodAttr}${barFill}></div>`;
      }
    }
    html += '</div>';
  }

  html += '</div>';

  document.getElementById('tracker-body').innerHTML = html;
}

function initTracker() {
  /* Arrows: open month calendar on previous / next month */
  document.getElementById('yr-prev').addEventListener('click', () => {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
    showScreen('screen-calendar', renderCalendar);
  });

  document.getElementById('yr-next').addEventListener('click', () => {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
    showScreen('screen-calendar', renderCalendar);
  });

  document.getElementById('tb-flower-tracker').addEventListener('click', () => {
    showScreen('screen-mood-select', refreshDateDisplay);
  });

  document.getElementById('tb-tracker-to-cal').addEventListener('click', () => {
    calendarDate = new Date();
    showScreen('screen-calendar', renderCalendar);
  });
}

/** After cloud pull — re-seed demo gaps, refresh tints, redraw visible cal/tracker */
function refreshMoodViewsAfterSync() {
  seedMissingMoodsYearToDate();
  applyTodayMoodThemeToCalAndTracker();
  if (document.getElementById('screen-calendar')?.classList.contains('active')) renderCalendar();
  if (document.getElementById('screen-tracker')?.classList.contains('active')) renderTracker();
}

window.BloomBuddy.refreshMoodViewsAfterSync = refreshMoodViewsAfterSync;
window.BloomBuddy.getMoodData = getMoodData;

/* ════════════════════════════════════════════════════════════
   BOOT
════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  seedMissingMoodsYearToDate();

  /* Prime hidden cal/tracker so inline mood colors aren’t only CSS defaults before first visit */
  applyTodayMoodThemeToCalAndTracker();

  initMoodButtons();
  initMoodScreens();
  initCalendar();
  initTracker();

  /* Update the date display immediately so it's ready when the
     welcome screen fades out and mood-select fades in */
  refreshDateDisplay();

  initWelcomeWink();

  import('./assets/js/sync.js')
    .then(m => m.initBloomSync?.())
    .catch(() => { /* optional module / no config */ });
});
