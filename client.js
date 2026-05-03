const socket = io();

// Элементы
const authOverlay = document.getElementById('auth-overlay');
const statusMsg = document.getElementById('status-msg');

// Функция отправки (вызывается из HTML)
window.submitAuth = function() {
    const login = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    // Определяем режим по тексту кнопки
    const isReg = document.getElementById('auth-main-btn').innerText.includes("Создать");

    if(!login || !pass) return alert("Заполните поля!");

    socket.emit('auth', { login, pass, isReg });
};

// СЛУШАЕМ ОТВЕТЫ СЕРВЕРА
socket.on('auth_done', (data) => {
    // 1. Окно пропадает
    authOverlay.style.display = 'none';
    // 2. Разблокируем интерфейс
    document.getElementById('main-site-content').style.filter = 'none';
    // 3. Выводим данные
    document.getElementById('user-name').innerText = data.login;
    document.getElementById('balance').innerText = data.coins;
});

socket.on('success_auth', (msg) => {
    alert(msg + " Теперь нажмите 'Войти'");
    window.switchAuth('login'); // Переключаем вкладку автоматически
});

socket.on('error_msg', (msg) => {
    statusMsg.innerText = msg;
    statusMsg.style.color = "red";
});

// Переключатель вкладок
window.switchAuth = function(mode) {
    const btn = document.getElementById('auth-main-btn');
    if (mode === 'reg') {
        btn.innerText = "Создать аккаунт";
        document.getElementById('tab-reg').classList.add('active');
        document.getElementById('tab-login').classList.remove('active');
    } else {
        btn.innerText = "Войти в систему";
        document.getElementById('tab-login').classList.add('active');
        document.getElementById('tab-reg').classList.remove('active');
    }
};
