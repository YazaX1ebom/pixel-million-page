const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

// База данных в памяти сервера
let accounts = {};    // { "login": { pass, coins, total } }
let activeUsers = {}; // socket.id -> login

io.on('connection', (socket) => {
    
    socket.on('auth', (data) => {
        const { login, pass, isReg } = data;
        const user = login.trim();

        if (isReg) {
            // ПРОВЕРКА НА УНИКАЛЬНОСТЬ
            if (accounts[user]) {
                return socket.emit('error_msg', 'Ошибка: Имя уже занято!');
            }
            // ЗАПОМИНАНИЕ НОВОГО АККАУНТА
            accounts[user] = { pass: pass, coins: 10, total: 0 };
            console.log(`Зарегистрирован новый игрок: ${user}`);
            return socket.emit('success_auth', 'Аккаунт создан!');
        } else {
            // ВХОД В СУЩЕСТВУЮЩИЙ АККАУНТ
            if (accounts[user] && accounts[user].pass === pass) {
                activeUsers[socket.id] = user;
                console.log(`Игрок вошел в систему: ${user}`);
                // Отправляем данные, чтобы убрать окно
                socket.emit('auth_done', { login: user, coins: accounts[user].coins });
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
http.listen(PORT, () => console.log('Сервер запущен на порту ' + PORT));
