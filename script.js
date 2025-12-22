// ===== Управление кастомным подтверждением =====
let confirmCallback = null;

function showConfirm(title, message, callback, isDestructive = true) {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-modal-title');
    const messageEl = document.getElementById('confirm-modal-message');
    const confirmBtn = document.getElementById('confirm-modal-confirm');

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    
    if (confirmBtn) {
        confirmBtn.style.background = isDestructive ? 'var(--status-error)' : 'var(--primary-color)';
    }

    confirmCallback = callback;
    if (modal) modal.style.display = 'flex';
}

function hideConfirm() {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.style.display = 'none';
    confirmCallback = null;
}

// ===== Работа с данными рейса из localStorage (crewPortalInfo) =====
const CREW_PORTAL_LS_KEY = 'crewPortalInfo';
const FLIGHT_DATA_SOURCE_LS_KEY = 'flight_data_source';
const MANUAL_FLIGHT_DATA_LS_KEY = 'manual_flight_data';
const CREW_PORTAL_TEST_URL = 'https://myapihelper.na4u.ru/crewtimeapi/test.php?randomDate=false';

// ===== Настройки этапов (localStorage) =====
const STAGE_SETTINGS_LS_KEY = 'stageSettings';
const SLEEP_TOGGLE_LS_KEY = 'sleepEnabled';
const STAGE_OVERRIDES_LS_KEY = 'stageOverridesByFlight';

const DEFAULT_STAGE_SETTINGS = {
    home_rest: '00:30',
    home_wakeup: '01:10',
    home_taxi: '00:10',
    home_exit: '02:30',
    hotel_rest: '00:30',
    hotel_wakeup: '01:10',
    hotel_taxi: '00:10',
    hotel_exit: '02:30'
};

// ===== Авторизация (localStorage) =====
const AUTH_LS_KEY = 'authCredentials';

const DEFAULT_AUTH = {
    login: '',
    password: ''
};

function getAuthCredentials() {
    const raw = localStorage.getItem(AUTH_LS_KEY);
    const parsed = raw ? safeParseJson(raw) : null;

    if (!parsed || typeof parsed !== 'object') {
        return { ...DEFAULT_AUTH };
    }

    return {
        ...DEFAULT_AUTH,
        ...parsed
    };
}

function saveAuthCredentials(creds) {
    localStorage.setItem(AUTH_LS_KEY, JSON.stringify(creds));
}

function applyAuthToUI() {
    const creds = getAuthCredentials();

    const loginInput = document.getElementById('login-input');
    const passwordInput = document.getElementById('password-input');

    if (loginInput) {
        loginInput.value = (creds.login ?? DEFAULT_AUTH.login).toString();
    }

    if (passwordInput) {
        passwordInput.value = (creds.password ?? DEFAULT_AUTH.password).toString();
    }
}

function safeParseJson(raw) {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function getStageSettings() {
    const raw = localStorage.getItem(STAGE_SETTINGS_LS_KEY);
    const parsed = raw ? safeParseJson(raw) : null;

    if (!parsed || typeof parsed !== 'object') {
        return { ...DEFAULT_STAGE_SETTINGS };
    }

    return {
        ...DEFAULT_STAGE_SETTINGS,
        ...parsed
    };
}

function saveStageSettings(settings) {
    localStorage.setItem(STAGE_SETTINGS_LS_KEY, JSON.stringify(settings));
}

function getSleepEnabled() {
    const raw = localStorage.getItem(SLEEP_TOGGLE_LS_KEY);
    if (raw === null) return true; // по умолчанию включено
    return raw === 'true';
}

function saveSleepEnabled(enabled) {
    localStorage.setItem(SLEEP_TOGGLE_LS_KEY, enabled ? 'true' : 'false');
}

function applySleepEnabledToUI(enabled) {
    const sleepToggle = document.getElementById('sleep-toggle');
    if (sleepToggle) sleepToggle.checked = enabled;

    const sleepStages = document.querySelectorAll(
        '.stage-item[data-stage="rest"], .stage-item[data-stage="sleep"]'
    );
    const sleepControls = document.querySelector('.sleep-controls');

    const decreaseButton = document.getElementById('sleep-decrease');
    const increaseButton = document.getElementById('sleep-increase');

    if (enabled) {
        sleepStages.forEach((stage) => stage.classList.remove('stage-inactive'));
        if (sleepControls) sleepControls.classList.remove('sleep-controls--disabled');
        if (decreaseButton) decreaseButton.disabled = false;
        if (increaseButton) increaseButton.disabled = false;
        updateSleepDisplay();
    } else {
        sleepStages.forEach((stage) => stage.classList.add('stage-inactive'));
        if (sleepControls) sleepControls.classList.add('sleep-controls--disabled');
        if (decreaseButton) decreaseButton.disabled = true;
        if (increaseButton) increaseButton.disabled = true;
    }
}

function timeToPretty(timeStr) {
    // "HH:MM" -> "за HH:MM"
    if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) {
        return 'за --:--';
    }

    const [hhRaw, mmRaw] = timeStr.split(':');
    const h = Number.parseInt(hhRaw, 10);
    const m = Number.parseInt(mmRaw, 10);

    if (Number.isNaN(h) || Number.isNaN(m)) {
        return 'за --:--';
    }

    return `за ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function applyStageSettingsToUI(context = 'home') {
    const settings = getStageSettings();

    // 1) заполняем инпуты в модалке
    document.querySelectorAll('.time-input[data-setting]').forEach((input) => {
        const key = input.dataset.setting;
        if (!key) return;
        input.value = settings[key] || DEFAULT_STAGE_SETTINGS[key] || '00:00';
    });

    // 2) обновляем stage-card подписи "за ..."
    const prefix = context === 'hotel' ? 'hotel_' : 'home_';
    const map = {
        rest: `${prefix}rest`,
        wakeup: `${prefix}wakeup`,
        taxi: `${prefix}taxi`,
        exit: `${prefix}exit`
    };

    document.querySelectorAll('.stage-item').forEach((stageEl) => {
        const stage = stageEl.dataset.stage;
        const key = map[stage];
        if (!key) return;

        const countdownEl = stageEl.querySelector('.stage-countdown');
        if (!countdownEl) return;

        countdownEl.textContent = timeToPretty(settings[key]);
    });
}

function formatFlightTime(date) {
    return date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

function formatFlightDate(date) {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear().toString().slice(-2);
    return `${d}.${m}.${y}`;
}

function formatDuration(durationStr) {
    if (!durationStr || typeof durationStr !== 'string' || !durationStr.includes(':')) {
        return '- ч -- мин';
    }

    const [hh, mm] = durationStr.split(':');
    const h = Number.parseInt(hh, 10);
    const m = Number.parseInt(mm, 10);

    if (Number.isNaN(h) || Number.isNaN(m)) {
        return '- ч -- мин';
    }

    return `${h} ч ${m.toString().padStart(2, '0')} мин`;
}

function parseHHMMToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) {
        return 0;
    }

    const [hh, mm] = timeStr.split(':');
    const h = Number.parseInt(hh, 10);
    const m = Number.parseInt(mm, 10);

    if (Number.isNaN(h) || Number.isNaN(m)) {
        return 0;
    }

    return h * 60 + m;
}

function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
}

const STAGE_MIN_GAP_MINUTES = 5;

function roundToNearest5Minutes(dateObj) {
    const d = new Date(dateObj.getTime());
    const m = d.getMinutes();
    const rounded = Math.round(m / 5) * 5;
    d.setMinutes(rounded, 0, 0);
    return d;
}

function clampStageTime(dateObj) {
    if (!stageModalState.nextTime) return dateObj;

    const maxAllowed = addMinutes(stageModalState.nextTime, -STAGE_MIN_GAP_MINUTES);
    if (dateObj.getTime() > maxAllowed.getTime()) return maxAllowed;

    return dateObj;
}

function getSelectedDataSource() {
    return localStorage.getItem(FLIGHT_DATA_SOURCE_LS_KEY) || 'accord';
}

function setSelectedDataSource(source) {
    localStorage.setItem(FLIGHT_DATA_SOURCE_LS_KEY, source);
}

function getMainDataFromRoot(data) {
    const source = getSelectedDataSource();

    if (source === 'manual') {
        const manualData = getManualFlightData();
        if (manualData) return manualData;
    }

    if (!data || typeof data !== 'object') {
        return null;
    }

    if (data.sources) {
        if (source === 'calendar' && data.sources.calendar) {
            const d = { ...data.sources.calendar };
            if (!d._updatedAt && data._updatedAt) d._updatedAt = data._updatedAt;
            return d;
        }
        // default to accord
        if (data.sources.accord) {
            const d = { ...data.sources.accord };
            if (!d._updatedAt && data._updatedAt) d._updatedAt = data._updatedAt;
            return d;
        }
    }
    return data;
}

function getManualFlightData() {
    const raw = localStorage.getItem(MANUAL_FLIGHT_DATA_LS_KEY);
    return raw ? safeParseJson(raw) : null;
}

function saveManualFlightData(manualData) {
    localStorage.setItem(MANUAL_FLIGHT_DATA_LS_KEY, JSON.stringify(manualData));
}

function getCurrentContextFromFlightData(data) {
    if (!data) return 'home';

    const d = getMainDataFromRoot(data);
    const depIcao = d && d.departure && d.departure.icao ? d.departure.icao.toString().toUpperCase() : '';
    if (!depIcao) return 'home';
    return depIcao === 'UUEE' ? 'home' : 'hotel';
}

function getCurrentContextFromStorage() {
    const raw = localStorage.getItem(CREW_PORTAL_LS_KEY);
    const data = raw ? safeParseJson(raw) : null;
    return getCurrentContextFromFlightData(data);
}

function getFlightId(data) {
    if (!data || typeof data !== 'object') return '';

    const d = getMainDataFromRoot(data);
    if (!d) return '';

    const num = (d.number || '').toString().trim();
    const sd = (d.startDate || '').toString().trim();
    return `${num}__${sd}`;
}

function getAllStageOverrides() {
    const raw = localStorage.getItem(STAGE_OVERRIDES_LS_KEY);
    const parsed = raw ? safeParseJson(raw) : null;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
}

function getStageOverridesForFlight(data) {
    const all = getAllStageOverrides();
    const id = getFlightId(data);
    const o = id && all[id] && typeof all[id] === 'object' ? all[id] : {};
    return { ...o };
}

function saveStageOverrideForFlight(data, stageKey, isoStringOrNull) {
    const id = getFlightId(data);
    if (!id) return;

    const all = getAllStageOverrides();
    const current = all[id] && typeof all[id] === 'object' ? all[id] : {};

    if (isoStringOrNull) {
        current[stageKey] = isoStringOrNull;
    } else {
        delete current[stageKey];
    }

    all[id] = current;
    localStorage.setItem(STAGE_OVERRIDES_LS_KEY, JSON.stringify(all));
}

function markOverriddenStages(data) {
    const overrides = getStageOverridesForFlight(data);
    document.querySelectorAll('.stage-item').forEach((el) => {
        const key = el.dataset.stage;
        const isEditable = key && key !== 'rest' && key !== 'sleep';
        el.classList.toggle('stage-overridden', isEditable && !!overrides[key]);
    });
}

function applyStageLabelsForContext(context) {
    const taxiStage = document.querySelector('.stage-item[data-stage="taxi"]');
    const exitStage = document.querySelector('.stage-item[data-stage="exit"]');

    if (taxiStage) {
        const labelEl = taxiStage.querySelector('.stage-label');
        const iconEl = taxiStage.querySelector('.stage-icon i');

        if (context === 'hotel') {
            if (labelEl) labelEl.textContent = 'Выход';
            if (iconEl) {
                iconEl.classList.remove('fa-taxi');
                iconEl.classList.add('fa-door-open');
            }
        } else {
            if (labelEl) labelEl.textContent = 'Такси';
            if (iconEl) {
                iconEl.classList.remove('fa-door-open');
                iconEl.classList.add('fa-taxi');
            }
        }
    }

    if (exitStage) {
        const labelEl = exitStage.querySelector('.stage-label');
        const iconEl = exitStage.querySelector('.stage-icon i');

        if (context === 'hotel') {
            if (labelEl) labelEl.textContent = 'Выезд';
            if (iconEl) {
                iconEl.classList.remove('fa-door-open');
                iconEl.classList.add('fa-taxi');
            }
        } else {
            if (labelEl) labelEl.textContent = 'Выход';
            if (iconEl) {
                iconEl.classList.remove('fa-taxi');
                iconEl.classList.add('fa-door-open');
            }
        }
    }
}

function updateStageTimesFromFlight(data) {
    const stages = document.querySelectorAll('.stage-item');
    if (!stages.length) return;

    // Получаем данные с учетом выбранного источника
    const d = getMainDataFromRoot(data);

    if (!d || typeof d !== 'object') {
        stages.forEach((el) => {
            const timeEl = el.querySelector('.stage-time');
            if (timeEl) timeEl.textContent = '--:--';
        });
        return;
    }

    if (!d || !d.startDate) {
        stages.forEach((el) => {
            const timeEl = el.querySelector('.stage-time');
            if (timeEl) timeEl.textContent = '--:--';
        });
        return;
    }

    const startDate = new Date(d.startDate);
    if (Number.isNaN(startDate.getTime())) {
        stages.forEach((el) => {
            const timeEl = el.querySelector('.stage-time');
            if (timeEl) timeEl.textContent = '--:--';
        });
        return;
    }

    const context = getCurrentContextFromFlightData(data);
    applyStageLabelsForContext(context);
    applyStageSettingsToUI(context);

    const settings = getStageSettings();
    const prefix = context === 'hotel' ? 'hotel_' : 'home_';

    const exitOffsetMin = parseHHMMToMinutes(settings[`${prefix}exit`]);
    const taxiOffsetMin = parseHHMMToMinutes(settings[`${prefix}taxi`]);
    const wakeupOffsetMin = parseHHMMToMinutes(settings[`${prefix}wakeup`]);
    const restOffsetMin = parseHHMMToMinutes(settings[`${prefix}rest`]);

    const sleepDurationMin = (sleepHours * 60) + sleepMinutes;

    const tExit = addMinutes(startDate, -exitOffsetMin);
    const tTaxi = addMinutes(tExit, -taxiOffsetMin);
    const tWake = addMinutes(tTaxi, -wakeupOffsetMin);
    const tSleep = addMinutes(tWake, -sleepDurationMin);
    const tRest = addMinutes(tSleep, -restOffsetMin);

    const baseMap = {
        rest: tRest,
        sleep: tSleep,
        wakeup: tWake,
        taxi: tTaxi,
        exit: tExit
    };

    // Apply per-flight overrides (local only for the current рейс)
    const overrides = getStageOverridesForFlight(data);
    const map = { ...baseMap };

    // Order: apply from поздних к ранним, и пересчитываем только этапы ДО выбранного
    const editable = ['exit', 'taxi', 'wakeup'];

    editable.forEach((key) => {
        const iso = overrides[key];
        if (!iso) return;

        const dTime = new Date(iso);
        if (Number.isNaN(dTime.getTime())) return;

        const nextKey = key === 'wakeup' ? 'taxi' : (key === 'taxi' ? 'exit' : null);
        const nextTime = nextKey ? map[nextKey] : null;

        let edited = dTime;
        if (nextTime && edited.getTime() > addMinutes(nextTime, -STAGE_MIN_GAP_MINUTES).getTime()) {
            edited = addMinutes(nextTime, -STAGE_MIN_GAP_MINUTES);
        }

        map[key] = edited;

        // Recompute earlier stages based on offsets
        if (key === 'exit') {
            map.taxi = addMinutes(map.exit, -taxiOffsetMin);
            map.wakeup = addMinutes(map.taxi, -wakeupOffsetMin);
            map.sleep = addMinutes(map.wakeup, -sleepDurationMin);
            map.rest = addMinutes(map.sleep, -restOffsetMin);
        } else if (key === 'taxi') {
            map.wakeup = addMinutes(map.taxi, -wakeupOffsetMin);
            map.sleep = addMinutes(map.wakeup, -sleepDurationMin);
            map.rest = addMinutes(map.sleep, -restOffsetMin);
        } else if (key === 'wakeup') {
            map.sleep = addMinutes(map.wakeup, -sleepDurationMin);
            map.rest = addMinutes(map.sleep, -restOffsetMin);
        }
    });

    lastStageTimeline = {
        flightStart: startDate,
        times: map,
        baseTimes: baseMap
    };

    markOverriddenStages(data);
    updateNextStageCountdown();

    document.querySelectorAll('.stage-item').forEach((el) => {
        const key = el.dataset.stage;
        const timeEl = el.querySelector('.stage-time');
        if (!timeEl) return;

        const dateVal = map[key];
        if (!dateVal || Number.isNaN(dateVal.getTime())) {
            timeEl.textContent = '--:--';
            return;
        }

        timeEl.textContent = formatFlightTime(dateVal);
    });
}

let lastStageTimeline = null;

function formatRemainingMs(ms) {
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    let res = '';
    if (days > 0) res += `${days} д `;
    if (hours > 0 || days > 0) res += `${hours} ч `;
    res += `${minutes.toString().padStart(2, '0')} мин`;

    return res.trim();
}

function formatRemainingMsShort(ms) {
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    let res = '';
    if (days > 0) res += `${days} д `;
    res += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    return res.trim();
}

function formatUpdatedAgoShort(isoString) {
    if (!isoString) return '--';

    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return '--';

    const diffMs = Date.now() - d.getTime();
    if (diffMs < 60 * 1000) return 'Только что';

    const totalMin = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMin / 60);

    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        return `${days} д назад`;
    }

    if (hours >= 1) {
        return `${hours} ч назад`;
    }

    return `${totalMin} мин назад`;
}

function updateUpdatedBadgeRealtime() {
    const raw = localStorage.getItem(CREW_PORTAL_LS_KEY);
    if (!raw) return;

    const data = safeParseJson(raw);
    if (!data || !data._updatedAt) return;

    const updatedText = document.getElementById('updated-text');
    if (!updatedText) return;

    updatedText.textContent = formatUpdatedAgoShort(data._updatedAt);
}

function setCountdownCard(iconClasses, labelText, timeText) {
    const iconEl = document.getElementById('next-stage-icon');
    const labelEl = document.getElementById('next-stage-label');
    const timeEl = document.getElementById('next-stage-time');

    if (iconEl && Array.isArray(iconClasses)) {
        iconEl.className = iconClasses.join(' ');
    }
    if (labelEl) labelEl.textContent = labelText;
    if (timeEl) timeEl.textContent = timeText;
}

function getStageCountdownLabel(stageKey, stageEl) {
    if (stageKey === 'rest') return 'До отдыха';
    if (stageKey === 'sleep') return 'До отбоя';
    if (stageKey === 'wakeup') return 'До подъёма';

    const label = stageEl?.querySelector('.stage-label')?.textContent?.trim() || '';

    if (stageKey === 'taxi') {
        if (label.toLowerCase() === 'такси') return 'До вызова такси';
        return label ? `До ${label.toLowerCase()}` : 'До следующего этапа';
    }

    if (stageKey === 'exit') {
        return label ? `До ${label.toLowerCase()}` : 'До выхода';
    }

    return 'До следующего этапа';
}

function highlightActiveStage(stageKey) {
    document.querySelectorAll('.stage-item').forEach((el) => {
        el.classList.toggle('stage-active', stageKey && el.dataset.stage === stageKey);
    });
}

function updateNextStageCountdown() {
    if (!lastStageTimeline || !lastStageTimeline.flightStart) {
        highlightActiveStage(null);
        setCountdownCard(['fa-regular', 'fa-hourglass'], 'Загружаем информацию', '- ч -- мин');
        // Очистить countdown'ы в этапах
        document.querySelectorAll('.stage-item').forEach(el => {
            const countdownEl = el.querySelector('.stage-countdown');
            if (countdownEl) countdownEl.textContent = '--';
        });
        return;
    }

    const now = new Date();
    const sleepEnabled = getSleepEnabled();

    const order = ['rest', 'sleep', 'wakeup', 'taxi', 'exit'];
    const candidates = order.filter((k) => {
        if (!sleepEnabled && (k === 'rest' || k === 'sleep')) return false;
        return true;
    });

    // Обновляем countdown для каждого этапа
    document.querySelectorAll('.stage-item').forEach(el => {
        const stageKey = el.dataset.stage;
        if (!stageKey) return;

        const countdownEl = el.querySelector('.stage-countdown');
        if (!countdownEl) return;

        const stageTime = lastStageTimeline.times?.[stageKey];
        if (!stageTime || Number.isNaN(stageTime.getTime())) {
            countdownEl.textContent = '--';
            return;
        }

        // Определяем время следующего этапа
        let nextTime = null;
        if (stageKey === 'rest') nextTime = lastStageTimeline.times?.['sleep'];
        else if (stageKey === 'sleep') nextTime = lastStageTimeline.times?.['wakeup'];
        else if (stageKey === 'wakeup') nextTime = lastStageTimeline.times?.['taxi'];
        else if (stageKey === 'taxi') nextTime = lastStageTimeline.times?.['exit'];
        else if (stageKey === 'exit') nextTime = lastStageTimeline.flightStart;

        if (!nextTime || Number.isNaN(nextTime.getTime())) {
            countdownEl.textContent = '--';
            return;
        }

        const diffMs = nextTime.getTime() - stageTime.getTime();
        if (diffMs <= 0) {
            countdownEl.textContent = 'за 00:00';
        } else {
            const rem = formatRemainingMsShort(diffMs);
            countdownEl.textContent = `за ${rem}`;
        }
    });

    let nextKey = null;
    let nextTime = null;

    candidates.forEach((k) => {
        const t = lastStageTimeline.times?.[k];
        if (!t || Number.isNaN(t.getTime())) return;
        if (t.getTime() <= now.getTime()) return;

        if (!nextTime || t.getTime() < nextTime.getTime()) {
            nextTime = t;
            nextKey = k;
        }
    });

    if (nextKey && nextTime) {
        const stageEl = document.querySelector(`.stage-item[data-stage="${nextKey}"]`);
        const stageIconEl = stageEl ? stageEl.querySelector('.stage-icon i') : null;

        const iconClasses = stageIconEl ? stageIconEl.className.split(' ') : ['fa-regular', 'fa-hourglass'];
        const labelText = getStageCountdownLabel(nextKey, stageEl);
        const remaining = formatRemainingMs(nextTime.getTime() - now.getTime());

        highlightActiveStage(nextKey);
        setCountdownCard(iconClasses, labelText, remaining);
        return;
    }

    // Все этапы прошли -> показываем до вылета
    const flightStart = lastStageTimeline.flightStart;
    if (flightStart && !Number.isNaN(flightStart.getTime()) && flightStart.getTime() > now.getTime()) {
        highlightActiveStage(null);
        setCountdownCard(['fas', 'fa-plane-departure'], 'До вылета', formatRemainingMs(flightStart.getTime() - now.getTime()));
        return;
    }

    highlightActiveStage(null);
    setCountdownCard(['fas', 'fa-plane-departure'], 'Вылет уже прошёл', '0 ч 00 мин');
}

function setFlightCardDashes() {
    const flightCard = document.getElementById('flight-card');
    if (!flightCard) return;

    const flightNumberEl = flightCard.querySelector('.flight-number');
    const flightTimeEl = flightCard.querySelector('.flight-time');
    const flightDateEl = flightCard.querySelector('.flight-date');
    const flightDurationEl = flightCard.querySelector('.flight-duration');

    if (flightNumberEl) flightNumberEl.textContent = 'SU ----';
    if (flightTimeEl) flightTimeEl.textContent = '--:--';
    if (flightDateEl) flightDateEl.textContent = '-- --- ----';
    if (flightDurationEl) flightDurationEl.textContent = '- ч -- мин';

    const airports = flightCard.querySelectorAll('.flight-route .airport');
    if (airports.length >= 2) {
        const depCode = airports[0].querySelector('.airport-code');
        const depName = airports[0].querySelector('.airport-name');
        const arrCode = airports[1].querySelector('.airport-code');
        const arrName = airports[1].querySelector('.airport-name');

        if (depCode) depCode.textContent = '--- / ----';
        if (depName) depName.textContent = '------';
        if (arrCode) arrCode.textContent = '--- / ----';
        if (arrName) arrName.textContent = '------';
    }

    document.querySelectorAll('.stage-item .stage-time').forEach((el) => {
        el.textContent = '--:--';
    });

    lastStageTimeline = null;
    updateNextStageCountdown();

    document.querySelectorAll('.stage-item').forEach((el) => el.classList.remove('stage-overridden'));

    // Pilot badge: when there is no data -> show loading style
    const badgeEl = flightCard.querySelector('.pilot-badge');
    const badgeIconEl = badgeEl ? badgeEl.querySelector('i') : null;
    const badgeTextEl = badgeEl ? badgeEl.querySelector('.pilot-badge-text') : null;

    if (badgeEl) {
        // Нейтральный вид, чтобы не выглядеть как warning
        badgeEl.classList.add('pilot-badge--passenger');
        badgeEl.classList.remove('pilot-badge--work');
        badgeEl.title = 'Загружаем информацию';
    }

    if (badgeIconEl) {
        badgeIconEl.classList.remove('fa-plane', 'fa-suitcase-rolling', 'fa-briefcase');
        badgeIconEl.classList.add('fa-hourglass');
    }

    if (badgeTextEl) {
        badgeTextEl.textContent = '--';
    }

    // Location badge: when there is no data -> show loading style
    const locationEl = flightCard.querySelector('.location-badge');
    const locationIconEl = locationEl ? locationEl.querySelector('i') : null;
    const locationTextEl = locationEl ? locationEl.querySelector('.location-badge-text') : null;

    if (locationEl) {
        // Снимаем режимы, и ставим нейтральный “loading” вид
        locationEl.classList.remove('location-badge--home', 'location-badge--hotel');

        // ВАЖНО: это inline-стиль только для режима "нет данных"
        locationEl.style.background = 'linear-gradient(135deg, #8E8E93, #636366)';
        locationEl.style.boxShadow = '0 2px 8px rgba(142, 142, 147, 0.22)';

        locationEl.title = 'Загружаем информацию';
    }

    if (locationIconEl) {
        locationIconEl.classList.remove('fa-home', 'fa-hotel');
        locationIconEl.classList.add('fa-hourglass');
    }

    if (locationTextEl) {
        locationTextEl.textContent = '--';
    }

    const sourceText = document.getElementById('data-source-text');
    if (sourceText) sourceText.textContent = 'Аккорд';

    setWebTimeBadge('empty', 'WEB: -', ['fas', 'fa-circle-question']);

    const updatedText = document.getElementById('updated-text');
    if (updatedText) updatedText.textContent = '--';

    const details = document.getElementById('web-time-details');
    const webDt = document.getElementById('web-start-datetime');
    const deltaEl = document.getElementById('web-start-delta');
    if (details) details.style.display = 'none';
    if (webDt) webDt.textContent = '--:--, -- --- ----';
    if (deltaEl) deltaEl.textContent = '--';
}

function updateFlightCardFromData(data) {
    const flightCard = document.getElementById('flight-card');
    if (!flightCard) return;

    // Обработка новой структуры данных от сервера
    const mainData = getMainDataFromRoot(data);

    if (!mainData) {
        setFlightCardDashes();
        return;
    }
    let webStartDateStr = data && data.startDateWeb;

    if (data && data.sources && data.sources.web && data.sources.web.startDate) {
        webStartDateStr = data.sources.web.startDate;
    }

    // Clear inline loading styles (setFlightCardDashes uses inline background/shadow)
    const locationInline = flightCard.querySelector('.location-badge');
    if (locationInline) {
        locationInline.style.background = '';
        locationInline.style.boxShadow = '';
    }

    // Refresh time-difference badge state when new data is applied
    updateTimeDifferenceByDepartureIcao();

    const startDateStr = mainData ? mainData.startDate : null;
    const startDate = startDateStr ? new Date(startDateStr) : null;
    updateStageTimesFromFlight(mainData);

    const flightNumberEl = flightCard.querySelector('.flight-number');
    const flightTimeEl = flightCard.querySelector('.flight-time');
    const flightDateEl = flightCard.querySelector('.flight-date');
    const flightDurationEl = flightCard.querySelector('.flight-duration');

    // Pilot badge update based on mainData.isWork
    const badgeEl = flightCard.querySelector('.pilot-badge');
    const badgeIconEl = badgeEl ? badgeEl.querySelector('i') : null;
    const badgeTextEl = badgeEl ? badgeEl.querySelector('.pilot-badge-text') : null;

    if (!mainData) {
        setFlightCardDashes();
        return;
    }

    const isWork = mainData.isWork === true;

    if (badgeEl) {
        badgeEl.classList.toggle('pilot-badge--work', isWork);
        badgeEl.classList.toggle('pilot-badge--passenger', !isWork);
        badgeEl.title = isWork ? 'Рабочий рейс' : 'Пассажиром';
    }

    if (badgeIconEl) {
        badgeIconEl.classList.remove('fa-plane', 'fa-suitcase-rolling', 'fa-briefcase');
        badgeIconEl.classList.add(isWork ? 'fa-plane' : 'fa-suitcase-rolling');
    }

    if (badgeTextEl) {
        badgeTextEl.textContent = isWork ? 'Рабочий' : 'Пасс';
    }

    // Location badge: if departure.icao === 'UUEE' -> Из дома, else -> Из отеля
    const locationEl = flightCard.querySelector('.location-badge');
    const locationIconEl = locationEl ? locationEl.querySelector('i') : null;
    const locationTextEl = locationEl ? locationEl.querySelector('.location-badge-text') : null;

    const depIcaoForLocation = (mainData.departure && mainData.departure.icao) ? mainData.departure.icao.toString().toUpperCase() : '';
    const isHome = depIcaoForLocation === 'UUEE';

    if (locationEl) {
        locationEl.classList.toggle('location-badge--home', isHome);
        locationEl.classList.toggle('location-badge--hotel', !isHome);
        locationEl.title = isHome ? 'Из дома' : 'Из отеля';
    }

    if (locationIconEl) {
        locationIconEl.classList.remove('fa-home', 'fa-hotel');
        locationIconEl.classList.add(isHome ? 'fa-home' : 'fa-hotel');
    }

    if (locationTextEl) {
        locationTextEl.textContent = isHome ? 'Из дома' : 'Из отеля';
    }

    if (flightNumberEl) {
        const number = (mainData.number || '').toString().trim();
        flightNumberEl.textContent = number ? number : 'SU ----';
    }

    if (startDate && !Number.isNaN(startDate.getTime())) {
        if (flightTimeEl) flightTimeEl.textContent = formatFlightTime(startDate);
        if (flightDateEl) flightDateEl.textContent = formatFlightDate(startDate);
    } else {
        if (flightTimeEl) flightTimeEl.textContent = '--:--';
        if (flightDateEl) flightDateEl.textContent = '-- --- ----';
    }

    if (flightDurationEl) {
        if (getSelectedDataSource() === 'manual') {
            flightDurationEl.style.display = 'none';
        } else {
            flightDurationEl.style.display = 'block';
            flightDurationEl.textContent = formatDuration(mainData.duration);
        }
    }

    // Источник данных
    updateDataSourceBadge(getSelectedDataSource());

    // Сверка времени (startDate vs startDateWeb) — кратко в бейдже
    const startDateWebStr = webStartDateStr;
    const startDateWeb = startDateWebStr ? new Date(startDateWebStr) : null;

    if (!startDateWebStr || !startDateWeb || Number.isNaN(startDateWeb.getTime())) {
        setWebTimeBadge('empty', 'WEB: -', ['fas', 'fa-circle-question']);
    } else {
        const webFlightNum = (data.sources?.web?.number || '').toString().trim();
        const webDepIcao = (data.sources?.web?.departure?.icao || '').toString().trim().toUpperCase();
        const mainFlightNum = (mainData.number || '').toString().trim();
        const mainDepIcao = (mainData.departure?.icao || '').toString().trim().toUpperCase();
        
        const isTimeMatch = startDate && !Number.isNaN(startDate.getTime()) && startDateWeb.getTime() === startDate.getTime();
        const isNumMatch = webFlightNum === mainFlightNum;
        const isIcaoMatch = webDepIcao === mainDepIcao;

        if (isTimeMatch && isNumMatch && isIcaoMatch) {
            setWebTimeBadge('success', 'WEB', ['fas', 'fa-check']);
        } else {
            setWebTimeBadge('warning', 'WEB', ['fas', 'fa-triangle-exclamation']);
        }
    }

    const updatedText = document.getElementById('updated-text');
    if (updatedText) updatedText.textContent = formatUpdatedAgoShort(mainData._updatedAt);

    const airports = flightCard.querySelectorAll('.flight-route .airport');
    if (airports.length >= 2) {
        const depCode = airports[0].querySelector('.airport-code');
        const depName = airports[0].querySelector('.airport-name');
        const arrCode = airports[1].querySelector('.airport-code');
        const arrName = airports[1].querySelector('.airport-name');

        if (mainData && mainData.departure && mainData.arrival) {
            const dep = mainData.departure;
            const arr = mainData.arrival;

            const depIata = (dep.iata || '---').toString();
            const depIcao = (dep.icao || '----').toString();
            const arrIata = (arr.iata || '---').toString();
            const arrIcao = (arr.icao || '----').toString();

            if (depCode) {
                if (dep.iata || dep.icao) {
                    depCode.textContent = `${depIata} / ${depIcao}`;
                } else {
                    depCode.textContent = '--- / ----';
                }
            }
            if (depName) {
                const name = (dep.city || '------').toString();
                depName.textContent = name.length > 14 ? name.slice(0, 14) : name;
            }

            if (arrCode) {
                if (arr.iata || arr.icao) {
                    arrCode.textContent = `${arrIata} / ${arrIcao}`;
                } else {
                    arrCode.textContent = '--- / ----';
                }
            }
            if (arrName) {
                const name = (arr.city || '------').toString();
                arrName.textContent = name.length > 14 ? name.slice(0, 14) : name;
            }
        } else {
            if (depCode) depCode.textContent = '--- / ----';
            if (depName) depName.textContent = '------';
            if (arrCode) arrCode.textContent = '--- / ----';
            if (arrName) arrName.textContent = '------';
        }
    }
}

function updateFlightCardFromStorage() {
    try {
        const source = getSelectedDataSource();
        const raw = localStorage.getItem(CREW_PORTAL_LS_KEY);
        const data = raw ? safeParseJson(raw) : null;

        // Если выбран ручной режим, мы можем обновиться даже если raw данных нет
        if (source === 'manual') {
            updateFlightCardFromData(data);
            return;
        }

        if (!data) {
            setFlightCardDashes();
            return;
        }

        updateFlightCardFromData(data);
    } catch (err) {
        console.warn('Error updating flight card from storage:', err);
        setFlightCardDashes();
    }
}

// Функция для получения московского времени
function getMoscowTime() {
    const now = new Date();
    // getTimezoneOffset = сколько минут нужно ДОБАВИТЬ к местному, чтобы получить UTC
    const localOffset = now.getTimezoneOffset(); // например Литва = -120
    const utc = new Date(now.getTime() + localOffset * 60000);

    // Москва = UTC+3
    return new Date(utc.getTime() + 3 * 60 * 60000);
}

// Функция для форматирования времени и даты
function formatTime(date) {
    return date.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

function formatDate(date) {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear().toString().slice(-2);
    return `${d}.${m}.${y}`;
}

function setWebTimeBadge(state, text, iconClasses) {
    const badge = document.getElementById('web-time-badge');
    const textEl = document.getElementById('web-time-text');
    const iconEl = badge ? badge.querySelector('i') : null;
    if (!badge || !textEl || !iconEl) return;

    badge.classList.remove('meta-badge--success', 'meta-badge--error', 'meta-badge--warning', 'meta-badge--empty');
    badge.classList.add(
        state === 'success' ? 'meta-badge--success'
        : state === 'warning' ? 'meta-badge--warning'
        : state === 'error' ? 'meta-badge--error'
        : 'meta-badge--empty'
    );

    textEl.textContent = text;

    iconEl.className = '';
    iconClasses.forEach(c => iconEl.classList.add(c));
}

function formatSignedDeltaMinutes(deltaMinutes) {
    const sign = deltaMinutes >= 0 ? '+' : '−';
    const abs = Math.abs(deltaMinutes);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return `${sign}${h}:${m.toString().padStart(2, '0')}`;
}

// Функция для вычисления разницы во времени с поддержкой минутных смещений (например, +3:30)
function calculateTimeDifference(moscowDate, localDate) {
    const moscowTime = moscowDate.getTime();
    const localTime = localDate.getTime();

    const diffMs = localTime - moscowTime;
    const diffMinutesTotal = Math.round(diffMs / (1000 * 60));

    const sign = diffMinutesTotal >= 0 ? '+' : '−';
    const absMinutes = Math.abs(diffMinutesTotal);

    const hours = Math.floor(absMinutes / 60);
    const minutes = absMinutes % 60;

    // формат: +3:30, −1:00
    return `${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
}

function getTimeZoneOffsetMinutes(timeZone, date) {
    // Returns offset minutes from UTC for the given IANA timeZone at the given date
    // Example: Moscow (Europe/Moscow) ~ +180
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    const parts = dtf.formatToParts(date).reduce((acc, part) => {
        if (part.type !== 'literal') {
            acc[part.type] = part.value;
        }
        return acc;
    }, {});

    const asUtcMs = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second)
    );

    return Math.round((asUtcMs - date.getTime()) / 60000);
}

function setTimeDifferenceStatus(status, titleText = '') {
    const el = document.getElementById('time-difference');
    if (!el) return;

    el.classList.remove('time-difference--success', 'time-difference--error', 'time-difference--empty');

    if (status === 'success') {
        el.classList.add('time-difference--success');
    } else if (status === 'error') {
        el.classList.add('time-difference--error');
    } else {
        el.classList.add('time-difference--empty');
    }

    if (titleText) {
        el.title = titleText;
    } else {
        el.removeAttribute('title');
    }
}

function updateTimeDifferenceByDepartureIcao() {
    const now = new Date();
    const source = getSelectedDataSource();
    let data = null;

    // Для ручного режима берем данные из manual_flight_data
    if (source === 'manual') {
        data = getManualFlightData();
    } else {
        const raw = localStorage.getItem(CREW_PORTAL_LS_KEY);
        data = raw ? safeParseJson(raw) : null;
    }

    if (!data) {
        setTimeDifferenceStatus('empty', 'Нет данных о рейсе');
        return;
    }

    const mainData = getMainDataFromRoot(data);
    const depIcao = mainData && mainData.departure && mainData.departure.icao ? mainData.departure.icao.toString().toUpperCase() : '';

    if (!depIcao) {
        setTimeDifferenceStatus('empty', 'Не указан ICAO вылета');
        return;
    }

    // airports_tz is provided by assets/data/airports_tz.js
    if (typeof airports_tz === 'undefined' || !airports_tz || typeof airports_tz !== 'object') {
        setTimeDifferenceStatus('empty', 'Справочник таймзон не загружен');
        return;
    }

    const tz = airports_tz[depIcao];
    if (!tz) {
        setTimeDifferenceStatus('empty', `Нет таймзоны для ${depIcao}`);
        return;
    }

    const deviceOffset = -now.getTimezoneOffset();
    const depOffset = getTimeZoneOffsetMinutes(tz, now);

    if (deviceOffset === depOffset) {
        setTimeDifferenceStatus('success', `ОК: устройство совпадает с ${depIcao} (${tz})`);
    } else {
        setTimeDifferenceStatus('error', `Не совпадает: устройство ${deviceOffset} мин, ${depIcao} ${depOffset} мин (${tz})`);
    }
}

// Управление настройками сна
let sleepHours = 9;
let sleepMinutes = 0;

function updateSleepDisplay() {
    const sleepValueElement = document.getElementById('sleep-value');
    const decreaseButton = document.getElementById('sleep-decrease');
    const increaseButton = document.getElementById('sleep-increase');
    const sleepToggle = document.getElementById('sleep-toggle');

    if (sleepValueElement) {
        sleepValueElement.textContent = `${sleepHours}:${sleepMinutes.toString().padStart(2, '0')}`;
    }

    // Если сон выключен — контролы недоступны
    if (sleepToggle && sleepToggle.checked === false) {
        if (decreaseButton) decreaseButton.disabled = true;
        if (increaseButton) increaseButton.disabled = true;
        return;
    }

    // Блокировка кнопок при достижении границ
    if (decreaseButton) {
        decreaseButton.disabled = sleepHours === 0 && sleepMinutes === 30;
    }
    if (increaseButton) {
        increaseButton.disabled = sleepHours === 15 && sleepMinutes === 0;
    }
}

function changeSleepTime(minutes) {
    const totalMinutes = sleepHours * 60 + sleepMinutes + minutes;

    // Проверка границ (от 30 минут до 15 часов)
    if (totalMinutes < 30) return;
    if (totalMinutes > 15 * 60) return;

    sleepHours = Math.floor(totalMinutes / 60);
    sleepMinutes = totalMinutes % 60;

    updateSleepDisplay();
    try {
        const raw = localStorage.getItem(CREW_PORTAL_LS_KEY);
        const data = raw ? safeParseJson(raw) : null;
        updateStageTimesFromFlight(data);
    } catch {
        // ignore
    }
    updateNextStageCountdown();
}

// Управление модальными окнами
function openSettingsModal() {
    applyStageSettingsToUI(getCurrentContextFromStorage());
    applyAuthToUI();
    document.getElementById('settings-modal').style.display = 'flex';
}

function closeSettingsModal() {
    document.getElementById('settings-modal').style.display = 'none';
}

let stageModalState = {
    flightData: null,
    stageKey: null,
    baseTime: null,
    currentTime: null,
    nextKey: null,
    nextTime: null
};

function stageTitleByKey(stageKey, stageEl) {
    const label = stageEl?.querySelector('.stage-label')?.textContent?.trim() || '';
    if (stageKey === 'wakeup') return 'Время подъёма';
    if (stageKey === 'taxi') {
        if (label.toLowerCase() === 'такси') return 'Время такси';
        return `Время ${label.toLowerCase()}`;
    }
    if (stageKey === 'exit') {
        return `Время ${label ? label.toLowerCase() : 'выхода'}`;
    }
    return 'Редактирование этапа';
}

function nextLabelByKey(nextKey, nextStageEl) {
    if (!nextKey) return 'До вылета:';

    // Используем уже готовые формулировки как в countdown-card
    const label = getStageCountdownLabel(nextKey, nextStageEl); // например "До вызова такси"
    return `${label}:`;
}

function setStageModalTime(dateObj) {
    stageModalState.currentTime = dateObj;

    const input = document.getElementById('modal-time-input');
    if (input) input.value = formatFlightTime(dateObj);

    const nextEl = document.getElementById('modal-next-stage');
    if (nextEl && stageModalState.nextTime) {
        const ms = stageModalState.nextTime.getTime() - dateObj.getTime();
        nextEl.textContent = formatRemainingMs(ms);
    }
}

function openStageModal(stageElement) {
    const stageKey = stageElement.dataset.stage;

    // Не редактируем: отдых и отбой
    if (!stageKey || stageKey === 'rest' || stageKey === 'sleep') return;

    const source = getSelectedDataSource();
    let flightData = null;

    // Для ручного режима берем данные из manual_flight_data
    if (source === 'manual') {
        flightData = getManualFlightData();
    } else {
        const raw = localStorage.getItem(CREW_PORTAL_LS_KEY);
        flightData = raw ? safeParseJson(raw) : null;
    }

    if (!flightData) return;

    // Гарантируем, что таймлайн актуален
    updateStageTimesFromFlight(flightData);

    const modal = document.getElementById('stage-modal');
    const modalTitle = document.getElementById('modal-stage-title');
    const calcEl = document.getElementById('modal-calculated-time');
    const nextLabelEl = document.getElementById('modal-next-stage-label');

    const times = lastStageTimeline?.times || null;
    const baseTimes = lastStageTimeline?.baseTimes || null;

    const baseTime = baseTimes?.[stageKey];
    const currentTime = times?.[stageKey];

    const nextKey = stageKey === 'wakeup' ? 'taxi' : (stageKey === 'taxi' ? 'exit' : null);

    // Если следующего этапа нет (последний этап) — считаем до вылета
    const nextTime = nextKey ? times?.[nextKey] : lastStageTimeline?.flightStart || null;

    if (!currentTime || Number.isNaN(currentTime.getTime())) return;

    stageModalState = {
        flightData,
        stageKey,
        baseTime: baseTime && !Number.isNaN(baseTime.getTime()) ? baseTime : currentTime,
        currentTime,
        nextKey,
        nextTime: nextTime && !Number.isNaN(nextTime.getTime()) ? nextTime : null
    };

    if (modalTitle) modalTitle.textContent = stageTitleByKey(stageKey, stageElement);
    if (calcEl) calcEl.textContent = stageModalState.baseTime ? formatFlightTime(stageModalState.baseTime) : '--:--';

    if (nextLabelEl) {
        if (!nextKey) {
            nextLabelEl.textContent = 'До вылета:';
        } else {
            const nextStageEl = document.querySelector(`.stage-item[data-stage="${nextKey}"]`);
            nextLabelEl.textContent = nextLabelByKey(nextKey, nextStageEl);
        }
    }

    // Показать текущее время (с clamp)
    setStageModalTime(clampStageTime(new Date(stageModalState.currentTime.getTime())));

    // input скрыт при открытии
    const input = document.getElementById('modal-time-input');
    const btn = document.getElementById('modal-time-value');
    if (btn) btn.style.display = 'flex';

    if (modal) modal.style.display = 'flex';
}

function closeStageModal() {
    const modal = document.getElementById('stage-modal');
    if (modal) modal.style.display = 'none';
}

function updateDataSourceBadge(source) {
    const badge = document.getElementById('data-source-badge');
    const text = document.getElementById('data-source-text');
    const icon = badge ? badge.querySelector('i') : null;
    
    if (!badge || !text || !icon) return;

    badge.classList.remove('meta-badge--source', 'meta-badge--source-calendar', 'meta-badge--source-manual');
    
    if (source === 'calendar') {
        text.textContent = 'Календарь';
        badge.classList.add('meta-badge--source-calendar');
        icon.className = 'fas fa-calendar-alt';
    } else if (source === 'manual') {
        text.textContent = 'Вручную';
        badge.classList.add('meta-badge--source-manual');
        icon.className = 'fas fa-edit';
    } else {
        text.textContent = 'Аккорд';
        badge.classList.add('meta-badge--source');
        icon.className = 'fas fa-database';
    }
}

function getGmtOffsetVsMoscow(icao, date) {
    if (!icao || !date || typeof airports_tz === 'undefined') return null;
    const tz = airports_tz[icao.toString().toUpperCase()];
    if (!tz) return null;

    const moscowTz = 'Europe/Moscow';
    const moscowOffset = getTimeZoneOffsetMinutes(moscowTz, date);
    const targetOffset = getTimeZoneOffsetMinutes(tz, date);

    const diffMinutes = targetOffset - moscowOffset;
    if (diffMinutes === 0) return 'МСК';

    const diffHours = diffMinutes / 60;
    const sign = diffHours > 0 ? '+' : '';
    return `МСК${sign}${diffHours}`;
}

function openFlightModal() {
    const raw = localStorage.getItem(CREW_PORTAL_LS_KEY);
    const data = raw ? safeParseJson(raw) : null;
    const currentSource = getSelectedDataSource();
    const manualData = getManualFlightData();
    
    // Показываем/скрываем блок ручного ввода
    const manualSection = document.getElementById('manual-input-section');
    if (manualSection) {
        manualSection.style.display = currentSource === 'manual' ? 'block' : 'none';
        
        if (currentSource === 'manual' && manualData) {
            const flightNumInput = document.getElementById('manual-flight-number');
            const depIcaoInput = document.getElementById('manual-dep-icao');
            const arrIcaoInput = document.getElementById('manual-arr-icao');
            const dateInput = document.getElementById('manual-departure-date');
            const timeInput = document.getElementById('manual-departure-time');

            // Убираем "SU " из номера рейса для отображения в поле ввода
            const displayNumber = (manualData.number || '').replace(/^SU\s*/i, '');
            if (flightNumInput) flightNumInput.value = displayNumber;
            if (depIcaoInput) depIcaoInput.value = manualData.departure?.icao || '';
            if (arrIcaoInput) arrIcaoInput.value = manualData.arrival?.icao || '';

            if (manualData.startDate) {
                const utcDate = new Date(manualData.startDate);
                const depIcao = manualData.departure?.icao || '';
                const tz = (typeof airports_tz !== 'undefined' && airports_tz[depIcao]) || 'UTC';

                // Конвертируем UTC в местное время аэропорта
                const dtf = new Intl.DateTimeFormat('en-CA', {
                    timeZone: tz,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });

                const parts = dtf.formatToParts(utcDate).reduce((acc, part) => {
                    if (part.type !== 'literal') acc[part.type] = part.value;
                    return acc;
                }, {});

                if (dateInput) dateInput.value = `${parts.year}-${parts.month}-${parts.day}`;
                if (timeInput) timeInput.value = `${parts.hour}:${parts.minute}`;
            }
        }
    }

    const mainData = getMainDataFromRoot(data);
    
    if (mainData || data) {
        // Обновляем заголовок в модалке (номер рейса)
        const modalFlightNumber = document.getElementById('modal-flight-number');
        if (modalFlightNumber) {
            modalFlightNumber.textContent = (mainData && mainData.number) ? mainData.number : 'SU ----';
        }

        // Обновляем длительность
        const modalDuration = document.getElementById('modal-flight-duration');
        if (modalDuration) {
            if (currentSource === 'manual') {
                modalDuration.style.display = 'none';
            } else {
                modalDuration.style.display = 'block';
                modalDuration.textContent = mainData && mainData.duration ? formatDuration(mainData.duration) : '-- ч -- мин';
            }
        }
        
        // Обновляем аэропорты и смещения
        const depCodes = document.getElementById('modal-dep-codes');
        const arrCodes = document.getElementById('modal-arr-codes');
        const depCity = document.getElementById('modal-dep-city');
        const arrCity = document.getElementById('modal-arr-city');
        const depTz = document.getElementById('modal-dep-tz');
        const arrTz = document.getElementById('modal-arr-tz');

        if (mainData && mainData.departure && mainData.arrival) {
            const flightDate = mainData.startDate ? new Date(mainData.startDate) : new Date();

            const depIata = mainData.departure.iata || '---';
            const depIcao = mainData.departure.icao || '----';
            const arrIata = mainData.arrival.iata || '---';
            const arrIcao = mainData.arrival.icao || '----';

            if (depCodes) depCodes.textContent = `${depIata} / ${depIcao}`;
            if (arrCodes) arrCodes.textContent = `${arrIata} / ${arrIcao}`;
            
            if (depCity) {
                const name = (mainData.departure.city || '------').toString();
                depCity.textContent = name.length > 14 ? name.slice(0, 14) : name;
            }
            if (arrCity) {
                const name = (mainData.arrival.city || '------').toString();
                arrCity.textContent = name.length > 14 ? name.slice(0, 14) : name;
            }

            // Смещения часовых поясов
            const depOffsetStr = getGmtOffsetVsMoscow(mainData.departure.icao, flightDate);
            const arrOffsetStr = getGmtOffsetVsMoscow(mainData.arrival.icao, flightDate);

            if (depTz) {
                depTz.textContent = depOffsetStr || '';
                depTz.style.display = depOffsetStr ? 'block' : 'none';
            }
            if (arrTz) {
                arrTz.textContent = arrOffsetStr || '';
                arrTz.style.display = arrOffsetStr ? 'block' : 'none';
            }
        } else {
            // Сброс если данных нет или они неполные
            if (depCodes) depCodes.textContent = '--- / ----';
            if (arrCodes) arrCodes.textContent = '--- / ----';
            if (depCity) depCity.textContent = '------';
            if (arrCity) arrCity.textContent = '------';
            if (depTz) {
                depTz.textContent = '';
                depTz.style.display = 'none';
            }
            if (arrTz) {
                arrTz.textContent = '';
                arrTz.style.display = 'none';
            }
        }

        // Рендерим список источников
        const sourcesListEl = document.getElementById('modal-sources-list');
        if (sourcesListEl) {
            sourcesListEl.innerHTML = '';
            
            const sourcesData = [
                { id: 'accord', name: 'Аккорд', icon: 'fa-database', data: data?.sources?.accord },
                { id: 'calendar', name: 'Календарь', icon: 'fa-calendar-alt', data: data?.sources?.calendar },
                { id: 'web', name: 'Web', icon: 'fa-globe', data: data?.sources?.web },
                { id: 'manual', name: 'Ручной', icon: 'fa-edit', data: manualData }
            ];

            // Сортировка: выбранный источник первым
            const sortedSources = [...sourcesData].sort((a, b) => {
                if (a.id === currentSource) return -1;
                if (b.id === currentSource) return 1;
                return 0;
            });

            const activeSourceData = sourcesData.find(s => s.id === currentSource)?.data;
            const activeStartTime = activeSourceData?.startDate ? new Date(activeSourceData.startDate).getTime() : null;
            const activeFlightNum = (activeSourceData?.number || '').toString().trim();
            const activeDepIcao = (activeSourceData?.departure?.icao || '').toString().trim().toUpperCase();

            sortedSources.forEach(source => {
                const sData = source.data;
                const hasData = sData && sData.startDate;
                
                // Если по ручному данных вообще нет, то плашка с ручными данными вообще не показывается
                if (source.id === 'manual' && !hasData) return;

                const itemEl = document.createElement('div');
                itemEl.className = 'modal-source-item';
                if (source.id === currentSource) itemEl.classList.add('modal-source-item--active');
                
                if (source.id === 'manual') {
                    itemEl.classList.add('modal-source-item--manual-clickable');
                    itemEl.title = 'Нажмите, чтобы удалить ручные данные';
                    itemEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        showConfirm(
                            'Удалить ручные данные?',
                            'Вы уверены, что хотите полностью удалить информацию, введенную вручную?',
                            () => {
                                localStorage.removeItem(MANUAL_FLIGHT_DATA_LS_KEY);
                                if (getSelectedDataSource() === 'manual') {
                                    setSelectedDataSource('accord');
                                }
                                updateFlightCardFromStorage();
                                openFlightModal(); // Перерисовать
                                hideConfirm();
                            }
                        );
                    });
                }
                
                if (!hasData) {
                    itemEl.classList.add('modal-source-item--empty');
                }

                let statusHtml = '';
                if (hasData && source.id !== currentSource && activeStartTime) {
                    const sTime = new Date(sData.startDate).getTime();
                    const sNum = (sData.number || '').toString().trim();
                    const sDepIcao = (sData.departure?.icao || '').toString().trim().toUpperCase();

                    const isTimeMatch = sTime === activeStartTime;
                    const isNumMatch = sNum === activeFlightNum;
                    const isIcaoMatch = sDepIcao === activeDepIcao;

                    if (isTimeMatch && isNumMatch && isIcaoMatch) {
                        itemEl.classList.add('modal-source-item--match');
                        statusHtml = '<i class="fas fa-check-circle" style="color: var(--status-success)"></i>';
                    } else {
                        itemEl.classList.add('modal-source-item--mismatch');
                        statusHtml = '<i class="fas fa-exclamation-triangle" style="color: var(--status-warning)"></i>';
                    }
                }

                const timeStr = hasData ? `${formatFlightTime(new Date(sData.startDate))}, ${formatFlightDate(new Date(sData.startDate))}` : 'нет данных';
                const flightNum = (sData && sData.number) ? sData.number : '----';
                const routeStr = (hasData && sData.departure?.icao && sData.arrival?.icao) 
                    ? `${sData.departure.icao}-${sData.arrival.icao}` 
                    : '';

                const combinedTimeStr = routeStr ? `${routeStr}, ${timeStr}` : timeStr;

                itemEl.innerHTML = `
                    <div class="modal-source-header">
                        <div class="modal-source-name">
                            <i class="fas ${source.icon}"></i> ${source.name}
                        </div>
                        <div class="modal-source-status">${statusHtml}</div>
                    </div>
                    <div class="modal-source-details">
                        <div class="modal-source-flight">${flightNum}</div>
                        <div class="modal-source-time">${combinedTimeStr}</div>
                    </div>
                `;
                sourcesListEl.appendChild(itemEl);
            });
        }

        // Обновляем кнопки переключения и их доступность
        document.querySelectorAll('#source-toggle .source-button').forEach(btn => {
            const sId = btn.dataset.source;
            let hasData = false;
            if (sId === 'manual') {
                hasData = true; // Ручной всегда доступен для выбора
            } else if (data && data.sources) {
                hasData = data.sources[sId] && data.sources[sId].startDate;
            }
            
            btn.classList.toggle('active', sId === currentSource);
            btn.classList.toggle('disabled', !hasData);
        });
    }

    // Устанавливаем состояние UI для ручного режима
    if (currentSource === 'manual' && manualData) {
        const manualSaveBtn = document.getElementById('manual-save-btn');
        const manualEditBtn = document.getElementById('manual-edit-btn');
        const manualDeleteBtn = document.getElementById('manual-delete-btn');

        if (manualSaveBtn) manualSaveBtn.style.display = 'none';
        if (manualEditBtn) manualEditBtn.style.display = 'block';
        if (manualDeleteBtn) manualDeleteBtn.style.display = 'block';
        if (manualSection) manualSection.classList.add('manual-input-minimized');

        // Отключаем поля ввода
        const manualInputs = ['manual-flight-number', 'manual-dep-icao', 'manual-arr-icao', 'manual-departure-date', 'manual-departure-time'];
        manualInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = true;
        });
    }

    document.getElementById('flight-modal').style.display = 'flex';
}

function closeFlightModal() {
    document.getElementById('flight-modal').style.display = 'none';
}

// Функция для обновления времени
function updateTime() {
    const now = new Date();
    const moscowTime = getMoscowTime();

    // Обновление элементов DOM
    const moscowTimeElement = document.getElementById('moscow-time');
    const moscowDateElement = document.getElementById('moscow-date');
    const localTimeElement = document.getElementById('local-time');
    const localDateElement = document.getElementById('local-date');
    const timeDifferenceElement = document.getElementById('time-difference');
    const nextStageTimeElement = document.getElementById('next-stage-time');

    // Добавляем анимацию обновления только если время изменилось
    const currentMoscowTime = moscowTimeElement.textContent;
    const currentLocalTime = localTimeElement.textContent;

    if (currentMoscowTime !== formatTime(moscowTime)) {
        moscowTimeElement.classList.add('updating');
    }
    if (currentLocalTime !== formatTime(now)) {
        localTimeElement.classList.add('updating');
    }

    setTimeout(() => {
        moscowTimeElement.textContent = formatTime(moscowTime);
        moscowDateElement.textContent = formatDate(moscowTime);
        localTimeElement.textContent = formatTime(now);
        localDateElement.textContent = formatDate(now);
        timeDifferenceElement.textContent = calculateTimeDifference(moscowTime, now);
        updateNextStageCountdown();

        // Update time-difference badge state after updating text
        updateTimeDifferenceByDepartureIcao();

        updateUpdatedBadgeRealtime();

        moscowTimeElement.classList.remove('updating');
        localTimeElement.classList.remove('updating');
    }, 300);
}

// Инициализация и обновление каждые 10 секунд
document.addEventListener('DOMContentLoaded', () => {
    updateTime();
    setInterval(updateTime, 10000); // Обновление каждые 10 секунд
    // Подтягиваем сохранённые данные рейса в карточку при загрузке
    updateFlightCardFromStorage();
    try {
        const source = getSelectedDataSource();
        let data = null;

        // Для ручного режима берем данные из manual_flight_data
        if (source === 'manual') {
            data = getManualFlightData();
        } else {
            const raw = localStorage.getItem(CREW_PORTAL_LS_KEY);
            data = raw ? safeParseJson(raw) : null;
        }

        updateStageTimesFromFlight(data);
        updateNextStageCountdown();
    } catch {
        updateStageTimesFromFlight(null);
        updateNextStageCountdown();
    }
    applyStageSettingsToUI(getCurrentContextFromStorage());
    applyAuthToUI();

    // Инициализация настроек сна
    applySleepEnabledToUI(getSleepEnabled());
    updateSleepDisplay();

    const sleepToggleInit = document.getElementById('sleep-toggle');
    const sleepControlsInit = document.querySelector('.sleep-controls');
    if (sleepToggleInit && sleepControlsInit && sleepToggleInit.checked === false) {
        sleepControlsInit.classList.add('sleep-controls--disabled');
    }

    // Обработчики для кнопок сна
    document.getElementById('sleep-decrease').addEventListener('click', () => changeSleepTime(-30));
    document.getElementById('sleep-increase').addEventListener('click', () => changeSleepTime(30));

    // Обработчики для модальных окон
    document.getElementById('settings-button-small').addEventListener('click', openSettingsModal);
    document.getElementById('settings-modal-close').addEventListener('click', closeSettingsModal);
    document.getElementById('settings-modal-backdrop').addEventListener('click', closeSettingsModal);
    document.getElementById('cancel-settings').addEventListener('click', closeSettingsModal);

    document.getElementById('save-settings').addEventListener('click', () => {
        const settings = getStageSettings();

        document.querySelectorAll('.time-input[data-setting]').forEach((input) => {
            const key = input.dataset.setting;
            if (!key) return;

            // input type="time" → "HH:MM"
            const value = (input.value || '').trim();
            settings[key] = value || DEFAULT_STAGE_SETTINGS[key];
        });

        saveStageSettings(settings);

        // Save login/password
        const loginInput = document.getElementById('login-input');
        const passwordInput = document.getElementById('password-input');

        saveAuthCredentials({
            login: (loginInput?.value || '').trim() || DEFAULT_AUTH.login,
            password: (passwordInput?.value || '').toString() || DEFAULT_AUTH.password
        });

        // Обновляем подписи этапов для текущего режима (Из дома / Из отеля)
        applyStageSettingsToUI(getCurrentContextFromStorage());
        try {
            const raw = localStorage.getItem(CREW_PORTAL_LS_KEY);
            const data = raw ? safeParseJson(raw) : null;
            updateStageTimesFromFlight(data);
        } catch {
            // ignore
        }
        applyAuthToUI();

        closeSettingsModal();
    });

    document.querySelectorAll('.stage-item').forEach(stage => {
        stage.addEventListener('click', () => openStageModal(stage));
    });

    document.getElementById('stage-modal-close').addEventListener('click', closeStageModal);
    document.getElementById('stage-modal-backdrop').addEventListener('click', closeStageModal);

    // ===== Stage modal controls (per-flight overrides) =====
    const modalMinus = document.getElementById('time-decrease');
    const modalPlus = document.getElementById('time-increase');
    const modalTimeInput = document.getElementById('modal-time-input');
    const modalReset = document.getElementById('reset-time');
    const modalSave = document.getElementById('save-time');

    function applyModalTimeAndRefresh(dateObj) {
        const rounded = roundToNearest5Minutes(dateObj);
        const clamped = clampStageTime(rounded);
        setStageModalTime(clamped);
    }

    if (modalMinus) {
        modalMinus.addEventListener('click', () => {
            if (!stageModalState.currentTime) return;
            applyModalTimeAndRefresh(addMinutes(stageModalState.currentTime, -5));
        });
    }

    if (modalPlus) {
        modalPlus.addEventListener('click', () => {
            if (!stageModalState.currentTime) return;
            applyModalTimeAndRefresh(addMinutes(stageModalState.currentTime, 5));
        });
    }

    // Tap time -> show input
    if (modalTimeInput) {
        modalTimeInput.addEventListener('change', () => {
            if (!stageModalState.currentTime) return;

            const v = (modalTimeInput.value || '').trim();
            if (!v.includes(':')) return;

            const [hh, mm] = v.split(':');
            const h = Number.parseInt(hh, 10);
            const m = Number.parseInt(mm, 10);
            if (Number.isNaN(h) || Number.isNaN(m)) return;

            const d = new Date(stageModalState.currentTime.getTime());
            d.setHours(h, m, 0, 0);

            // Ввод руками: тоже clamp (и по желанию можно округлять)
            setStageModalTime(clampStageTime(d));
        });
    }

    if (modalReset) {
        modalReset.addEventListener('click', () => {
            if (!stageModalState.baseTime) return;
            applyModalTimeAndRefresh(new Date(stageModalState.baseTime.getTime()));
        });
    }

    if (modalSave) {
        modalSave.addEventListener('click', () => {
            if (!stageModalState.flightData || !stageModalState.stageKey || !stageModalState.currentTime) {
                closeStageModal();
                return;
            }

            const sameAsBase = stageModalState.baseTime
                && (stageModalState.currentTime.getTime() === stageModalState.baseTime.getTime());

            if (sameAsBase) {
                saveStageOverrideForFlight(stageModalState.flightData, stageModalState.stageKey, null);
            } else {
                saveStageOverrideForFlight(stageModalState.flightData, stageModalState.stageKey, stageModalState.currentTime.toISOString());
            }

            updateStageTimesFromFlight(stageModalState.flightData);
            updateNextStageCountdown();
            closeStageModal();
        });
    }

    document.getElementById('flight-card').addEventListener('click', openFlightModal);
    document.getElementById('flight-modal-close').addEventListener('click', closeFlightModal);
    document.getElementById('flight-modal-backdrop').addEventListener('click', closeFlightModal);

    // Обработка переключения источника данных
    document.querySelectorAll('#source-toggle .source-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const newSource = btn.dataset.source;
            if (!newSource) return;

            setSelectedDataSource(newSource);

            // Обновляем активную кнопку в UI модалки
            document.querySelectorAll('#source-toggle .source-button').forEach(b => {
                b.classList.toggle('active', b.dataset.source === getSelectedDataSource());
            });

            // Перерисовываем всё
            updateFlightCardFromStorage();
            openFlightModal(); 
            updateNextStageCountdown();
        });
    });

    // Обработчики ручного ввода
    const manualInputs = [
        'manual-flight-number',
        'manual-dep-icao',
        'manual-arr-icao',
        'manual-departure-date',
        'manual-departure-time'
    ];

    const validateManualForm = () => {
        const flightNum = document.getElementById('manual-flight-number').value.trim();
        const depCode = document.getElementById('manual-dep-icao').value.trim();
        const arrCode = document.getElementById('manual-arr-icao').value.trim();
        const dateVal = document.getElementById('manual-departure-date').value;
        const timeVal = document.getElementById('manual-departure-time').value;
        
        const saveBtn = document.getElementById('manual-save-btn');
        const isValid = flightNum && (depCode.length >= 3) && (arrCode.length >= 3) && dateVal && timeVal;
        
        if (saveBtn) {
            saveBtn.disabled = !isValid;
            saveBtn.style.opacity = isValid ? '1' : '0.5';
        }
    };

    const updateManualOffsetsUI = () => {
        const depCodeInput = document.getElementById('manual-dep-icao');
        const arrCodeInput = document.getElementById('manual-arr-icao');
        const dateInput = document.getElementById('manual-departure-date');
        
        const depTzEl = document.getElementById('modal-dep-tz');
        const arrTzEl = document.getElementById('modal-arr-tz');

        if (!depCodeInput || !arrCodeInput) return;

        let depCode = depCodeInput.value.trim().toUpperCase();
        let arrCode = arrCodeInput.value.trim().toUpperCase();
        const dateVal = dateInput?.value || new Date().toISOString().split('T')[0];
        const flightDate = new Date(dateVal);

        if (depCode.length === 3 && typeof iata_icao !== 'undefined') depCode = iata_icao[depCode] || depCode;
        if (arrCode.length === 3 && typeof iata_icao !== 'undefined') arrCode = iata_icao[arrCode] || arrCode;

        const depOffsetStr = getGmtOffsetVsMoscow(depCode, flightDate);
        const arrOffsetStr = getGmtOffsetVsMoscow(arrCode, flightDate);

        if (depTzEl) {
            depTzEl.textContent = depOffsetStr || '--';
            depTzEl.style.display = depOffsetStr ? 'block' : 'none';
        }
        if (arrTzEl) {
            arrTzEl.textContent = arrOffsetStr || '--';
            arrTzEl.style.display = arrOffsetStr ? 'block' : 'none';
        }
        
        // Также обновим города в модалке сразу
        const depCityEl = document.getElementById('modal-dep-city');
        const arrCityEl = document.getElementById('modal-arr-city');
        const depInfo = (typeof icao_info !== 'undefined' && icao_info[depCode]) || {};
        const arrInfo = (typeof icao_info !== 'undefined' && icao_info[arrCode]) || {};
        
        if (depCityEl) {
            const name = depInfo.geo ? depInfo.geo[0] : '------';
            depCityEl.textContent = name.length > 14 ? name.slice(0, 14) : name;
        }
        if (arrCityEl) {
            const name = arrInfo.geo ? arrInfo.geo[0] : '------';
            arrCityEl.textContent = name.length > 14 ? name.slice(0, 14) : name;
        }
        
        // И коды
        const depCodesEl = document.getElementById('modal-dep-codes');
        const arrCodesEl = document.getElementById('modal-arr-codes');
        if (depCodesEl) depCodesEl.textContent = `${depInfo.iata || '---'} / ${depCode || '----'}`;
        if (arrCodesEl) arrCodesEl.textContent = `${arrInfo.iata || '---'} / ${arrCode || '----'}`;
    };

    const updateManualDataLogic = () => {
        let flightNum = document.getElementById('manual-flight-number').value.trim();

        // Автоматически добавляем SU, если номер не содержит букв
        if (flightNum && !/^[A-Z]{2}\s*\d+/.test(flightNum)) {
            flightNum = `SU ${flightNum}`;
        }

        let depCode = document.getElementById('manual-dep-icao').value.trim().toUpperCase();
        let arrCode = document.getElementById('manual-arr-icao').value.trim().toUpperCase();
        const dateVal = document.getElementById('manual-departure-date').value;
        const timeVal = document.getElementById('manual-departure-time').value;

        // ICAO/IATA resolution
        if (depCode.length === 3 && typeof iata_icao !== 'undefined') {
            depCode = iata_icao[depCode] || depCode;
        }
        if (arrCode.length === 3 && typeof iata_icao !== 'undefined') {
            arrCode = iata_icao[arrCode] || arrCode;
        }

        const depInfo = (typeof icao_info !== 'undefined' && icao_info[depCode]) || {};
        const arrInfo = (typeof icao_info !== 'undefined' && icao_info[arrCode]) || {};

        let startDateIso = null;
        if (dateVal && timeVal) {
            // Local time to ISO
            const tz = (typeof airports_tz !== 'undefined' && airports_tz[depCode]) || 'UTC';
            // Create date from local components
            const [y, m, d] = dateVal.split('-').map(Number);
            const [hh, mm] = timeVal.split(':').map(Number);
            
            // Format for ISO but with target TZ
            const localStr = `${dateVal}T${timeVal}:00`;
            const dtf = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
            });

            // We need to find UTC time that results in this local time in that TZ
            // Simplest way: try different offsets
            const testDate = new Date(`${localStr}Z`); 
            const offsetMs = getTimeZoneOffsetMinutes(tz, testDate) * 60000;
            startDateIso = new Date(testDate.getTime() - offsetMs).toISOString();
        }

        const manualData = {
            number: flightNum,
            startDate: startDateIso,
            duration: "00:00", 
            departure: {
                icao: depCode,
                iata: depInfo.iata || "",
                city: depInfo.geo ? depInfo.geo[0] : ""
            },
            arrival: {
                icao: arrCode,
                iata: arrInfo.iata || "",
                city: arrInfo.geo ? arrInfo.geo[0] : ""
            },
            isWork: true,
            _updatedAt: new Date().toISOString()
        };

        saveManualFlightData(manualData);
        
        // Обновляем смещения МСК+X в реальном времени в модалке
        if (startDateIso) {
            const flightDate = new Date(startDateIso);
            const depTz = document.getElementById('modal-dep-tz');
            const arrTz = document.getElementById('modal-arr-tz');
            const depOffsetStr = getGmtOffsetVsMoscow(depCode, flightDate);
            const arrOffsetStr = getGmtOffsetVsMoscow(arrCode, flightDate);

            if (depTz) {
                depTz.textContent = depOffsetStr || '';
                depTz.style.display = depOffsetStr ? 'block' : 'none';
            }
            if (arrTz) {
                arrTz.textContent = arrOffsetStr || '';
                arrTz.style.display = arrOffsetStr ? 'block' : 'none';
            }
        }

        if (getSelectedDataSource() === 'manual') {
            const raw = localStorage.getItem(CREW_PORTAL_LS_KEY);
            const data = raw ? safeParseJson(raw) : null;
            updateFlightCardFromData(data);
            
            const modalFlightNumber = document.getElementById('modal-flight-number');
            if (modalFlightNumber) modalFlightNumber.textContent = manualData.number || 'SU ----';
            
            const depCodes = document.getElementById('modal-dep-codes');
            const arrCodes = document.getElementById('modal-arr-codes');
            const depCity = document.getElementById('modal-dep-city');
            const arrCity = document.getElementById('modal-arr-city');
            
            if (depCodes) depCodes.textContent = `${manualData.departure.iata || '---'} / ${manualData.departure.icao || '----'}`;
            if (arrCodes) arrCodes.textContent = `${manualData.arrival.iata || '---'} / ${manualData.arrival.icao || '----'}`;
            
            if (depCity) {
                const name = manualData.departure.city || '------';
                depCity.textContent = name.length > 14 ? name.slice(0, 14) : name;
            }
            if (arrCity) {
                const name = manualData.arrival.city || '------';
                arrCity.textContent = name.length > 14 ? name.slice(0, 14) : name;
            }
        }
    };

    manualInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', () => {
                validateManualForm();
                updateManualOffsetsUI();

                // Обновляем номер рейса в реальном времени
                if (id === 'manual-flight-number') {
                    const modalFlightNumber = document.getElementById('modal-flight-number');
                    if (modalFlightNumber) {
                        let flightNum = input.value.trim();
                        if (flightNum && !/^[A-Z]{2}\s*\d+/.test(flightNum)) {
                            flightNum = `SU ${flightNum}`;
                        }
                        modalFlightNumber.textContent = flightNum || 'SU ----';
                    }
                }
            });
            input.addEventListener('change', () => {
                validateManualForm();
                updateManualOffsetsUI();
            });
        }
    });

    // Логика кнопок Сохранить/Изменить/Удалить
    const manualSaveBtn = document.getElementById('manual-save-btn');
    const manualEditBtn = document.getElementById('manual-edit-btn');
    const manualDeleteBtn = document.getElementById('manual-delete-btn');
    const manualSection = document.getElementById('manual-input-section');

    const setManualUIState = (isSaved) => {
        manualInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = isSaved;
        });

        if (isSaved) {
            manualSaveBtn.style.display = 'none';
            manualEditBtn.style.display = 'block';
            manualDeleteBtn.style.display = 'block';
            manualSection.classList.add('manual-input-minimized');
        } else {
            manualSaveBtn.style.display = 'block';
            manualEditBtn.style.display = 'none';
            manualDeleteBtn.style.display = 'none';
            manualSection.classList.remove('manual-input-minimized');
        }
    };

    if (manualSaveBtn) {
        manualSaveBtn.addEventListener('click', () => {
            updateManualDataLogic();
            setManualUIState(true);
            updateFlightCardFromStorage();
            updateNextStageCountdown(); // Обновить таймеры на главном экране
        });
    }
    if (manualEditBtn) {
        manualEditBtn.addEventListener('click', () => {
            setManualUIState(false);
            validateManualForm();
        });
    }
    if (manualDeleteBtn) {
        manualDeleteBtn.addEventListener('click', () => {
            showConfirm(
                'Удалить ручные данные?',
                'Вы уверены, что хотите полностью удалить информацию, введенную вручную?',
                () => {
                    localStorage.removeItem(MANUAL_FLIGHT_DATA_LS_KEY);
                    manualInputs.forEach(id => {
                        const el = document.getElementById(id);
                        if (el) {
                            el.value = '';
                            el.disabled = false;
                        }
                    });
                    setManualUIState(false);
                    if (getSelectedDataSource() === 'manual') {
                        setSelectedDataSource('accord');
                    }
                    updateFlightCardFromStorage();
                    openFlightModal();
                    hideConfirm();
                }
            );
        });
    }

    const resetAllBtn = document.getElementById('reset-all-data');
    if (resetAllBtn) {
        resetAllBtn.addEventListener('click', () => {
            showConfirm(
                'Сбросить все данные?',
                'Это действие удалит все настройки, авторизацию и сохраненные данные рейсов. Сайт будет перезагружен.',
                () => {
                    localStorage.clear();
                    window.location.reload();
                }
            );
        });
    }

    const reloadPageBtn = document.getElementById('reload-page');
    if (reloadPageBtn) {
        reloadPageBtn.addEventListener('click', () => {
            window.location.reload();
        });
    }

    const confirmCancelBtn = document.getElementById('confirm-modal-cancel');
    const confirmConfirmBtn = document.getElementById('confirm-modal-confirm');
    const confirmBackdrop = document.getElementById('confirm-modal-backdrop');

    if (confirmCancelBtn) confirmCancelBtn.addEventListener('click', hideConfirm);
    if (confirmBackdrop) confirmBackdrop.addEventListener('click', hideConfirm);
    if (confirmConfirmBtn) {
        confirmConfirmBtn.addEventListener('click', () => {
            if (typeof confirmCallback === 'function') {
                confirmCallback();
            }
        });
    }

    // При открытии модалки восстанавливаем состояние (если есть данные - то сохраненный вид)
    const originalOpenFlightModal = openFlightModal;
    window.openFlightModal = function() {
        originalOpenFlightModal();
        const manualData = getManualFlightData();
        const currentSource = getSelectedDataSource();
        
        if (manualData && manualData.startDate) {
            // Если мы в ручном режиме и есть данные - сворачиваем
            setManualUIState(currentSource === 'manual');
            
            // Заполняем поля (т.к. openFlightModal мог их не заполнить если источник не manual)
            const displayNumber = (manualData.number || '').replace(/^SU\s*/i, '');
            document.getElementById('manual-flight-number').value = displayNumber;
            document.getElementById('manual-dep-icao').value = manualData.departure?.icao || '';
            document.getElementById('manual-arr-icao').value = manualData.arrival?.icao || '';
            
            if (manualData.startDate) {
                const d = new Date(manualData.startDate);
                const tz = (typeof airports_tz !== 'undefined' && manualData.departure?.icao) ? (airports_tz[manualData.departure.icao] || 'UTC') : 'UTC';
                
                // Get local time for the input
                try {
                    const dtf = new Intl.DateTimeFormat('en-CA', { // en-CA gives YYYY-MM-DD
                        timeZone: tz,
                        year: 'numeric', month: '2-digit', day: '2-digit'
                    });
                    const dtfTime = new Intl.DateTimeFormat('en-GB', { // en-GB gives HH:mm
                        timeZone: tz,
                        hour: '2-digit', minute: '2-digit', hour12: false
                    });
                    
                    document.getElementById('manual-departure-date').value = dtf.format(d);
                    document.getElementById('manual-departure-time').value = dtfTime.format(d);
                } catch (e) {
                    // Fallback to UTC if timezone is invalid
                    document.getElementById('manual-departure-date').value = d.toISOString().split('T')[0];
                    document.getElementById('manual-departure-time').value = d.toISOString().split('T')[1].slice(0, 5);
                }
            }
        } else {
            setManualUIState(false);
        }
        validateManualForm();
        updateManualOffsetsUI();
    };

    // Обработчик для переключателя сна
    document.getElementById('sleep-toggle').addEventListener('change', function() {
        saveSleepEnabled(this.checked);

        const sleepStages = document.querySelectorAll('.stage-item[data-stage="rest"], .stage-item[data-stage="sleep"]');
        const sleepControls = document.querySelector('.sleep-controls');
        const decreaseButton = document.getElementById('sleep-decrease');
        const increaseButton = document.getElementById('sleep-increase');

        if (this.checked) {
            sleepStages.forEach((stage) => stage.classList.remove('stage-inactive'));

            if (sleepControls) sleepControls.classList.remove('sleep-controls--disabled');
            if (decreaseButton) decreaseButton.disabled = false;
            if (increaseButton) increaseButton.disabled = false;

            // вернём логику ограничений 0:30..15:00
            updateSleepDisplay();
        } else {
            sleepStages.forEach((stage) => stage.classList.add('stage-inactive'));

            if (sleepControls) sleepControls.classList.add('sleep-controls--disabled');
            if (decreaseButton) decreaseButton.disabled = true;
            if (increaseButton) increaseButton.disabled = true;
        }

        updateNextStageCountdown();
    });

    // Обработчик для переключения видимости пароля
    document.getElementById('password-toggle').addEventListener('click', function() {
        const passwordInput = document.getElementById('password-input');
        const icon = this.querySelector('i');

        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    });

    // ===== Обновление данных рейса (crewPortalInfo) =====

    async function fetchCrewPortalInfo() {
        const response = await fetch(CREW_PORTAL_TEST_URL, {
            method: 'GET',
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const json = await response.json();

        if (!json || typeof json !== 'object') {
            throw new Error('Invalid JSON');
        }

        if (json.success !== true) {
            // success:false или вообще нет поля
            throw new Error('API success=false');
        }

        if (!json.data || typeof json.data !== 'object') {
            throw new Error('Missing data');
        }

        // Сохраняем ТОЛЬКО data
        json.data._updatedAt = new Date().toISOString();
        localStorage.setItem(CREW_PORTAL_LS_KEY, JSON.stringify(json.data));

        return json.data;
    }

    function setRefreshIcon(iconEl, state) {
        // state: 'sync' | 'ok' | 'err'
        iconEl.classList.remove('fa-sync-alt', 'fa-check', 'fa-times');

        if (state === 'ok') {
            iconEl.classList.add('fa-check');
            return;
        }

        if (state === 'err') {
            iconEl.classList.add('fa-times');
            return;
        }

        iconEl.classList.add('fa-sync-alt');
    }

    function withTempIcon(iconEl, state, ms = 1200) {
        setRefreshIcon(iconEl, state);
        window.setTimeout(() => setRefreshIcon(iconEl, 'sync'), ms);
    }

    // Обработчик кнопки обновления (важно: НЕ даём всплыть клику на flight-card)
    const refreshBtn = document.getElementById('refresh-flight');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const iconEl = refreshBtn.querySelector('i');
            if (!iconEl) return;

            // Крутим иконку во время запроса
            iconEl.classList.add('fa-spin');

            try {
                const data = await fetchCrewPortalInfo();
                updateFlightCardFromData(data);
                updateNextStageCountdown();
                withTempIcon(iconEl, 'ok', 1200);
            } catch (err) {
                console.error('Failed to refresh crew portal info:', err);
                withTempIcon(iconEl, 'err', 1500);
            } finally {
                // fa-spin оставляем только на время загрузки
                iconEl.classList.remove('fa-spin');
            }
        }, { passive: false });
    }

    // Если у тебя будут ещё action-button в будущем — тут можно добавить общий хэндлер,
    // но сейчас он не нужен, чтобы не мешать логике обновления.
});
