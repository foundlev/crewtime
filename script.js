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
    const CREW_PORTAL_LS_KEY = 'crewPortalInfo';
    const CREW_PORTAL_TEST_URL = 'https://myapihelper.na4u.ru/crewtimeapi/test.php?randomDate=false';

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
                await fetchCrewPortalInfo();
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
