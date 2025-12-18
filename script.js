// ===== Работа с данными рейса из localStorage (crewPortalInfo) =====
const CREW_PORTAL_LS_KEY = 'crewPortalInfo';
const CREW_PORTAL_TEST_URL = 'https://myapihelper.na4u.ru/crewtimeapi/test.php?randomDate=false';

// ===== Настройки этапов (localStorage) =====
const STAGE_SETTINGS_LS_KEY = 'stageSettings';

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

    const startDateStr = data.startDate;
    const startDate = startDateStr ? new Date(startDateStr) : null;

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

// Функция для вычисления разницы во времени
function calculateTimeDifference(moscowDate, localDate) {
    const moscowTime = moscowDate.getTime();
    const localTime = localDate.getTime();
    const diffMs = localTime - moscowTime;
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));

    let sign = diffHours >= 0 ? '+' : '-';
    return `${sign}${Math.abs(diffHours)}ч`;
}

// Функция для расчета времени до следующего этапа
function calculateNextStageTime() {
    const now = new Date();
    const nextStageTime = new Date();

    // Демо: следующий этап - отход ко сну в 22:00 сегодня
    nextStageTime.setHours(22, 0, 0, 0);

    // Если время уже прошло, берем на завтра
    if (now > nextStageTime) {
        nextStageTime.setDate(nextStageTime.getDate() + 1);
    }

    const diffMs = nextStageTime - now;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours} ч ${minutes} мин`;
}

// Управление настройками сна
let sleepHours = 9;
let sleepMinutes = 0;

function updateSleepDisplay() {
    const sleepValueElement = document.getElementById('sleep-value');
    const decreaseButton = document.getElementById('sleep-decrease');
    const increaseButton = document.getElementById('sleep-increase');

    sleepValueElement.textContent = `${sleepHours}:${sleepMinutes.toString().padStart(2, '0')}`;

    // Блокировка кнопок при достижении границ
    decreaseButton.disabled = sleepHours === 0 && sleepMinutes === 30;
    increaseButton.disabled = sleepHours === 15 && sleepMinutes === 0;
}

function changeSleepTime(minutes) {
    const totalMinutes = sleepHours * 60 + sleepMinutes + minutes;

    // Проверка границ (от 30 минут до 15 часов)
    if (totalMinutes < 30) return;
    if (totalMinutes > 15 * 60) return;

    sleepHours = Math.floor(totalMinutes / 60);
    sleepMinutes = totalMinutes % 60;

    updateSleepDisplay();
}

// Управление модальными окнами
function openSettingsModal() {
    applyStageSettingsToUI('home');
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
        nextStageTimeElement.textContent = calculateNextStageTime();

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
    applyStageSettingsToUI('home');
    applyAuthToUI();

    // Инициализация настроек сна
    updateSleepDisplay();

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

        // пока считаем, что выезд из дома
        applyStageSettingsToUI('home');
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
        const sleepStages = document.querySelectorAll('.stage-item[data-stage="rest"], .stage-item[data-stage="sleep"]');
        if (this.checked) {
            sleepStages.forEach(stage => {
                stage.classList.remove('stage-inactive');
            });
        } else {
            sleepStages.forEach(stage => {
                stage.classList.add('stage-inactive');
            });
        }
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
