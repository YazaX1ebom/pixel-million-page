// Автоматическое определение адреса сервера
const socket = io(); 

const authOverlay = document.getElementById('auth-overlay');
const statusMsg = document.getElementById('status-msg');

// ПРОВЕРКА СОЕДИНЕНИЯ (Добавлено для диагностики)
socket.on('connect', () => {
    console.log("Соединение с сервером установлено!");
    statusMsg.style.color = "gray";
    statusMsg.innerText = "Система готова к работе";
});

socket.on('connect_error', () => {
    statusMsg.style.color = "red";
    statusMsg.innerText = "ОШИБКА: Сервер недоступен. Проверь логи Render!";
});

// ФУНКЦИЯ ВХОДА/РЕГИСТРАЦИИ
window.submitAuth = function() {
    const login = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();

    if (!login || !pass) {
        statusMsg.innerText = "Введите логин и пароль!";
        statusMsg.style.color = "red";
        return;
    }

    // Если это регистрация (проверяем по тексту на кнопке)
    const isReg = document.getElementById('auth-main-btn').innerText.includes("аккаунт");
    
    statusMsg.style.color = "blue";
    statusMsg.innerText = isReg ? "Создаю аккаунт..." : "Вхожу...";

    socket.emit('auth', { login, pass, isReg });
};

// ОТВЕТЫ СЕРВЕРА
socket.on('auth_done', (data) => {
    statusMsg.style.color = "green";
    statusMsg.innerText = "Успешно! Входим...";
    setTimeout(() => {
        authOverlay.style.display = 'none';
        document.getElementById('user-name').innerText = data.login;
        document.getElementById('balance').innerText = data.coins;
    }, 600);
});

socket.on('error_msg', (msg) => {
    statusMsg.style.color = "red";
    statusMsg.innerText = msg;
});

socket.on('success_auth', (msg) => {
    statusMsg.style.color = "green";
    statusMsg.innerText = msg + " Теперь нажмите 'Войти'";
    // Автоматически переключаем на вход после регистрации
    window.switchAuth('login');
});
