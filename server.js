const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let pixels = {}; 
let userStats = {}; 

// Функция расчета цены пикселя
function getPixelPrice(x, y) {
    const centerX = 250; // Центр нашего холста 500x500
    const centerY = 250;
    // Считаем расстояние от центра (теорема Пифагора)
    const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
    
    // В самом центре цена ~50 коинов, по краям ~5 коинов
    const price = Math.max(5, Math.floor(50 - (distance / 7)));
    return price;
}

io.on('connection', (socket) => {
    socket.emit('init_canvas', pixels);

    const farmInterval = setInterval(() => {
        if (!userStats[socket.id]) userStats[socket.id] = { coins: 10, minutesToday: 0 };
        
        if (userStats[socket.id].minutesToday < 180) { // Лимит 3 часа
            userStats[socket.id].coins += 1;
            userStats[socket.id].minutesToday += 1;
            socket.emit('update_balance', userStats[socket.id].coins);
        }
    }, 60000);

    socket.on('draw_pixel', (data) => {
        const { x, y, color } = data;
        const price = getPixelPrice(x, y);

        if (!userStats[socket.id]) userStats[socket.id] = { coins: 10, minutesToday: 0 };

        if (userStats[socket.id].coins >= price) {
            userStats[socket.id].coins -= price;
            pixels[`${x},${y}`] = color;
            io.emit('pixel_updated', { x, y, color });
            socket.emit('update_balance', userStats[socket.id].coins);
        } else {
            socket.emit('error_msg', `Нужно ${price} коинов!`);
        }
    });

    socket.on('disconnect', () => {
        clearInterval(farmInterval);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Сервер запущен: http://localhost:${PORT}`));