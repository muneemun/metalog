/**
 * MetaLog (메타로그) - Core Application Logic
 * Supports: LocalStorage, Firebase Firestore real-time sync, PWA, Modes (학습 모드, 체크 모드)
 */

(() => {
  // --- Constants & Storage Keys ---
  const STORAGE_KEYS = {
    TASKS: 'metalog_tasks_v1',
    MODE: 'metalog_current_mode',
    SUPPORTER: 'metalog_current_supporter',
    FIREBASE_CONFIG: 'metalog_firebase_config',
    SIMULATED_DATE: 'metalog_simulated_date',
    ACTIVE_TAB: 'metalog_active_tab',
    CALENDAR_MONTH: 'metalog_calendar_month'
  };

  const DEFAULT_START_DATE = '2026-11-30';
  const DEFAULT_END_DATE = '2027-01-31';

  // --- State ---
  let tasks = [];
  let currentMode = localStorage.getItem(STORAGE_KEYS.MODE) || 'study'; // 'study' | 'check'
  let currentSupporter = localStorage.getItem(STORAGE_KEYS.SUPPORTER) || '서포터 1'; // '서포터 1' | '서포터 2'
  let activeTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB) || 'calendar'; // 'calendar' | 'weekly' | 'metacognition' | 'roadmap'
  let currentWeeklyWeek = 1; // 1..9
  let metaFilter = 'all'; // 'all' | 'red' | 'yellow' | 'green' | 'academy'
  let roadmapWeekFilter = 'all'; // 'all' | 1..9
  let selectedDate = DEFAULT_START_DATE;
  let simulatedDate = localStorage.getItem(STORAGE_KEYS.SIMULATED_DATE) || null;
  let currentCalendarMonth = new Date(2026, 11, 1); // December 2026 default

  // Firebase state
  let db = null;
  let unsubscribeSnapshot = null;
  let isCloudSyncing = false;

  // --- Utility Functions ---
  const getTodayDateStr = () => {
    if (simulatedDate) return simulatedDate;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const formatDateKr = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
  };

  const getDayDiff = (dateStr1, dateStr2) => {
    const d1 = new Date(dateStr1);
    const d2 = new Date(dateStr2);
    const diffTime = d2.getTime() - d1.getTime();
    return Math.round(diffTime / (1000 * 3600 * 24));
  };

  // --- Initialization ---
  function initApp() {
    loadLocalTasks();
    initCalendarMonth();
    initFirebaseIfConfigured();
    setupEventListeners();
    registerServiceWorker();
    renderAll();
  }

  function initCalendarMonth() {
    const today = getTodayDateStr();
    selectedDate = today;
    const [y, m] = today.split('-').map(Number);
    // If today is in Nov 2026, Dec 2026, or Jan 2027, show that month
    if (y === 2026 && (m === 11 || m === 12)) {
      currentCalendarMonth = new Date(y, m - 1, 1);
    } else if (y === 2027 && m === 1) {
      currentCalendarMonth = new Date(2027, 0, 1);
    } else {
      currentCalendarMonth = new Date(2026, 11, 1); // 2026 Dec
      selectedDate = DEFAULT_START_DATE;
    }
  }

  function loadLocalTasks() {
    const saved = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (saved) {
      try {
        tasks = JSON.parse(saved);
        // Backfill pageRange and pageCount from INITIAL_CURRICULUM if missing
        if (window.INITIAL_CURRICULUM && Array.isArray(window.INITIAL_CURRICULUM)) {
          const initMap = {};
          window.INITIAL_CURRICULUM.forEach(it => { initMap[it.id] = it; });
          let updated = false;
          tasks.forEach(t => {
            if (initMap[t.id]) {
              if (!t.pageRange && initMap[t.id].pageRange) {
                t.pageRange = initMap[t.id].pageRange;
                updated = true;
              }
              if (t.pageCount === undefined && initMap[t.id].pageCount !== undefined) {
                t.pageCount = initMap[t.id].pageCount;
                updated = true;
              }
            }
          });
          if (updated) saveTasksLocally();
        }
        return;
      } catch (e) {
        console.error('Error parsing stored tasks, resetting to initial', e);
      }
    }
    // Load from window.INITIAL_CURRICULUM
    if (window.INITIAL_CURRICULUM && Array.isArray(window.INITIAL_CURRICULUM)) {
      tasks = JSON.parse(JSON.stringify(window.INITIAL_CURRICULUM));
      saveTasksLocally();
    }
  }

  function saveTasksLocally() {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  }

  function saveAndSyncTasks() {
    saveTasksLocally();
    if (db && !isCloudSyncing) {
      pushToCloud();
    }
    renderAll();
  }

  // --- Firebase Cloud Sync ---
  function initFirebaseIfConfigured() {
    const rawConfig = localStorage.getItem(STORAGE_KEYS.FIREBASE_CONFIG);
    if (!rawConfig) {
      updateSyncStatusUI('local');
      return;
    }

    try {
      const config = JSON.parse(rawConfig);
      if (!config.apiKey || !config.projectId) {
        updateSyncStatusUI('local');
        return;
      }

      updateSyncStatusUI('connecting');

      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }
      db = firebase.firestore();

      // Listen to real-time changes
      const docRef = db.collection('metalog_family').doc('shared_curriculum');

      if (unsubscribeSnapshot) unsubscribeSnapshot();

      unsubscribeSnapshot = docRef.onSnapshot((doc) => {
        if (doc.exists) {
          const remoteData = doc.data();
          if (remoteData && Array.isArray(remoteData.tasks)) {
            isCloudSyncing = true;
            tasks = remoteData.tasks;
            saveTasksLocally();
            renderAll();
            isCloudSyncing = false;
            updateSyncStatusUI('synced');
          }
        } else {
          // Document doesn't exist yet, push current local tasks
          pushToCloud();
          updateSyncStatusUI('synced');
        }
      }, (err) => {
        console.error('Firestore snapshot error:', err);
        updateSyncStatusUI('error', err.message);
      });

    } catch (e) {
      console.error('Firebase init error:', e);
      updateSyncStatusUI('error', e.message);
    }
  }

  function pushToCloud() {
    if (!db) return;
    updateSyncStatusUI('connecting');
    db.collection('metalog_family').doc('shared_curriculum').set({
      tasks: tasks,
      lastUpdated: new Date().toISOString(),
      updatedBy: currentMode === 'study' ? '학습자' : currentSupporter
    }, { merge: true })
    .then(() => {
      updateSyncStatusUI('synced');
    })
    .catch((err) => {
      console.error('Firestore push error:', err);
      updateSyncStatusUI('error', err.message);
    });
  }

  function updateSyncStatusUI(status, message = '') {
    const badge = document.getElementById('cloud-sync-badge');
    const statusText = document.getElementById('cloud-sync-text');
    const dot = document.getElementById('cloud-sync-dot');

    if (!badge || !statusText || !dot) return;

    if (status === 'synced') {
      badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm cursor-pointer hover:bg-emerald-100 transition-colors';
      dot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
      statusText.textContent = '클라우드 실시간 동기화';
    } else if (status === 'connecting') {
      badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 shadow-sm cursor-pointer hover:bg-amber-100 transition-colors';
      dot.className = 'w-2 h-2 rounded-full bg-amber-500 animate-ping';
      statusText.textContent = '동기화 연결 중...';
    } else if (status === 'error') {
      badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 shadow-sm cursor-pointer hover:bg-rose-100 transition-colors';
      dot.className = 'w-2 h-2 rounded-full bg-rose-500';
      statusText.textContent = '동기화 오류';
    } else {
      // Local
      badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-200 transition-colors';
      dot.className = 'w-2 h-2 rounded-full bg-slate-400';
      statusText.textContent = '로컬 저장 모드';
    }
  }

  // --- Motivational Study Wisdom Quotes for 예비고1 ---
  const STUDY_QUOTES = [
    "🌱 완벽한 이해보다 중요한 것은 매일의 작은 꾸준함이에요.",
    "💡 개념을 남에게 설명하듯 백지에 적어볼 때 진짜 내 지식이 됩니다.",
    "✨ 틀린 문제는 내 약점을 보완할 가장 값진 보물이에요.",
    "🚀 고등학교 첫 학기, 지금 쌓아가는 기초가 가장 든든한 날개가 될 거예요.",
    "🎯 헷갈리는 부분(🔴)을 솔직하게 마주하는 것이 메타인지의 가장 멋진 시작입니다.",
    "🌈 조급해하지 말고 나만의 페이스대로 한 단원씩 정복해 나가요.",
    "💪 질문이 생겼다는 건 그만큼 깊이 고민하고 성장했다는 증거예요.",
    "🍀 오늘의 1시간 집중이 63일 뒤 놀라운 자신감으로 돌아올 거예요."
  ];

  function getDailyQuote() {
    const today = getTodayDateStr();
    const diff = Math.abs(getDayDiff(DEFAULT_START_DATE, today));
    return STUDY_QUOTES[diff % STUDY_QUOTES.length];
  }

  // --- Mode Switcher (학습 모드 / 체크 모드) ---
  window.setMode = function(mode) {
    currentMode = mode;
    localStorage.setItem(STORAGE_KEYS.MODE, mode);
    renderModeSwitcher();
    renderHeroBanner();
    renderDailyCards();
  };
  window.setRole = window.setMode; // Backward compatibility alias

  window.setSupporter = function(supporterName) {
    currentSupporter = supporterName;
    localStorage.setItem(STORAGE_KEYS.SUPPORTER, supporterName);
    renderDailyCards();
  };

  function renderModeSwitcher() {
    const studyBtn = document.getElementById('mode-btn-study');
    const checkBtn = document.getElementById('mode-btn-check');

    if (studyBtn && checkBtn) {
      if (currentMode === 'study') {
        studyBtn.className = 'px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-extrabold bg-purple-600 text-white shadow-xs ring-2 ring-purple-300 flex items-center gap-1.5 transition-all cursor-pointer';
        checkBtn.className = 'px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all flex items-center gap-1.5 cursor-pointer';
      } else {
        checkBtn.className = 'px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-extrabold bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300 flex items-center gap-1.5 transition-all cursor-pointer';
        studyBtn.className = 'px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all flex items-center gap-1.5 cursor-pointer';
      }
    }
  }

  // --- Hero & Progress Calculations ---
  function calculateStats() {
    const regularTasks = tasks.filter(t => !t.isAcademy);
    const totalRegular = regularTasks.length;
    const completedRegular = regularTasks.filter(t => t.status === 'completed').length;
    const totalPercent = totalRegular > 0 ? Math.round((completedRegular / totalRegular) * 100) : 0;

    // Subjects
    const getSubjectStats = (subjName) => {
      const subTasks = tasks.filter(t => t.subject === subjName && !t.isAcademy);
      const total = subTasks.length;
      const completed = subTasks.filter(t => t.status === 'completed').length;
      const redCount = subTasks.filter(t => t.understanding === 'red').length;
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { total, completed, redCount, percent };
    };

    const science = getSubjectStats('통합과학1');
    const history = getSubjectStats('한국사1');
    const society = getSubjectStats('통합사회1');

    // Academies
    const engAcad = tasks.filter(t => t.isAcademy && t.academyType === 'english');
    const engDone = engAcad.filter(t => t.homeworkDone || t.status === 'completed').length;
    const mathAcad = tasks.filter(t => t.isAcademy && t.academyType === 'math');
    const mathDone = mathAcad.filter(t => t.homeworkDone || t.status === 'completed').length;

    // Total Metacognitive lights
    const redTotal = tasks.filter(t => t.understanding === 'red').length;
    const yellowTotal = tasks.filter(t => t.understanding === 'yellow').length;
    const greenTotal = tasks.filter(t => t.understanding === 'green').length;

    // Days & D-Day
    const todayStr = getTodayDateStr();
    const diffFromStart = getDayDiff(DEFAULT_START_DATE, todayStr) + 1;
    const dayProgress = Math.max(1, Math.min(63, diffFromStart));
    const diffToEnd = getDayDiff(todayStr, DEFAULT_END_DATE);
    const dDayText = diffToEnd < 0 ? '완주 완료 🎉' : (diffToEnd === 0 ? 'D-Day (오늘 완주!)' : `D-${diffToEnd}`);

    return {
      totalRegular,
      completedRegular,
      totalPercent,
      science,
      history,
      society,
      engAcadTotal: engAcad.length,
      engDone,
      mathAcadTotal: mathAcad.length,
      mathDone,
      redTotal,
      yellowTotal,
      greenTotal,
      dayProgress,
      dDayText,
      todayStr
    };
  }

  function renderHeroBanner() {
    const stats = calculateStats();
    
    // Greeting & Daily Motivational Study Wisdom
    const greetingEl = document.getElementById('hero-greeting');
    if (greetingEl) {
      greetingEl.innerHTML = `
        <div class="space-y-2">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-base sm:text-lg font-extrabold text-slate-800">예비고1 63일 메타인지 완주</span>
            <span class="text-xs font-bold px-2.5 py-0.5 rounded-full ${currentMode === 'study' ? 'bg-purple-100 text-purple-700 border border-purple-200' : 'bg-indigo-100 text-indigo-700 border border-indigo-200'}">
              ${currentMode === 'study' ? '📖 학습 모드' : '🔍 체크 모드'}
            </span>
          </div>
          <div class="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-purple-900 bg-purple-50/90 border border-purple-200/80 px-3.5 py-2 rounded-2xl shadow-2xs">
            <span class="text-base">💡</span>
            <span class="leading-relaxed">${getDailyQuote()}</span>
          </div>
        </div>
      `;
    }

    // Days & D-Day
    const dayBadge = document.getElementById('hero-day-badge');
    const ddayBadge = document.getElementById('hero-dday-badge');
    if (dayBadge) dayBadge.textContent = `진행 Day ${stats.dayProgress} / 63`;
    if (ddayBadge) ddayBadge.textContent = stats.dDayText;

    // Simulation alert badge
    const simBadge = document.getElementById('hero-sim-badge');
    if (simBadge) {
      if (simulatedDate) {
        simBadge.classList.remove('hidden');
        simBadge.textContent = `🧪 날짜 시뮬레이션: ${simulatedDate}`;
      } else {
        simBadge.classList.add('hidden');
      }
    }

    // Overall Progress Bar
    const totalPercentEl = document.getElementById('hero-total-percent');
    const totalCountEl = document.getElementById('hero-total-count');
    const progressBar = document.getElementById('hero-progress-bar');
    if (totalPercentEl) totalPercentEl.textContent = `${stats.totalPercent}%`;
    if (totalCountEl) totalCountEl.textContent = `${stats.completedRegular} / ${stats.totalRegular} 단원 완료`;
    if (progressBar) progressBar.style.width = `${stats.totalPercent}%`;

    // Subject Cards
    // Science
    const scPercent = document.getElementById('stat-science-percent');
    const scCount = document.getElementById('stat-science-count');
    const scRed = document.getElementById('stat-science-red');
    const scBar = document.getElementById('stat-science-bar');
    if (scPercent) scPercent.textContent = `${stats.science.percent}%`;
    if (scCount) scCount.textContent = `${stats.science.completed} / ${stats.science.total} 완료`;
    if (scRed) scRed.textContent = stats.science.redCount;
    if (scBar) scBar.style.width = `${stats.science.percent}%`;

    // History
    const hiPercent = document.getElementById('stat-history-percent');
    const hiCount = document.getElementById('stat-history-count');
    const hiRed = document.getElementById('stat-history-red');
    const hiBar = document.getElementById('stat-history-bar');
    if (hiPercent) hiPercent.textContent = `${stats.history.percent}%`;
    if (hiCount) hiCount.textContent = `${stats.history.completed} / ${stats.history.total} 완료`;
    if (hiRed) hiRed.textContent = stats.history.redCount;
    if (hiBar) hiBar.style.width = `${stats.history.percent}%`;

    // Society
    const soPercent = document.getElementById('stat-society-percent');
    const soCount = document.getElementById('stat-society-count');
    const soRed = document.getElementById('stat-society-red');
    const soBar = document.getElementById('stat-society-bar');
    if (soPercent) soPercent.textContent = `${stats.society.percent}%`;
    if (soCount) soCount.textContent = `${stats.society.completed} / ${stats.society.total} 완료`;
    if (soRed) soRed.textContent = stats.society.redCount;
    if (soBar) soBar.style.width = `${stats.society.percent}%`;
  }

  // --- Calendar Component ---
  function renderCalendar() {
    const calendarGrid = document.getElementById('calendar-grid');
    const calendarMonthTitle = document.getElementById('calendar-month-title');
    if (!calendarGrid || !calendarMonthTitle) return;

    const year = currentCalendarMonth.getFullYear();
    const month = currentCalendarMonth.getMonth(); // 0-indexed
    calendarMonthTitle.textContent = `${year}년 ${month + 1}월`;

    // Days in current month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay(); // 0 (Sun) to 6 (Sat)
    const daysInMonth = lastDay.getDate();

    let html = '';

    // Empty cells before start of month
    for (let i = 0; i < startDayOfWeek; i++) {
      html += `<div class="min-h-[72px] sm:min-h-[88px] p-1 bg-slate-50/50 rounded-lg border border-transparent opacity-30"></div>`;
    }

    const todayStr = getTodayDateStr();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isSelected = dateStr === selectedDate;
      const isToday = dateStr === todayStr;
      const dayTasks = tasks.filter(t => t.plannedDate === dateStr);
      
      const allDone = dayTasks.length > 0 && dayTasks.every(t => t.status === 'completed');
      const hasRed = dayTasks.some(t => t.understanding === 'red');
      const hasYellow = dayTasks.some(t => t.understanding === 'yellow');

      // Date number color
      const dateObj = new Date(year, month, day);
      const dayOfWeek = dateObj.getDay();
      let dayColorClass = 'text-slate-700';
      if (dayOfWeek === 0) dayColorClass = 'text-rose-500 font-medium'; // Sun
      if (dayOfWeek === 6) dayColorClass = 'text-blue-500 font-medium'; // Sat

      // Cell border / background
      let cellClass = 'relative min-h-[72px] sm:min-h-[92px] p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ';
      if (isSelected) {
        cellClass += 'bg-purple-50/90 border-purple-400 ring-2 ring-purple-300 shadow-sm ';
      } else if (isToday) {
        cellClass += 'bg-amber-50/60 border-amber-300 shadow-xs ';
      } else {
        cellClass += 'bg-white border-slate-100 hover:border-purple-200 hover:bg-slate-50/80 ';
      }

      html += `
        <div class="${cellClass}" onclick="window.selectCalendarDate('${dateStr}')">
          <div class="flex items-center justify-between">
            <span class="text-xs sm:text-sm font-bold ${dayColorClass} ${isToday ? 'w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs' : ''}">
              ${day}
            </span>
            ${allDone ? '<span class="text-emerald-500 text-xs font-bold">✓</span>' : ''}
          </div>
          <div class="mt-1 flex flex-col gap-1 overflow-hidden">
      `;

      // Render dots or mini pills for day tasks
      dayTasks.slice(0, 3).forEach(task => {
        let dotColor = 'bg-slate-400';
        let subjInitial = '학';
        if (task.subject === '통합과학1') {
          dotColor = 'bg-emerald-500';
          subjInitial = '과';
        } else if (task.subject === '한국사1') {
          dotColor = 'bg-amber-500';
          subjInitial = '사';
        } else if (task.subject === '통합사회1') {
          dotColor = 'bg-sky-500';
          subjInitial = '통';
        } else if (task.isAcademy && task.academyType === 'english') {
          dotColor = 'bg-purple-500';
          subjInitial = '영';
        } else if (task.isAcademy && task.academyType === 'math') {
          dotColor = 'bg-rose-500';
          subjInitial = '수';
        } else if (task.isClinic) {
          dotColor = 'bg-fuchsia-500';
          subjInitial = '클';
        }

        const isCompleted = task.status === 'completed';
        const strikethrough = isCompleted ? 'line-through opacity-60' : '';

        html += `
          <div class="flex items-center gap-1 text-[10px] leading-tight truncate">
            <span class="w-1.5 h-1.5 rounded-full ${dotColor} flex-shrink-0"></span>
            <span class="truncate text-slate-600 ${strikethrough}">${task.unit.replace(/^\[.*?\]\s*/, '')}</span>
          </div>
        `;
      });

      if (dayTasks.length > 3) {
        html += `<span class="text-[9px] text-slate-400 font-semibold">+${dayTasks.length - 3}</span>`;
      }

      html += `
          </div>
        </div>
      `;
    }

    calendarGrid.innerHTML = html;
  }

  window.selectCalendarDate = function(dateStr) {
    selectedDate = dateStr;
    renderCalendar();
    renderDailyCards();
  };

  window.changeCalendarMonth = function(delta) {
    currentCalendarMonth = new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() + delta, 1);
    renderCalendar();
  };

  window.goToTodayCalendar = function() {
    const today = getTodayDateStr();
    selectedDate = today;
    const [y, m] = today.split('-').map(Number);
    currentCalendarMonth = new Date(y, m - 1, 1);
    renderCalendar();
    renderDailyCards();
  };

  // --- Daily Cards Component ---
  function renderDailyCards() {
    const container = document.getElementById('daily-tasks-container');
    const headerDate = document.getElementById('daily-header-date');
    const headerInfo = document.getElementById('daily-header-info');

    if (!container || !headerDate) return;

    headerDate.textContent = formatDateKr(selectedDate);

    // Find date metadata
    const sampleTask = tasks.find(t => t.date === selectedDate || t.plannedDate === selectedDate);
    const dayOfWeek = sampleTask ? sampleTask.weekday : ['일','월','화','수','목','금','토'][new Date(selectedDate).getDay()];
    const dayDiff = getDayDiff(DEFAULT_START_DATE, selectedDate) + 1;
    const weekNum = Math.ceil(dayDiff / 7);

    if (headerInfo) {
      if (dayDiff >= 1 && dayDiff <= 63) {
        headerInfo.textContent = `(${dayOfWeek}요일) · ${weekNum}주차 · Day ${dayDiff} / 63`;
      } else {
        headerInfo.textContent = `(${dayOfWeek}요일)`;
      }
    }

    const currentTasks = tasks.filter(t => t.plannedDate === selectedDate);

    if (currentTasks.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <p class="text-slate-500 font-medium">선택한 날짜에 예정된 학습이 없습니다.</p>
          <p class="text-xs text-slate-400 mt-1">상단의 [+ 추가 학습/보충 등록] 버튼을 눌러 새 일정을 추가할 수 있습니다.</p>
        </div>
      `;
      return;
    }

    let modeBanner = '';
    if (currentMode === 'study') {
      modeBanner = `
        <div class="flex items-center justify-between p-3 bg-purple-50/80 rounded-2xl border border-purple-200 text-xs text-purple-900 mb-1">
          <span class="font-bold flex items-center gap-1.5">
            <span>📖</span> 학습 모드
          </span>
          <span class="text-[11px] text-purple-700 font-medium">완료 체크 및 메타인지 신호등(🟢/🟡/🔴)을 기록하세요.</span>
        </div>
      `;
    } else {
      modeBanner = `
        <div class="flex items-center justify-between p-3 bg-indigo-50/80 rounded-2xl border border-indigo-200 text-xs text-indigo-900 mb-1">
          <span class="font-bold flex items-center gap-1.5">
            <span>🔍</span> 체크 모드
          </span>
          <span class="text-[11px] text-indigo-700 font-medium">진도를 점검하고 하단에서 격려 스탬프를 남길 수 있습니다.</span>
        </div>
      `;
    }

    let cardsHtml = modeBanner;

    currentTasks.forEach(task => {
      const isCompleted = task.status === 'completed';
      const isAcademy = task.isAcademy;
      const isClinic = task.isClinic;

      // Badges & Colors
      let subjectBadge = 'bg-slate-100 text-slate-800 border-slate-200';
      if (task.subject === '통합과학1') subjectBadge = 'bg-emerald-100 text-emerald-800 border-emerald-200';
      if (task.subject === '한국사1') subjectBadge = 'bg-amber-100 text-amber-800 border-amber-200';
      if (task.subject === '통합사회1') subjectBadge = 'bg-sky-100 text-sky-800 border-sky-200';
      if (task.subject === '영어학원') subjectBadge = 'bg-purple-100 text-purple-800 border-purple-200';
      if (task.subject === '수학학원') subjectBadge = 'bg-rose-100 text-rose-800 border-rose-200';
      if (isClinic) subjectBadge = 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200';

      // Traffic light state
      const trafficLight = task.understanding; // 'green' | 'yellow' | 'red' | null

      cardsHtml += `
        <div class="bg-white rounded-2xl border ${isCompleted ? 'border-emerald-200 ring-1 ring-emerald-100 shadow-sm' : 'border-slate-200 shadow-sm'} p-4 sm:p-5 transition-all">
          <!-- Top Row: Badges & Reschedule Button -->
          <div class="flex items-start justify-between gap-2">
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="px-2.5 py-0.5 rounded-full text-xs font-bold border ${subjectBadge}">
                ${task.subject}
              </span>
              ${task.pageRange ? `<span class="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">📖 ${task.pageRange}${task.pageCount ? ` (${task.pageCount}p)` : ''}</span>` : ''}
              ${task.chapter ? `<span class="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">${task.chapter}</span>` : ''}
              ${task.rescheduledFrom ? `<span class="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-orange-100 text-orange-700 border border-orange-200">일정 이동됨 (${task.rescheduledFrom})</span>` : ''}
              ${task.completedDate && task.completedDate !== task.plannedDate ? `<span class="px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">완료일: ${task.completedDate}</span>` : ''}
            </div>
            
            <div class="flex items-center gap-1">
              <button onclick="window.openRescheduleModal('${task.id}')" title="일정 이동 / 완료일 수정" class="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors text-xs flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M10 14h4"/><path d="M12 12v4"/></svg>
                <span class="hidden sm:inline">일정 이동</span>
              </button>
            </div>
          </div>

          <!-- Unit Title & Completion Checkbox -->
          <div class="mt-3 flex items-start gap-3">
            <button onclick="window.toggleTaskCompletion('${task.id}')" class="mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors flex-shrink-0 ${isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-purple-400 bg-white'}">
              ${isCompleted ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </button>
            <div class="flex-1">
              <h4 class="text-base sm:text-lg font-bold text-slate-800 ${isCompleted ? 'line-through text-slate-400' : ''}">
                ${task.unit}
              </h4>
              <p class="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                ${task.summary}
              </p>
              ${task.keywords && task.keywords.length > 0 ? `
                <div class="mt-2 flex flex-wrap gap-1">
                  ${task.keywords.map(kw => `<span class="text-[11px] text-purple-600 bg-purple-50/80 px-1.5 py-0.5 rounded font-medium">${kw}</span>`).join('')}
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Academy Specific Field -->
          ${isAcademy ? `
            <div class="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-slate-700 flex items-center gap-1">
                  🏫 학원 진도 & 숙제 기록
                </span>
                <label class="flex items-center gap-1.5 text-xs font-semibold cursor-pointer text-slate-700">
                  <input type="checkbox" onchange="window.toggleHomeworkDone('${task.id}', this.checked)" ${task.homeworkDone ? 'checked' : ''} class="w-4 h-4 rounded text-purple-600 focus:ring-purple-400">
                  숙제 완료
                </label>
              </div>
              <input type="text" placeholder="오늘 배운 학원 진도 (예: 구문독해 Unit 4, 수열의 합 유형 3개)" value="${task.academyProgress || ''}" onchange="window.updateAcademyProgress('${task.id}', this.value)" class="w-full text-xs sm:text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400">
            </div>
          ` : ''}

          <!-- Metacognitive Section (Daughter's Input) -->
          <div class="mt-4 pt-3 border-t border-slate-100 space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span class="text-xs font-bold text-slate-700 flex items-center gap-1">
                <span>🚦 메타인지 이해도 신호등:</span>
              </span>
              <!-- Traffic Light Buttons -->
              <div class="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 gap-1">
                <button onclick="window.setTaskUnderstanding('${task.id}', 'green')" class="px-2.5 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1 ${trafficLight === 'green' ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'}">
                  <span>🟢</span> 완벽 이해
                </button>
                <button onclick="window.setTaskUnderstanding('${task.id}', 'yellow')" class="px-2.5 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1 ${trafficLight === 'yellow' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'}">
                  <span>🟡</span> 문제 더 풀기
                </button>
                <button onclick="window.setTaskUnderstanding('${task.id}', 'red')" class="px-2.5 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1 ${trafficLight === 'red' ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200/60'}">
                  <span>🔴</span> 개념 헷갈림
                </button>
              </div>
            </div>

            <!-- One-line Reflection Memo -->
            <div class="relative">
              <input type="text" placeholder="💡 오늘의 한 줄 인출 메모 (핵심 키워드 요약 또는 질문)..." value="${task.daughterMemo || ''}" onchange="window.updateDaughterMemo('${task.id}', this.value)" class="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 bg-purple-50/20 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 placeholder:text-slate-400">
            </div>
          </div>

          <!-- Cheers & Stamps Section -->
          <div class="mt-4 pt-3 border-t border-slate-100">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-700 flex items-center gap-1">
                <span>💬 함께하는 응원 & 피드백</span>
                <span class="text-[11px] font-normal text-slate-400">(${task.cheers ? task.cheers.length : 0})</span>
              </span>
            </div>

            <!-- Existing Cheers List -->
            <div class="mt-2 space-y-1.5">
              ${task.cheers && task.cheers.length > 0 ? task.cheers.map(c => {
                const supporterLabel = c.supporter || (c.role === 'mom' ? '서포터 1' : c.role === 'dad' ? '서포터 2' : '서포터');
                return `
                <div class="flex items-start justify-between gap-2 p-2 rounded-xl text-xs bg-indigo-50/70 border border-indigo-100 text-indigo-900">
                  <div class="flex items-center gap-2">
                    <span class="text-base">${c.stamp || '👏'}</span>
                    <div>
                      <span class="font-bold">${supporterLabel}:</span>
                      <span class="ml-1">${c.comment}</span>
                    </div>
                  </div>
                  <span class="text-[10px] text-slate-400 flex-shrink-0">${c.time || ''}</span>
                </div>
              `;}).join('') : `
                <p class="text-xs text-slate-400 italic py-1">${currentMode === 'check' ? '남겨진 피드백이 없습니다. 아래에서 스탬프를 눌러 응원할 수 있습니다.' : '남겨진 피드백이 없습니다.'}</p>
              `}
            </div>

            <!-- Cheering Box (Shown in Check Mode) -->
            ${currentMode === 'check' ? `
              <div class="mt-3 p-3 bg-purple-50/70 rounded-xl border border-purple-100 space-y-2.5">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-purple-900">
                    ✨ 오늘의 격려 스탬프 남기기
                  </span>
                  <!-- Supporter Switcher -->
                  <div class="flex items-center gap-1 bg-white/90 p-0.5 rounded-lg border border-purple-200 text-[11px]">
                    <button onclick="window.setSupporter('서포터 1')" class="px-2 py-0.5 rounded-md font-bold transition-all ${currentSupporter === '서포터 1' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-100'}">서포터 1</button>
                    <button onclick="window.setSupporter('서포터 2')" class="px-2 py-0.5 rounded-md font-bold transition-all ${currentSupporter === '서포터 2' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-100'}">서포터 2</button>
                  </div>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <button onclick="window.quickAddStamp('${task.id}', '👏', '꾸준함 최고!')" class="px-2 py-1 bg-white hover:bg-purple-100 border border-purple-200 rounded-lg text-xs font-medium text-slate-700 transition-colors shadow-2xs">
                    👏 꾸준함 최고!
                  </button>
                  <button onclick="window.quickAddStamp('${task.id}', '🔥', '집중력 굿!')" class="px-2 py-1 bg-white hover:bg-purple-100 border border-purple-200 rounded-lg text-xs font-medium text-slate-700 transition-colors shadow-2xs">
                    🔥 집중력 굿!
                  </button>
                  <button onclick="window.quickAddStamp('${task.id}', '🍰', '주말 힐링 선물!')" class="px-2 py-1 bg-white hover:bg-purple-100 border border-purple-200 rounded-lg text-xs font-medium text-slate-700 transition-colors shadow-2xs">
                    🍰 주말 힐링 선물
                  </button>
                  <button onclick="window.quickAddStamp('${task.id}', '⭐', '멋진 노력!')" class="px-2 py-1 bg-white hover:bg-purple-100 border border-purple-200 rounded-lg text-xs font-medium text-slate-700 transition-colors shadow-2xs">
                    ⭐ 멋진 노력!
                  </button>
                  <button onclick="window.quickAddStamp('${task.id}', '💯', '성실왕!')" class="px-2 py-1 bg-white hover:bg-purple-100 border border-purple-200 rounded-lg text-xs font-medium text-slate-700 transition-colors shadow-2xs">
                    💯 성실왕!
                  </button>
                  <button onclick="window.quickAddStamp('${task.id}', '☕', '푹 쉬렴')" class="px-2 py-1 bg-white hover:bg-purple-100 border border-purple-200 rounded-lg text-xs font-medium text-slate-700 transition-colors shadow-2xs">
                    ☕ 푹 쉬렴
                  </button>
                  <button onclick="window.quickAddStamp('${task.id}', '💖', '언제나 응원해')" class="px-2 py-1 bg-white hover:bg-purple-100 border border-purple-200 rounded-lg text-xs font-medium text-slate-700 transition-colors shadow-2xs">
                    💖 언제나 응원해
                  </button>
                </div>
                <!-- Custom Comment Form -->
                <div class="flex items-center gap-1.5 mt-2">
                  <input type="text" id="cheer-input-${task.id}" placeholder="따뜻한 격려 한마디를 남겨보세요..." class="flex-1 text-xs px-3 py-1.5 rounded-lg border border-purple-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-400">
                  <button onclick="window.submitCustomCheer('${task.id}')" class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs">
                    응원 등록
                  </button>
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });

    container.innerHTML = cardsHtml;
  }

  // --- Task Interaction Functions ---
  window.toggleTaskCompletion = function(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (task.status === 'completed') {
      task.status = 'planned';
      task.completedDate = null;
    } else {
      task.status = 'completed';
      task.completedDate = getTodayDateStr();
      triggerConfetti();
    }
    saveAndSyncTasks();
  };

  window.setTaskUnderstanding = function(taskId, level) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    task.understanding = (task.understanding === level) ? null : level;
    saveAndSyncTasks();
  };

  window.updateDaughterMemo = function(taskId, memo) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    task.daughterMemo = memo;
    saveAndSyncTasks();
  };

  window.toggleHomeworkDone = function(taskId, isDone) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    task.homeworkDone = isDone;
    if (isDone && task.status !== 'completed') {
      task.status = 'completed';
      task.completedDate = getTodayDateStr();
    }
    saveAndSyncTasks();
  };

  window.updateAcademyProgress = function(taskId, progress) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    task.academyProgress = progress;
    saveAndSyncTasks();
  };

  // --- Cheering Functions ---
  window.quickAddStamp = function(taskId, stamp, text) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (!task.cheers) task.cheers = [];

    const now = new Date();
    const timeStr = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    task.cheers.push({
      id: 'cheer_' + Date.now(),
      supporter: currentSupporter,
      stamp: stamp,
      comment: text,
      time: timeStr
    });

    triggerHeartConfetti();
    saveAndSyncTasks();
  };

  window.submitCustomCheer = function(taskId) {
    const input = document.getElementById(`cheer-input-${taskId}`);
    if (!input || !input.value.trim()) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (!task.cheers) task.cheers = [];

    const now = new Date();
    const timeStr = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    task.cheers.push({
      id: 'cheer_' + Date.now(),
      supporter: currentSupporter,
      stamp: '💬',
      comment: input.value.trim(),
      time: timeStr
    });

    input.value = '';
    triggerHeartConfetti();
    saveAndSyncTasks();
  };

  // --- Metacognition Notes Tab ---
  window.setMetaFilter = function(filter) {
    metaFilter = filter;
    renderMetacognitionNotes();
  };

  function renderMetacognitionNotes() {
    const container = document.getElementById('metanotes-container');
    const filterButtons = document.getElementById('metanotes-filter-bar');
    if (!container) return;

    // Filter bar
    const stats = calculateStats();
    const filterOptions = [
      { id: 'all', label: `전체 (${tasks.filter(t => t.daughterMemo || t.understanding).length})` },
      { id: 'red', label: `🔴 개념 헷갈림 (${stats.redTotal})`, color: 'text-rose-600' },
      { id: 'yellow', label: `🟡 문제 더 풀기 (${stats.yellowTotal})`, color: 'text-amber-600' },
      { id: 'green', label: `🟢 완벽 이해 (${stats.greenTotal})`, color: 'text-emerald-600' },
      { id: 'academy', label: `🏫 학원 기록 (${tasks.filter(t => t.isAcademy && (t.academyProgress || t.homeworkDone)).length})` }
    ];

    if (filterButtons) {
      filterButtons.innerHTML = filterOptions.map(opt => `
        <button onclick="window.setMetaFilter('${opt.id}')" class="px-3 py-1.5 rounded-full text-xs font-bold transition-all ${metaFilter === opt.id ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
          ${opt.label}
        </button>
      `).join('');
    }

    // Filter tasks
    let filtered = tasks.filter(t => {
      if (metaFilter === 'red') return t.understanding === 'red';
      if (metaFilter === 'yellow') return t.understanding === 'yellow';
      if (metaFilter === 'green') return t.understanding === 'green';
      if (metaFilter === 'academy') return t.isAcademy && (t.academyProgress || t.homeworkDone);
      return t.daughterMemo || t.understanding || (t.isAcademy && t.academyProgress);
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-span-full p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <p class="text-slate-500 font-medium">선택한 조건의 메타인지 기록이 없습니다.</p>
          <p class="text-xs text-slate-400 mt-1">학습 카드에서 이해도 신호등이나 한 줄 메모를 작성해보세요!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(t => {
      let lightBadge = '<span class="text-xs text-slate-400 font-medium">신호등 미선택</span>';
      if (t.understanding === 'green') lightBadge = '<span class="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800">🟢 완벽 이해</span>';
      if (t.understanding === 'yellow') lightBadge = '<span class="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-800">🟡 문제 더 풀기</span>';
      if (t.understanding === 'red') lightBadge = '<span class="px-2 py-0.5 rounded-md text-xs font-bold bg-rose-100 text-rose-800">🔴 개념 헷갈림</span>';

      return `
        <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">${t.subject}</span>
              ${t.pageRange ? `<span class="text-xs font-extrabold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">📖 ${t.pageRange}</span>` : ''}
            </div>
            <span class="text-xs font-medium text-slate-400">${t.plannedDate} (${t.weekday || ''})</span>
          </div>

          <h4 class="text-base font-bold text-slate-800 leading-snug">${t.unit}</h4>
          
          <div class="flex items-center gap-2">
            ${lightBadge}
            ${t.status === 'completed' ? '<span class="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">완료됨 ✓</span>' : '<span class="text-xs font-medium text-slate-400">학습 예정</span>'}
          </div>

          ${t.daughterMemo ? `
            <div class="p-3 bg-purple-50/40 rounded-xl border border-purple-100 text-xs sm:text-sm text-slate-800">
              <span class="font-bold text-purple-700 block mb-0.5">💡 한 줄 메타인지 메모:</span>
              ${t.daughterMemo}
            </div>
          ` : ''}

          ${t.isAcademy && t.academyProgress ? `
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800">
              <span class="font-bold text-slate-700 block mb-0.5">🏫 학원 진도 & 숙제:</span>
              ${t.academyProgress} ${t.homeworkDone ? '(숙제 완료 ✓)' : ''}
            </div>
          ` : ''}

          <!-- Cheers summary -->
          ${t.cheers && t.cheers.length > 0 ? `
            <div class="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5 items-center">
              <span class="text-[11px] font-bold text-slate-400">응원:</span>
              ${t.cheers.map(c => {
                const label = c.supporter || (c.role === 'mom' ? '서포터 1' : c.role === 'dad' ? '서포터 2' : '서포터');
                return `
                <span class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200">
                  <span>${c.stamp}</span>
                  <span class="font-bold">${label}:</span>
                  <span>${c.comment}</span>
                </span>
              `;}).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  // --- Full Roadmap Tab ---
  window.setRoadmapFilter = function(week) {
    roadmapWeekFilter = week;
    renderRoadmapTable();
  };

  function renderRoadmapTable() {
    const container = document.getElementById('roadmap-table-body');
    const filterContainer = document.getElementById('roadmap-week-filters');
    if (!container) return;

    if (filterContainer) {
      let filterHtml = `<button onclick="window.setRoadmapFilter('all')" class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${roadmapWeekFilter === 'all' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">전체 (1~9주)</button>`;
      for (let w = 1; w <= 9; w++) {
        filterHtml += `<button onclick="window.setRoadmapFilter(${w})" class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${roadmapWeekFilter === w ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">${w}주차${w===9?'(총복습)':''}</button>`;
      }
      filterContainer.innerHTML = filterHtml;
    }

    let filtered = tasks;
    if (roadmapWeekFilter !== 'all') {
      filtered = tasks.filter(t => t.week === roadmapWeekFilter);
    }

    container.innerHTML = filtered.map(t => {
      const isCompleted = t.status === 'completed';
      let statusBadge = isCompleted ? '<span class="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">완료 ✓</span>' : '<span class="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">예정</span>';
      
      let lightIcon = '-';
      if (t.understanding === 'green') lightIcon = '🟢';
      if (t.understanding === 'yellow') lightIcon = '🟡';
      if (t.understanding === 'red') lightIcon = '🔴';

      return `
        <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-xs sm:text-sm">
          <td class="px-3 py-3 font-semibold text-slate-700 whitespace-nowrap">${t.week ? `${t.week}주차` : '-'}</td>
          <td class="px-3 py-3 text-slate-600 whitespace-nowrap">${t.plannedDate} (${t.weekday || ''})</td>
          <td class="px-3 py-3 whitespace-nowrap">
            <span class="px-2 py-0.5 rounded font-bold text-xs ${t.subject === '통합과학1' ? 'bg-emerald-50 text-emerald-700' : t.subject === '한국사1' ? 'bg-amber-50 text-amber-700' : t.subject === '통합사회1' ? 'bg-sky-50 text-sky-700' : 'bg-purple-50 text-purple-700'}">${t.subject}</span>
          </td>
          <td class="px-3 py-3 font-medium text-slate-800 max-w-xs truncate">${t.unit}</td>
          <td class="px-3 py-3 text-slate-600 whitespace-nowrap">
            ${t.pageRange ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">📖 ${t.pageRange}</span>` : '<span class="text-slate-400 text-xs">-</span>'}
          </td>
          <td class="px-3 py-3 text-center whitespace-nowrap text-base">${lightIcon}</td>
          <td class="px-3 py-3 text-center whitespace-nowrap">${statusBadge}</td>
          <td class="px-3 py-3 text-right whitespace-nowrap">
            <button onclick="window.selectCalendarDate('${t.plannedDate}'); window.switchTab('calendar');" class="text-xs text-purple-600 hover:text-purple-800 font-semibold underline">
              상세보기
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // --- Weekly Planner View Logic ---
  function getWeekDateRange(weekNum) {
    const startDate = new Date(2026, 10, 30); // Nov 30, 2026
    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() + (weekNum - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const fmt = d => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    return {
      startDate: weekStart,
      endDate: weekEnd,
      rangeText: `${fmt(weekStart)} ~ ${fmt(weekEnd)}`
    };
  }

  window.changeWeeklyWeek = function(delta) {
    currentWeeklyWeek = Math.max(1, Math.min(9, currentWeeklyWeek + delta));
    renderWeeklyView();
  };

  window.setWeeklyWeek = function(weekNum) {
    currentWeeklyWeek = weekNum;
    renderWeeklyView();
  };

  window.goToCurrentWeek = function() {
    const today = getTodayDateStr();
    const diff = getDayDiff(DEFAULT_START_DATE, today);
    const week = Math.max(1, Math.min(9, Math.floor(diff / 7) + 1));
    currentWeeklyWeek = week;
    renderWeeklyView();
  };

  function renderWeeklyView() {
    const titleEl = document.getElementById('weekly-title');
    const rangeEl = document.getElementById('weekly-range');
    const pillsContainer = document.getElementById('weekly-pills-bar');
    const statsContainer = document.getElementById('weekly-stats-bar');
    const daysGrid = document.getElementById('weekly-days-grid');

    if (!titleEl || !daysGrid) return;

    const range = getWeekDateRange(currentWeeklyWeek);
    titleEl.textContent = `${currentWeeklyWeek}주차 주간 플래너`;
    if (rangeEl) rangeEl.textContent = range.rangeText;

    // Week Pills
    if (pillsContainer) {
      let pillsHtml = '';
      for (let w = 1; w <= 9; w++) {
        const isCurrent = w === currentWeeklyWeek;
        pillsHtml += `
          <button onclick="window.setWeeklyWeek(${w})" class="px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${isCurrent ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
            ${w}주차${w === 9 ? '(총복습)' : ''}
          </button>
        `;
      }
      pillsContainer.innerHTML = pillsHtml;
    }

    // Weekly Tasks & Stats
    const weekTasks = tasks.filter(t => t.week === currentWeeklyWeek);
    const completedTasks = weekTasks.filter(t => t.status === 'completed');
    const percent = weekTasks.length > 0 ? Math.round((completedTasks.length / weekTasks.length) * 100) : 0;
    const greenCount = weekTasks.filter(t => t.understanding === 'green').length;
    const yellowCount = weekTasks.filter(t => t.understanding === 'yellow').length;
    const redCount = weekTasks.filter(t => t.understanding === 'red').length;

    if (statsContainer) {
      statsContainer.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div>
              <div class="text-[11px] font-bold text-slate-400">${currentWeeklyWeek}주차 완주율</div>
              <div class="text-xl sm:text-2xl font-black text-purple-700">${percent}%</div>
            </div>
            <div class="h-8 w-px bg-purple-200"></div>
            <div>
              <div class="text-[11px] font-bold text-slate-400">완료 단원</div>
              <div class="text-xs sm:text-sm font-bold text-slate-700">${completedTasks.length} / ${weekTasks.length} 단원</div>
            </div>
          </div>

          <div class="flex-1 max-w-xs w-full">
            <div class="w-full h-2 bg-purple-200/80 rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all" style="width: ${percent}%"></div>
            </div>
          </div>

          <div class="flex items-center gap-1.5 text-xs font-semibold">
            <span class="px-2 py-0.5 rounded-md bg-white border border-slate-200/80">🟢 완벽: ${greenCount}</span>
            <span class="px-2 py-0.5 rounded-md bg-white border border-slate-200/80">🟡 풀기: ${yellowCount}</span>
            <span class="px-2 py-0.5 rounded-md bg-white border border-slate-200/80">🔴 헷갈림: ${redCount}</span>
          </div>
        </div>
      `;
    }

    // 7 Days Columns
    let daysHtml = '';
    const weekdaysKr = ['월', '화', '수', '목', '금', '토', '일'];
    const startDate = new Date(2026, 10, 30);
    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() + (currentWeeklyWeek - 1) * 7);

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const curDate = new Date(weekStart);
      curDate.setDate(weekStart.getDate() + dayOffset);
      const y = curDate.getFullYear();
      const m = String(curDate.getMonth() + 1).padStart(2, '0');
      const d = String(curDate.getDate()).padStart(2, '0');
      const curDateStr = `${y}-${m}-${d}`;

      const isToday = curDateStr === getTodayDateStr();
      const dayTasks = tasks.filter(t => t.plannedDate === curDateStr);
      const completedDayTasks = dayTasks.filter(t => t.status === 'completed');
      const isAllDone = dayTasks.length > 0 && completedDayTasks.length === dayTasks.length;
      const dayDiff = getDayDiff(DEFAULT_START_DATE, curDateStr) + 1;

      let weekdayColor = 'text-slate-700';
      if (dayOffset === 5) weekdayColor = 'text-blue-600'; // Sat
      if (dayOffset === 6) weekdayColor = 'text-rose-600'; // Sun

      daysHtml += `
        <div class="bg-white rounded-2xl border ${isToday ? 'border-purple-300 ring-2 ring-purple-200 shadow-sm' : 'border-slate-200 shadow-2xs'} flex flex-col justify-between overflow-hidden">
          <!-- Day Column Header -->
          <div class="p-3 border-b border-slate-100 ${isToday ? 'bg-purple-50/80' : 'bg-slate-50/70'} flex items-center justify-between">
            <div>
              <div class="flex items-center gap-1.5">
                <span class="font-extrabold text-sm ${weekdayColor}">(${weekdaysKr[dayOffset]})</span>
                <span class="text-xs font-bold text-slate-800">${curDate.getMonth() + 1}/${curDate.getDate()}</span>
                ${isToday ? '<span class="text-[10px] font-extrabold bg-purple-600 text-white px-1.5 py-0.5 rounded-full">오늘</span>' : ''}
              </div>
              <span class="text-[10px] text-slate-400 font-medium">Day ${dayDiff}</span>
            </div>
            <div>
              <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${isAllDone ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">
                ${completedDayTasks.length}/${dayTasks.length}
              </span>
            </div>
          </div>

          <!-- Tasks List in this Day -->
          <div class="p-2.5 space-y-2 flex-1 min-h-[160px]">
            ${dayTasks.length > 0 ? dayTasks.map(t => {
              const isDone = t.status === 'completed';
              let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
              if (t.subject === '통합과학1') badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
              if (t.subject === '한국사1') badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
              if (t.subject === '통합사회1') badgeColor = 'bg-sky-50 text-sky-700 border-sky-200';
              if (t.isAcademy && t.academyType === 'english') badgeColor = 'bg-purple-50 text-purple-700 border-purple-200';
              if (t.isAcademy && t.academyType === 'math') badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
              if (t.isClinic) badgeColor = 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200';

              let lightIcon = '';
              if (t.understanding === 'green') lightIcon = '🟢';
              else if (t.understanding === 'yellow') lightIcon = '🟡';
              else if (t.understanding === 'red') lightIcon = '🔴';

              return `
                <div class="p-2.5 rounded-xl border ${isDone ? 'bg-slate-50/80 border-slate-200/80 opacity-80' : 'bg-white border-slate-200 shadow-2xs'} space-y-1.5 transition-all">
                  <div class="flex items-start justify-between gap-1">
                    <div class="flex items-center gap-1 flex-wrap">
                      <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${badgeColor}">
                        ${t.subject}
                      </span>
                      ${t.pageRange ? `<span class="text-[9px] font-extrabold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">📖 ${t.pageRange}</span>` : ''}
                    </div>
                    <button onclick="window.toggleTaskCompletion('${t.id}')" class="w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 cursor-pointer ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white hover:border-purple-400'}">
                      ${isDone ? '<span class="text-[10px] font-bold">✓</span>' : ''}
                    </button>
                  </div>
                  <div class="text-xs font-bold text-slate-800 leading-snug ${isDone ? 'line-through text-slate-400' : ''}">
                    ${t.unit}
                  </div>
                  <div class="flex items-center justify-between pt-1 text-[11px]">
                    <span class="text-xs">${lightIcon}</span>
                    <button onclick="window.selectCalendarDate('${t.plannedDate}'); window.switchTab('calendar');" class="text-[11px] font-semibold text-purple-600 hover:text-purple-800 underline cursor-pointer">
                      상세
                    </button>
                  </div>
                </div>
              `;
            }).join('') : `
              <div class="h-full flex items-center justify-center p-4 text-center text-slate-300 text-xs italic">
                일정 없음
              </div>
            `}
          </div>

          <!-- Bottom Day Action -->
          <div class="p-2 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-[11px]">
            <button onclick="window.selectCalendarDate('${curDateStr}'); window.switchTab('calendar');" class="text-slate-500 hover:text-purple-700 font-medium cursor-pointer">
              일일 상세 →
            </button>
            <button onclick="window.selectCalendarDate('${curDateStr}'); window.openAddTaskModal();" class="text-purple-600 hover:text-purple-800 font-bold cursor-pointer">
              + 추가
            </button>
          </div>
        </div>
      `;
    }

    daysGrid.innerHTML = daysHtml;
  }

  // --- Tab Navigation ---
  window.switchTab = function(tabName) {
    activeTab = tabName;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tabName);

    const tabs = ['calendar', 'weekly', 'roadmap', 'metacognition'];
    tabs.forEach(t => {
      const btn = document.getElementById(`tab-btn-${t}`);
      const content = document.getElementById(`tab-content-${t}`);
      if (!btn || !content) return;

      if (t === tabName) {
        btn.className = 'px-4 py-2 rounded-xl text-sm font-bold bg-purple-600 text-white shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap';
        content.classList.remove('hidden');
      } else {
        btn.className = 'px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all flex items-center gap-1.5 whitespace-nowrap';
        content.classList.add('hidden');
      }
    });

    if (tabName === 'calendar') {
      renderCalendar();
      renderDailyCards();
    } else if (tabName === 'weekly') {
      renderWeeklyView();
    } else if (tabName === 'roadmap') {
      renderRoadmapTable();
    } else if (tabName === 'metacognition') {
      renderMetacognitionNotes();
    }
  };

  // --- Modals Logic ---
  let editingTaskId = null;

  window.openRescheduleModal = function(taskId) {
    editingTaskId = taskId;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const modal = document.getElementById('reschedule-modal');
    const titleEl = document.getElementById('reschedule-task-title');
    const plannedDateInput = document.getElementById('reschedule-planned-date');
    const completedDateInput = document.getElementById('reschedule-completed-date');

    if (titleEl) titleEl.textContent = task.unit;
    if (plannedDateInput) plannedDateInput.value = task.plannedDate;
    if (completedDateInput) completedDateInput.value = task.completedDate || '';

    if (modal) modal.classList.remove('hidden');
  };

  window.closeRescheduleModal = function() {
    const modal = document.getElementById('reschedule-modal');
    if (modal) modal.classList.add('hidden');
    editingTaskId = null;
  };

  window.rescheduleShortcut = function(type) {
    if (!editingTaskId) return;
    const task = tasks.find(t => t.id === editingTaskId);
    if (!task) return;

    let targetDate = new Date(task.plannedDate);
    if (type === 'tomorrow') {
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (type === 'nextWeek') {
      targetDate.setDate(targetDate.getDate() + 7);
    } else if (type === 'week9') {
      targetDate = new Date(2027, 0, 25); // Jan 25, 2027
    }

    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getDate()).padStart(2, '0');
    const newDateStr = `${y}-${m}-${d}`;

    const plannedDateInput = document.getElementById('reschedule-planned-date');
    if (plannedDateInput) plannedDateInput.value = newDateStr;
  };

  window.saveRescheduleModal = function() {
    if (!editingTaskId) return;
    const task = tasks.find(t => t.id === editingTaskId);
    if (!task) return;

    const plannedDateInput = document.getElementById('reschedule-planned-date');
    const completedDateInput = document.getElementById('reschedule-completed-date');

    if (plannedDateInput && plannedDateInput.value) {
      if (plannedDateInput.value !== task.plannedDate) {
        task.rescheduledFrom = task.plannedDate;
        task.plannedDate = plannedDateInput.value;
      }
    }

    if (completedDateInput) {
      task.completedDate = completedDateInput.value || null;
      if (task.completedDate) {
        task.status = 'completed';
      }
    }

    closeRescheduleModal();
    saveAndSyncTasks();
  };

  // --- Add Custom Task Modal ---
  window.openAddTaskModal = function() {
    const modal = document.getElementById('add-task-modal');
    const dateInput = document.getElementById('new-task-date');
    if (dateInput) dateInput.value = selectedDate;
    if (modal) modal.classList.remove('hidden');
  };

  window.closeAddTaskModal = function() {
    const modal = document.getElementById('add-task-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.saveCustomTask = function() {
    const subjInput = document.getElementById('new-task-subject');
    const titleInput = document.getElementById('new-task-title');
    const summaryInput = document.getElementById('new-task-summary');
    const dateInput = document.getElementById('new-task-date');

    if (!titleInput || !titleInput.value.trim()) {
      alert('학습 단원 또는 제목을 입력해주세요.');
      return;
    }

    const newTask = {
      id: 'custom_' + Date.now(),
      day: null,
      week: null,
      date: dateInput.value || selectedDate,
      weekday: ['일','월','화','수','목','금','토'][new Date(dateInput.value || selectedDate).getDay()],
      subject: subjInput.value,
      chapter: '추가 학습',
      unit: titleInput.value.trim(),
      summary: summaryInput.value.trim() || '추가 보충 학습 및 오답 정리',
      keywords: ['#추가학습', '#보충'],
      isClinic: false,
      isAcademy: false,
      status: 'planned',
      plannedDate: dateInput.value || selectedDate,
      completedDate: null,
      understanding: null,
      daughterMemo: '',
      cheers: []
    };

    tasks.push(newTask);
    closeAddTaskModal();
    saveAndSyncTasks();
  };

  // --- Settings & Cloud Modal ---
  window.openSettingsModal = function() {
    const modal = document.getElementById('settings-modal');
    const configInput = document.getElementById('settings-firebase-config');
    const savedConfig = localStorage.getItem(STORAGE_KEYS.FIREBASE_CONFIG);
    if (configInput && savedConfig) {
      configInput.value = savedConfig;
    }
    if (modal) modal.classList.remove('hidden');
  };

  window.closeSettingsModal = function() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.saveFirebaseConfig = function() {
    const configInput = document.getElementById('settings-firebase-config');
    if (!configInput) return;
    const raw = configInput.value.trim();

    if (!raw) {
      localStorage.removeItem(STORAGE_KEYS.FIREBASE_CONFIG);
      db = null;
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      updateSyncStatusUI('local');
      alert('클라우드 설정이 해제되어 로컬 저장 모드로 전환되었습니다.');
      closeSettingsModal();
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      localStorage.setItem(STORAGE_KEYS.FIREBASE_CONFIG, JSON.stringify(parsed));
      initFirebaseIfConfigured();
      alert('Firebase 설정이 저장되었습니다! 실시간 동기화를 연결합니다.');
      closeSettingsModal();
    } catch (e) {
      alert('유효한 JSON 형식의 Firebase 설정 객체를 입력해주세요.\n오류: ' + e.message);
    }
  };

  // --- Backup & Restore ---
  window.exportBackupJSON = function() {
    const dataStr = JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      tasks: tasks
    }, null, 2);

    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const dateStamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `metalog_backup_${dateStamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  window.importBackupJSON = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const parsed = JSON.parse(e.target.result);
        if (parsed && Array.isArray(parsed.tasks)) {
          if (confirm(`백업 파일에서 ${parsed.tasks.length}개의 일정을 복원하시겠습니까? (기존 데이터는 덮어씌워집니다)`)) {
            tasks = parsed.tasks;
            saveAndSyncTasks();
            alert('성공적으로 복원되었습니다!');
            closeSettingsModal();
          }
        } else {
          alert('올바른 메타로그 백업 JSON 파일이 아닙니다.');
        }
      } catch (err) {
        alert('파일을 읽는 중 오류가 발생했습니다: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  window.resetToDefaultCurriculum = function() {
    if (confirm('정말로 기본 커리큘럼으로 초기화하시겠습니까?\n작성된 메타인지 메모와 체크 현황이 모두 초기화됩니다.')) {
      if (confirm('다시 한번 확인합니다. 복원할 수 없습니다. 계속하시겠습니까?')) {
        tasks = JSON.parse(JSON.stringify(window.INITIAL_CURRICULUM));
        saveAndSyncTasks();
        alert('기본 커리큘럼으로 초기화되었습니다.');
        closeSettingsModal();
      }
    }
  };

  // --- Subject Full Course Modal (대단원 및 전과정 확인) ---
  window.openSubjectDetailModal = function(subjectName) {
    const modal = document.getElementById('subject-detail-modal');
    const titleEl = document.getElementById('subject-modal-title');
    const badgeEl = document.getElementById('subject-modal-badge');
    const contentEl = document.getElementById('subject-modal-content');

    if (!modal || !contentEl) return;

    const subTasks = tasks.filter(t => t.subject === subjectName && !t.isAcademy);
    const totalCount = subTasks.length;
    const completedCount = subTasks.filter(t => t.status === 'completed').length;
    const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const greenCount = subTasks.filter(t => t.understanding === 'green').length;
    const yellowCount = subTasks.filter(t => t.understanding === 'yellow').length;
    const redCount = subTasks.filter(t => t.understanding === 'red').length;
    const uncheckCount = subTasks.filter(t => !t.understanding).length;

    let icon = '📚';
    let themeBg = 'bg-purple-100 text-purple-800 border-purple-200';
    let barColor = 'bg-purple-500';
    if (subjectName === '통합과학1') {
      icon = '🔬';
      themeBg = 'bg-emerald-100 text-emerald-800 border-emerald-200';
      barColor = 'bg-emerald-500';
    } else if (subjectName === '한국사1') {
      icon = '📜';
      themeBg = 'bg-amber-100 text-amber-800 border-amber-200';
      barColor = 'bg-amber-500';
    } else if (subjectName === '통합사회1') {
      icon = '🌍';
      themeBg = 'bg-sky-100 text-sky-800 border-sky-200';
      barColor = 'bg-sky-500';
    }

    const textbookSpecs = {
      '통합과학1': {
        name: '완자 고등 통합과학 1',
        edition: '2022 개정 교육과정 (비상교육)',
        totalPages: 376,
        mainPages: 224,
        appendixPages: 48,
        answerPages: 104,
        desc: '본책(개념+문제) 224쪽 + 수능 미리보기 48쪽 + 정답친해 104쪽'
      },
      '한국사1': {
        name: '완자 고등 한국사 1',
        edition: '2022 개정 교육과정 (비상교육)',
        totalPages: 256,
        mainPages: 168,
        appendixPages: 24,
        answerPages: 64,
        desc: '본책(개념+문제) 168쪽 + 부록(연표·사료집) 24쪽 + 정답친해 64쪽'
      },
      '통합사회1': {
        name: '완자 고등 통합사회 1',
        edition: '2022 개정 교육과정 (비상교육)',
        totalPages: 224,
        mainPages: 152,
        appendixPages: 24,
        answerPages: 48,
        desc: '본책(개념+문제) 152쪽 + 부록(핵심선지) 24쪽 + 정답과 해설 48쪽'
      }
    };

    const book = textbookSpecs[subjectName] || {
      name: `${subjectName} 교재`,
      edition: '비상교육 완자',
      totalPages: 0,
      mainPages: 0,
      appendixPages: 0,
      answerPages: 0,
      desc: ''
    };

    if (titleEl) titleEl.textContent = `${subjectName} 전체 과정 로드맵`;
    if (badgeEl) badgeEl.innerHTML = `
      <span class="px-2.5 py-1 rounded-full text-xs font-bold border ${themeBg}">
        ${icon} 2022 개정 비상 완자
      </span>
      <span class="text-xs font-semibold text-slate-500">
        총 ${totalCount}개 단원 (${percent}% 완주)
      </span>
    `;

    // Group tasks by Chapter
    const chaptersMap = new Map();
    subTasks.forEach(task => {
      const ch = task.chapter || '기타';
      if (!chaptersMap.has(ch)) {
        chaptersMap.set(ch, []);
      }
      chaptersMap.get(ch).push(task);
    });

    let html = `
      <!-- Textbook Specification Card -->
      <div class="p-4 bg-gradient-to-r from-purple-50/90 to-indigo-50/90 rounded-2xl border border-purple-200 shadow-2xs mb-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs sm:text-sm font-extrabold text-slate-800">📖 교재 공식 제원: ${book.name}</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">${book.edition}</span>
            </div>
            <div class="text-xs text-slate-600 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>총 쪽수: <strong class="text-purple-700 font-black">${book.totalPages}쪽</strong></span>
              <span>본책 진도: <strong class="text-slate-800 font-bold">${book.mainPages}p</strong></span>
              <span>부록: <strong class="text-slate-800 font-bold">${book.appendixPages}p</strong></span>
              <span>정답과 해설: <strong class="text-slate-800 font-bold">${book.answerPages}p</strong></span>
            </div>
          </div>
          <div class="flex-shrink-0">
            <span class="inline-flex items-center gap-1 px-3 py-1 bg-white text-purple-700 font-extrabold text-xs rounded-xl border border-purple-200 shadow-2xs">
              🎯 1회독 본문 목표: ${book.mainPages}쪽 완주
            </span>
          </div>
        </div>
      </div>

      <!-- Progress Bar & Summary Stats in Modal -->
      <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 mb-5">
        <div class="flex items-center justify-between text-xs sm:text-sm">
          <span class="font-bold text-slate-700">전체 진도율</span>
          <span class="font-extrabold text-slate-800">${completedCount} / ${totalCount} 단원 완료 (${percent}%)</span>
        </div>
        <div class="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
          <div class="h-full ${barColor} rounded-full transition-all" style="width: ${percent}%"></div>
        </div>
        <div class="grid grid-cols-4 gap-2 pt-1 text-center text-xs">
          <div class="p-2 rounded-xl bg-white border border-slate-200/80">
            <div class="text-[10px] text-slate-400 font-medium">🟢 완벽이해</div>
            <div class="font-bold text-emerald-600 text-sm mt-0.5">${greenCount}개</div>
          </div>
          <div class="p-2 rounded-xl bg-white border border-slate-200/80">
            <div class="text-[10px] text-slate-400 font-medium">🟡 문제더풀기</div>
            <div class="font-bold text-amber-600 text-sm mt-0.5">${yellowCount}개</div>
          </div>
          <div class="p-2 rounded-xl bg-white border border-slate-200/80">
            <div class="text-[10px] text-slate-400 font-medium">🔴 개념헷갈림</div>
            <div class="font-bold text-rose-600 text-sm mt-0.5">${redCount}개</div>
          </div>
          <div class="p-2 rounded-xl bg-white border border-slate-200/80">
            <div class="text-[10px] text-slate-400 font-medium">미체크</div>
            <div class="font-bold text-slate-500 text-sm mt-0.5">${uncheckCount}개</div>
          </div>
        </div>
      </div>

      <!-- Chapter Groups -->
      <div class="space-y-4">
    `;

    chaptersMap.forEach((tasksList, chapterName) => {
      const chCompleted = tasksList.filter(t => t.status === 'completed').length;
      html += `
        <div class="border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-2xs">
          <div class="bg-slate-50/90 px-4 py-2.5 border-b border-slate-200/80 flex items-center justify-between">
            <h5 class="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <span>📌</span> ${chapterName}
            </h5>
            <span class="text-[11px] font-semibold text-slate-500">
              ${chCompleted} / ${tasksList.length} 단원 완료
            </span>
          </div>
          <div class="divide-y divide-slate-100">
      `;

      tasksList.forEach(t => {
        const isDone = t.status === 'completed';
        let lightText = '-';
        if (t.understanding === 'green') lightText = '🟢 완벽이해';
        else if (t.understanding === 'yellow') lightText = '🟡 문제더풀기';
        else if (t.understanding === 'red') lightText = '🔴 개념헷갈림';

        html += `
          <div class="p-3 sm:p-4 hover:bg-purple-50/30 transition-colors flex items-start justify-between gap-3 cursor-pointer group" onclick="window.jumpToTaskDate('${t.plannedDate}')">
            <div class="flex items-start gap-3 flex-1 min-w-0">
              <span class="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 ${isDone ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-300 border border-slate-200'}">
                ${isDone ? '✓' : ''}
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-purple-700 transition-colors ${isDone ? 'line-through text-slate-400' : ''}">${t.unit}</span>
                  ${t.pageRange ? `<span class="text-[11px] font-extrabold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md whitespace-nowrap">📖 ${t.pageRange}${t.pageCount ? ` (${t.pageCount}p)` : ''}</span>` : ''}
                  <span class="text-[11px] text-slate-400 font-medium whitespace-nowrap">📅 ${t.plannedDate} (${t.weekday || ''})</span>
                </div>
                <p class="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">${t.summary || ''}</p>
                ${t.keywords && t.keywords.length > 0 ? `
                  <div class="mt-1.5 flex flex-wrap gap-1">
                    ${t.keywords.map(kw => `<span class="text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded font-medium">${kw}</span>`).join('')}
                  </div>
                ` : ''}
                ${t.daughterMemo ? `
                  <div class="mt-1.5 text-xs text-slate-600 bg-purple-50/50 p-2 rounded-xl border border-purple-100">
                    💡 <span class="font-medium">${t.daughterMemo}</span>
                  </div>
                ` : ''}
              </div>
            </div>
            <div class="flex flex-col items-end gap-1.5 flex-shrink-0">
              ${t.understanding ? `<span class="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">${lightText}</span>` : ''}
              <button class="text-xs font-bold text-purple-600 group-hover:text-purple-800 bg-purple-50 group-hover:bg-purple-100 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap">
                학습 보기 →
              </button>
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    html += `</div>`;
    contentEl.innerHTML = html;
    modal.classList.remove('hidden');
  };

  window.closeSubjectDetailModal = function() {
    const modal = document.getElementById('subject-detail-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.jumpToTaskDate = function(dateStr) {
    closeSubjectDetailModal();
    window.selectCalendarDate(dateStr);
    window.switchTab('calendar');
    const cardEl = document.getElementById('daily-tasks-container');
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // --- Markdown Report Generator ---
  window.copyMarkdownReport = function() {
    const stats = calculateStats();
    let md = `# 🎓 예비고1 63일 완주 메타로그 (MetaLog) 학습 리포트\n\n`;
    md += `> **기간:** 2026.11.30 ~ 2027.01.31 (63일)  \n`;
    md += `> **기준일:** ${stats.todayStr} (${stats.dDayText})  \n`;
    md += `> **전체 달성률:** **${stats.totalPercent}%** (${stats.completedRegular}/${stats.totalRegular} 단원 완주)  \n\n`;

    md += `## 📊 과목별 완주 현황\n`;
    md += `- **🔬 통합과학 1:** ${stats.science.percent}% (${stats.science.completed}/${stats.science.total} 완료) | 🔴 취약 ${stats.science.redCount}개\n`;
    md += `- **📜 한국사 1:** ${stats.history.percent}% (${stats.history.completed}/${stats.history.total} 완료) | 🔴 취약 ${stats.history.redCount}개\n`;
    md += `- **🌍 통합사회 1:** ${stats.society.percent}% (${stats.society.completed}/${stats.society.total} 완료) | 🔴 취약 ${stats.society.redCount}개\n`;
    md += `- **🏫 학원 점검:** 영어 숙제 완수 ${stats.engDone}/${stats.engAcadTotal} | 수학 숙제 완수 ${stats.mathDone}/${stats.mathAcadTotal}\n\n`;

    md += `## 🚦 메타인지 신호등 점검 요약\n`;
    md += `- 🟢 완벽 이해: **${stats.greenTotal}개**\n`;
    md += `- 🟡 문제 더 풀기: **${stats.yellowTotal}개**\n`;
    md += `- 🔴 개념 헷갈림 (우선 복습 대상): **${stats.redTotal}개**\n\n`;

    const redTasks = tasks.filter(t => t.understanding === 'red');
    if (redTasks.length > 0) {
      md += `### 🔴 집중 보완이 필요한 취약 단원 목록\n`;
      redTasks.forEach(t => {
        md += `- **[${t.subject}]** ${t.unit} (${t.plannedDate})\n`;
        if (t.daughterMemo) md += `  - 💡 메모: _${t.daughterMemo}_\n`;
      });
      md += `\n`;
    }

    const memoTasks = tasks.filter(t => t.daughterMemo);
    if (memoTasks.length > 0) {
      md += `### 💡 최근 한 줄 메타인지 인출 노트\n`;
      memoTasks.slice(-10).forEach(t => {
        md += `- **${t.plannedDate} [${t.subject}] ${t.unit}**\n`;
        md += `  > ${t.daughterMemo}\n`;
      });
      md += `\n`;
    }

    md += `---\n*Generated by MetaLog (메타로그) - 예비고1 63일 메타인지 트래커*`;

    navigator.clipboard.writeText(md).then(() => {
      alert('📋 전체 학습 리포트가 마크다운 형식으로 클립보드에 복사되었습니다!\n노션이나 카카오톡에 붙여넣어 공유하세요.');
    }).catch(err => {
      console.error('Clipboard copy error:', err);
      alert('클립보드 복사 중 오류가 발생했습니다.');
    });
  };

  // --- Simulator / Date Preview ---
  window.openSimModal = function() {
    const modal = document.getElementById('sim-modal');
    if (modal) modal.classList.remove('hidden');
  };

  window.closeSimModal = function() {
    const modal = document.getElementById('sim-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.setSimulatedDate = function(dateStr) {
    if (dateStr) {
      simulatedDate = dateStr;
      localStorage.setItem(STORAGE_KEYS.SIMULATED_DATE, dateStr);
      selectedDate = dateStr;
    } else {
      simulatedDate = null;
      localStorage.removeItem(STORAGE_KEYS.SIMULATED_DATE);
      selectedDate = getTodayDateStr();
    }
    const [y, m] = selectedDate.split('-').map(Number);
    currentCalendarMonth = new Date(y, m - 1, 1);
    closeSimModal();
    renderAll();
  };

  // --- Confetti FX ---
  function triggerConfetti() {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });
    }
  }

  function triggerHeartConfetti() {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 30,
        spread: 45,
        origin: { y: 0.8 },
        colors: ['#EC4899', '#F43F5E', '#A855F7', '#FBBF24']
      });
    }
  }

  // --- Service Worker ---
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => console.log('MetaLog ServiceWorker registered'))
          .catch(err => console.log('MetaLog ServiceWorker registration skipped:', err));
      });
    }
  }

  function setupEventListeners() {
    renderModeSwitcher();
  }

  function renderAll() {
    renderModeSwitcher();
    renderHeroBanner();
    if (activeTab === 'calendar') {
      renderCalendar();
      renderDailyCards();
    } else if (activeTab === 'weekly') {
      renderWeeklyView();
    } else if (activeTab === 'roadmap') {
      renderRoadmapTable();
    } else if (activeTab === 'metacognition') {
      renderMetacognitionNotes();
    }
  }

  // Start app on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
