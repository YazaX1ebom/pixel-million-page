const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

// РАЗДАЧА ФАЙЛОВ
app.use(express.static(path.join(__dirname, 'public')));

// БАЗА ДАННЫХ (в памяти сервера)
let accounts = {};    
let activeUsers = {}; 
let pixels = {};

io.on('connection', (socket) => {
    console.log('Новое подключение:', socket.id);

    socket.on('auth', (data) => {
        const { login, pass, isReg } = data;
        const user = login ? login.trim() : "";

        if (!user || !pass) return socket.emit('error_msg', 'Заполните все поля!');

        if (isReg) {
            // Проверка на уникальность имени
            if (accounts[user]) {
                return socket.emit('error_msg', 'Ошибка: Имя уже занято!');
            }
            // Сохранение нового пользователя
            accounts[user] = { pass: pass, coins: 10, total: 0 };
            console.log(`Создан аккаунт: ${user}`);
            return socket.emit('success_auth', 'Аккаунт создан успешно!');
        } else {
            // Проверка при входе
            if (accounts[user] && accounts[user].pass === pass) {
                activeUsers[socket.id] = user;
                console.log(`Пользователь вошел: ${user}`);
                // Отправляем сигнал, чтобы убрать окно входа
                socket.emit('auth_done', { login: user, coins: accounts[user].coins });
                socket.emit('init_canvas', pixels);
            } else {
                socket.emit('error_msg', 'Ошибка: Неверный логин или пароль!');
            }
        }
    });

    socket.on('disconnect', () => {
        delete activeUsers[socket.id];
    });
});

const PORT = process.env.PORT || 10000;
http.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
