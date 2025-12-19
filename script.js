// ===== Работа с данными рейса из localStorage (crewPortalInfo) =====
const CREW_PORTAL_LS_KEY = 'crewPortalInfo';
const CREW_PORTAL_TEST_URL = 'https://myapihelper.na4u.ru/crewtimeapi/test.php?randomDate=false';

// ===== Настройки этапов (localStorage) =====
const STAGE_SETTINGS_LS_KEY = 'stageSettings';
const SLEEP_TOGGLE_LS_KEY = 'sleepEnabled';

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
    login: 'demo_user',
    password: 'password'
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
    // "HH:MM" -> "за H:MM"
    if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) {
        return 'за --:--';
    }

    const [hhRaw, mmRaw] = timeStr.split(':');
    const h = Number.parseInt(hhRaw, 10);
    const m = Number.parseInt(mmRaw, 10);

    if (Number.isNaN(h) || Number.isNaN(m)) {
        return 'за --:--';
    }

    return `за ${h}:${m.toString().padStart(2, '0')}`;
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
    const options = {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    };
    return date.toLocaleDateString('ru-RU', options).replace(' г.', '');
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

function getCurrentContextFromFlightData(data) {
    const depIcao = data && data.departure && data.departure.icao ? data.departure.icao.toString().toUpperCase() : '';
    if (!depIcao) return 'home';
    return depIcao === 'UUEE' ? 'home' : 'hotel';
}

function getCurrentContextFromStorage() {
    const raw = localStorage.getItem(CREW_PORTAL_LS_KEY);
    const data = raw ? safeParseJson(raw) : null;
    return getCurrentContextFromFlightData(data);
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

    if (!data || typeof data !== 'object' || !data.startDate) {
        stages.forEach((el) => {
            const timeEl = el.querySelector('.stage-time');
            if (timeEl) timeEl.textContent = '--:--';
        });
        return;
    }

    const startDate = new Date(data.startDate);
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

    const map = {
        rest: tRest,
        sleep: tSleep,
        wakeup: tWake,
        taxi: tTaxi,
        exit: tExit
    };

    lastStageTimeline = {
        flightStart: startDate,
        times: map
    };

    updateNextStageCountdown();

    document.querySelectorAll('.stage-item').forEach((el) => {
        const key = el.dataset.stage;
        const timeEl = el.querySelector('.stage-time');
        if (!timeEl) return;

        const d = map[key];
        if (!d || Number.isNaN(d.getTime())) {
            timeEl.textContent = '--:--';
            return;
        }

        timeEl.textContent = formatFlightTime(d);
    });
}

let lastStageTimeline = null;

function formatRemainingMs(ms) {
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
        return `${days} д ${hours} ч ${minutes.toString().padStart(2, '0')} мин`;
    }

    return `${hours} ч ${minutes.toString().padStart(2, '0')} мин`;
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
        return;
    }

    const now = new Date();
    const sleepEnabled = getSleepEnabled();

    const order = ['rest', 'sleep', 'wakeup', 'taxi', 'exit'];
    const candidates = order.filter((k) => {
        if (!sleepEnabled && (k === 'rest' || k === 'sleep')) return false;
        return true;
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
}

function updateFlightCardFromData(data) {
    const flightCard = document.getElementById('flight-card');
    if (!flightCard) return;

    if (!data || typeof data !== 'object') {
        setFlightCardDashes();
        return;
    }

    // Clear inline loading styles (setFlightCardDashes uses inline background/shadow)
    const locationInline = flightCard.querySelector('.location-badge');
    if (locationInline) {
        locationInline.style.background = '';
        locationInline.style.boxShadow = '';
    }

    // Refresh time-difference badge state when new data is applied
    updateTimeDifferenceByDepartureIcao();

    const startDateStr = data.startDate;
    const startDate = startDateStr ? new Date(startDateStr) : null;
    updateStageTimesFromFlight(data);

    const flightNumberEl = flightCard.querySelector('.flight-number');
    const flightTimeEl = flightCard.querySelector('.flight-time');
    const flightDateEl = flightCard.querySelector('.flight-date');
    const flightDurationEl = flightCard.querySelector('.flight-duration');

    // Pilot badge update based on data.isWork
    const badgeEl = flightCard.querySelector('.pilot-badge');
    const badgeIconEl = badgeEl ? badgeEl.querySelector('i') : null;
    const badgeTextEl = badgeEl ? badgeEl.querySelector('.pilot-badge-text') : null;

    const isWork = data.isWork === true;

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

    const depIcaoForLocation = (data.departure && data.departure.icao) ? data.departure.icao.toString().toUpperCase() : '';
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
        const number = (data.number || '').toString().trim();
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
        flightDurationEl.textContent = formatDuration(data.duration);
    }

    const airports = flightCard.querySelectorAll('.flight-route .airport');
    if (airports.length >= 2) {
        const dep = data.departure || {};
        const arr = data.arrival || {};

        const depCode = airports[0].querySelector('.airport-code');
        const depName = airports[0].querySelector('.airport-name');
        const arrCode = airports[1].querySelector('.airport-code');
        const arrName = airports[1].querySelector('.airport-name');

        const depIata = (dep.iata || '---').toString();
        const depIcao = (dep.icao || '----').toString();
        const arrIata = (arr.iata || '---').toString();
        const arrIcao = (arr.icao || '----').toString();

        if (depCode) depCode.textContent = `${depIata} / ${depIcao}`;
        if (depName) depName.textContent = (dep.city || '------').toString();

        if (arrCode) arrCode.textContent = `${arrIata} / ${arrIcao}`;
        if (arrName) arrName.textContent = (arr.city || '------').toString();
    }
}

function updateFlightCardFromStorage() {
    try {
        const raw = localStorage.getItem(CREW_PORTAL_LS_KEY);
        if (!raw) {
            setFlightCardDashes();
            return;
        }

        const data = JSON.parse(raw);
        updateFlightCardFromData(data);
    } catch (err) {
        console.warn('crewPortalInfo in localStorage is invalid:', err);
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
    const options = {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    };
    return date.toLocaleDateString('ru-RU', options).replace(' г.', '');
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
    const raw = localStorage.getItem(CREW_PORTAL_LS_KEY);
    if (!raw) {
        setTimeDifferenceStatus('empty', 'Нет данных о рейсе');
        return;
    }

    const data = safeParseJson(raw);
    const depIcao = data && data.departure && data.departure.icao ? data.departure.icao.toString().toUpperCase() : '';

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

function openStageModal(stageElement) {
    const stageType = stageElement.dataset.stage;
    const stageTime = stageElement.querySelector('.stage-time').textContent;
    const modal = document.getElementById('stage-modal');
    const modalTitle = document.getElementById('modal-stage-title');
    const modalTimeValue = document.getElementById('modal-time-value');

    // Устанавливаем заголовок в зависимости от типа этапа
    const stageTitles = {
        'rest': 'Редактирование отдыха',
        'sleep': 'Редактирование отбоя',
        'wakeup': 'Редактирование подъёма',
        'taxi': 'Редактирование такси',
        'exit': 'Редактирование выхода'
    };

    modalTitle.textContent = stageTitles[stageType] || 'Редактирование этапа';
    modalTimeValue.textContent = stageTime;

    modal.style.display = 'flex';
}

function closeStageModal() {
    document.getElementById('stage-modal').style.display = 'none';
}

function openFlightModal() {
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

        moscowTimeElement.classList.remove('updating');
        localTimeElement.classList.remove('updating');
    }, 300);
}

// Инициализация и обновление каждую минуту
document.addEventListener('DOMContentLoaded', () => {
    updateTime();
    setInterval(updateTime, 60000); // Обновление каждую минуту
    // Подтягиваем сохранённые данные рейса в карточку при загрузке
    updateFlightCardFromStorage();
    try {
        const raw = localStorage.getItem(CREW_PORTAL_LS_KEY);
        const data = raw ? safeParseJson(raw) : null;
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

    document.getElementById('flight-card').addEventListener('click', openFlightModal);
    document.getElementById('flight-modal-close').addEventListener('click', closeFlightModal);
    document.getElementById('flight-modal-backdrop').addEventListener('click', closeFlightModal);

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
