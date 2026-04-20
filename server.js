/* ============================================================
   THE MILLION PIXEL FARM - CORE SERVER ENGINE v3.0
   ============================================================ */

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static('public'));

// --- ГЛОБАЛЬНЫЕ ХРАНИЛИЩА (In-Memory DB) ---
// В реальном проекте здесь должна быть MongoDB или PostgreSQL
let pixels = {};      // Хранит: "x,y": { color, owner, date }
let accounts = {};    // Хранит: "login": { pass, coins, totalPlaced, dailyMins, lastReset }
let activeUsers = {}; // Хранит текущие сессии: socket.id -> login

// --- КОНФИГУРАЦИЯ ---
const MAX_DAILY_COINS = 60;
const PIXEL_SIZE = 1000;

// --- ВСПОМОГАТЕЛЬНАЯ ЛОГИКА ---

/**
 * Рассчитывает стоимость пикселя в зависимости от его координат.
 * Чем ближе к центру (500, 500), тем дороже.
 */
function calculatePrice(x, y) {
    const centerX = 500;
    const centerY = 500;
    const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
    
    if (distance < 150) return 25; // Центральная зона
    if (distance < 350) return 10; // Средняя зона
    return 2;                      // Периферия
}

/**
 * Проверяет, прошло ли 24 часа с момента последнего сброса лимита.
 */
function handleDailyReset(account) {
    const now = new Date();
    const lastReset = new Date(account.lastReset || 0);
    
    // Если прошло больше 24 часов
    if (now - lastReset > 24 * 60 * 60 * 1000) {
        account.dailyMins = 0;
        account.lastReset = now;
        return true;
    }
    return false;
}

// --- ОБРАБОТКА СОЕДИНЕНИЙ ---

io.on('connection', (socket) => {
    console.log(`[NET] New connection: ${socket.id}`);

    // 1. Авторизация и Регистрация
    socket.on('auth', (data) => {
        const { login, pass, isReg } = data;

        if (isReg) {
            if (accounts[login]) {
                return socket.emit('error_msg', 'Это имя уже занято!');
            }
            accounts[login] = {
                pass: pass,
                coins: 10, // Стартовый капитал
                totalPlaced: 0,
                dailyMins: 0,
                lastReset: new Date()
            };
            console.log(`[AUTH] New user registered: ${login}`);
        }

        const user = accounts[login];
        if (user && user.pass === pass) {
            activeUsers[socket.id] = login;
            handleDailyReset(user);
            
            socket.emit('auth_done', { 
                login, 
                coins: user.coins,
                dailyMins: user.dailyMins 
            });
            
            // Отправляем текущее состояние холста
            socket.emit('init_canvas', pixels);
        } else {
            socket.emit('error_msg', 'Неверный логин или пароль!');
        }
    });

    // 2. Система Фарма (Цикл раз в минуту)
    const farmInterval = setInterval(() => {
        const login = activeUsers[socket.id];
        if (!login) return;

        const user = accounts[login];
        handleDailyReset(user);

        if (user.dailyMins < MAX_DAILY_COINS) {
            user.dailyMins++;
            user.coins++;
            
            socket.emit('update_balance', { 
                coins: user.coins, 
                dailyMins: user.dailyMins,
                timeLeft: MAX_DAILY_COINS - user.dailyMins 
            });
        }
    }, 60000); // 60 секунд

    // 3. Рисование одного пикселя
    socket.on('draw_pixel', (data) => {
        const login = activeUsers[socket.id];
        if (!login) return socket.emit('error_msg', 'Сначала войдите!');

        const { x, y, color } = data;
        if (x < 0 || x >= PIXEL_SIZE || y < 0 || y >= PIXEL_SIZE) return;

        const price = calculatePrice(x, y);
        const user = accounts[login];

        if (user.coins >= price) {
            user.coins -= price;
            user.totalPlaced++;

            const timestamp = new Date().toLocaleString('ru-RU', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            });

            const pixelInfo = { color, owner: login, date: timestamp };
            pixels[`${x},${y}`] = pixelInfo;

            // Рассылаем всем обновление
            io.emit('pixel_updated', { x, y, ...pixelInfo });
            // Обновляем баланс только владельцу
            socket.emit('update_balance', { coins: user.coins, dailyMins: user.dailyMins });
        } else {
            socket.emit('error_msg', `Недостаточно коинов! Нужно: ${price}`);
        }
    });

    // 4. Массовая застройка (Область)
    socket.on('draw_area', (data) => {
        const login = activeUsers[socket.id];
        const user = accounts[login];
        if (!user) return;

        const { startX, startY, endX, endY, color } = data;
        let totalCost = 0;
        let pixelsToDraw = [];

        // Расчет стоимости всей области
        for (let ix = startX; ix <= endX; ix++) {
            for (let iy = startY; iy <= endY; iy++) {
                totalCost += calculatePrice(ix, iy);
                pixelsToDraw.push({ x: ix, y: iy });
            }
        }

        if (user.coins >= totalCost) {
            user.coins -= totalCost;
            const timestamp = new Date().toLocaleString();

            pixelsToDraw.forEach(p => {
                const pixelInfo = { color, owner: login, date: timestamp };
                pixels[`${p.x},${p.y}`] = pixelInfo;
                io.emit('pixel_updated', { x: p.x, y: p.y, ...pixelInfo });
            });

            socket.emit('update_balance', { coins: user.coins, dailyMins: user.dailyMins });
        } else {
            socket.emit('error_msg', `Массовая застройка отклонена! Нужно: ${totalCost} коинов.`);
        }
    });

    // 5. Запрос ТОП-15
    socket.on('get_top', () => {
        const topList = Object.entries(accounts)
            .map(([name, data]) => ({ login: name, score: data.totalPlaced }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 15);
        socket.emit('top_data', topList);
    });

    // Отключение пользователя
    socket.on('disconnect', () => {
        console.log(`[NET] User disconnected: ${socket.id}`);
        clearInterval(farmInterval);
        delete activeUsers[socket.id];
    });
});

// --- ЗАПУСК ---
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`
    =============================================
    SERVER IS ONLINE: http://localhost:${PORT}
    PIXEL GRID: 1000x1000
    DAILY FARM LIMIT: ${MAX_DAILY_COINS} minutes
    =============================================
    `);
});