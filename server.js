/* ============================================================
   ADVANCED PIXEL SERVER v4.0 - PROFESSIONAL LOGGING EDITION
   ============================================================ */

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

// 1. НАСТРОЙКА СТАТИКИ
app.use(express.static(path.join(__dirname, 'public')));

// 2. ГЛОБАЛЬНЫЕ ДАННЫЕ
let pixels = {};      
let accounts = {};    
let activeSessions = {}; 

const DAILY_LIMIT = 60; // Максимум минут фарма в сутки

// 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (Логирование)
function logAction(type, msg) {
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] [${type.toUpperCase()}] ${msg}`);
}

// Проверка сброса лимита раз в сутки
function checkDailyReset(user) {
    const now = Date.now();
    if (now - user.lastReset > 24 * 60 * 60 * 1000) {
        user.dailyMins = 0;
        user.lastReset = now;
        return true;
    }
    return false;
}

// 4. ЯДРО ОБРАБОТКИ СОБЫТИЙ
io.on('connection', (socket) => {
    logAction('net', `Новое подключение: ${socket.id}`);

    // --- АВТОРИЗАЦИЯ ---
    socket.on('auth', (data) => {
        const { login, pass, isReg } = data;
        
        if (!login || !pass) return socket.emit('error_msg', 'Поля не могут быть пустыми!');

        if (isReg) {
            if (accounts[login]) {
                logAction('auth', `Отказ: Ник ${login} занят.`);
                return socket.emit('error_msg', 'Это имя уже занято!');
            }
            accounts[login] = { 
                pass, 
                coins: 10, 
                total: 0, 
                dailyMins: 0, 
                lastReset: Date.now() 
            };
            logAction('auth', `Новый игрок: ${login}`);
            return socket.emit('success_auth', 'Регистрация прошла успешно!');
        }

        if (accounts[login] && accounts[login].pass === pass) {
            activeSessions[socket.id] = login;
            checkDailyReset(accounts[login]);
            
            logAction('auth', `Вход: ${login}`);
            socket.emit('auth_done', { 
                login: login, 
                coins: accounts[login].coins 
            });
            socket.emit('init_canvas', pixels);
        } else {
            socket.emit('error_msg', 'Неверный логин или пароль!');
        }
    });

    // --- СИСТЕМА ФАРМА (Раз в минуту) ---
    const farmInterval = setInterval(() => {
        const login = activeSessions[socket.id];
        if (!login) return;

        const user = accounts[login];
        checkDailyReset(user);

        if (user.dailyMins < DAILY_LIMIT) {
            user.dailyMins++;
            user.coins++;
            socket.emit('update_balance', { 
                coins: user.coins, 
                mins: user.dailyMins 
            });
            // logAction('farm', `${login} получил монету. Всего: ${user.dailyMins}/60`);
        }
    }, 60000);

    // --- РИСОВАНИЕ ---
    socket.on('draw_pixel', (data) => {
        const login = activeSessions[socket.id];
        if (!login) return socket.emit('error_msg', 'Ошибка сессии!');

        const { x, y, color } = data;
        const acc = accounts[login];

        if (acc.coins >= 1) {
            acc.coins -= 1;
            acc.total++;
            
            const timestamp = new Date().toLocaleString('ru-RU');
            pixels[`${x},${y}`] = { 
                color: color, 
                owner: login, 
                date: timestamp 
            };

            io.emit('pixel_updated', { x, y, ...pixels[`${x},${y}`] });
            socket.emit('update_balance', { coins: acc.coins, mins: acc.dailyMins });
            logAction('game', `${login} поставил пиксель в [${x},${y}]`);
        } else {
            socket.emit('error_msg', 'Недостаточно коинов!');
        }
    });

    // --- ТОП ЛИДЕРОВ ---
    socket.on('get_top', () => {
        const topData = Object.entries(accounts)
            .map(([name, info]) => ({ login: name, score: info.total }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 15);
        socket.emit('top_data', topData);
    });

    // --- ОТКЛЮЧЕНИЕ ---
    socket.on('disconnect', () => {
        const login = activeSessions[socket.id];
        if (login) logAction('net', `Пользователь ${login} вышел.`);
        clearInterval(farmInterval);
        delete activeSessions[socket.id];
    });
});

// 5. ЗАПУСК СЕТИ
const PORT = process.env.PORT || 10000;
http.listen(PORT, () => {
    console.log("========================================");
    console.log(`  СЕРВЕР ЗАПУЩЕН НА ПОРТУ: ${PORT}`);
    console.log(`  РЕЖИМ: PRODUCTION`);
    console.log(`  БАЗА ДАННЫХ: ОПЕРАТИВНАЯ ПАМЯТЬ`);
    console.log("========================================");
});
