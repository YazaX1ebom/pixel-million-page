/* ============================================================
   CLIENT LOGIC: AUTH, GRID & INTERACTION
   ============================================================ */

const socket = io();

// Элементы авторизации
const authOverlay = document.getElementById('auth-overlay');
const authMainBtn = document.getElementById('auth-main-btn');
const authInstruction = document.getElementById('auth-instruction');
const statusMsg = document.getElementById('status-msg');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');

// Состояние
let isRegistrationMode = false;

// --- 1. ЛОГИКА ОКНА ВХОДА ---

// Переключение между Входом и Регистрацией
window.switchAuth = function(mode) {
    const tabLogin = document.getElementById('tab-login');
    const tabReg = document.getElementById('tab-reg');
    
    if (mode === 'reg') {
        isRegistrationMode = true;
        tabReg.classList.add('active');
        tabLogin.classList.remove('active');
        authMainBtn.innerText = "Создать аккаунт";
        authInstruction.innerText = "Придумайте логин и пароль:";
    } else {
        isRegistrationMode = false;
        tabLogin.classList.add('active');
        tabReg.classList.remove('active');
        authMainBtn.innerText = "Войти в систему";
        authInstruction.innerText = "Введите ваши данные для доступа:";
    }
    statusMsg.innerText = ""; // Сброс ошибок
};

// Отправка данных на сервер
window.submitAuth = function() {
    const login = usernameInput.value.trim();
    const pass = passwordInput.value.trim();

    if (!login || !pass) {
        statusMsg.innerText = "Ошибка: Заполните все поля!";
        return;
    }

    statusMsg.style.color = "blue";
    statusMsg.innerText = "Соединение...";

    // Отправляем событие 'auth' (как мы прописали в server.js)
    socket.emit('auth', { 
        login: login, 
        pass: pass, 
        isReg: isRegistrationMode 
    });
};

// --- 2. ОТВЕТЫ СЕРВЕРА ---

// Успешный вход
socket.on('auth_done', (data) => {
    statusMsg.style.color = "green";
    statusMsg.innerText = "Доступ разрешен! Загрузка...";
    
    // Плавное удаление блокировщика
    setTimeout(() => {
        authOverlay.style.display = 'none';
        document.body.style.overflow = 'auto'; // Разрешаем скролл
        document.getElementById('main-site-content').style.filter = 'none';
        
        // Обновляем UI данными с сервера
        document.getElementById('user-name').innerText = data.login;
        document.getElementById('balance').innerText = data.coins;
    }, 500);
});

// Ошибка (неверный пароль, ник занят и т.д.)
socket.on('error_msg', (msg) => {
    statusMsg.style.color = "red";
    statusMsg.innerText = msg;
});

// Сообщение о регистрации
socket.on('success_auth', (msg) => {
    statusMsg.style.color = "green";
    statusMsg.innerText = msg + " Теперь войдите.";
    switchAuth('login'); // Переключаем на вход после регистрации
});

// --- 3. ИГРОВАЯ ЛОГИКА (СЕТКА) ---

const canvas = document.getElementById('pixel-canvas');
const ctx = canvas.getContext('2d');

// Рисуем сетку 1000x1000
function drawGrid() {
    ctx.clearRect(0, 0, 1000, 1000);
    ctx.strokeStyle = "#f0f0f0";
    ctx.lineWidth = 0.5;
    
    for (let i = 0; i <= 1000; i += 20) { // Линии каждые 20 пикселей
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 1000); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1000, i); ctx.stroke();
    }
}

// Запуск сетки при загрузке
drawGrid();

// Обновление баланса в реальном времени
socket.on('update_balance', (data) => {
    document.getElementById('balance').innerText = data.coins;
    document.getElementById('farm-status').innerText = `${data.mins}/60 мин`;
});

window.logout = function() {
    location.reload(); // Простой способ выйти - перезагрузить страницу
};