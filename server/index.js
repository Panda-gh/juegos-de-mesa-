const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const rooms = {};

io.on('connection', (socket) => {
    console.log('⚡ Usuario conectado:', socket.id);

    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        if (!rooms[roomId]) {
            rooms[roomId] = { id: roomId, players: [], lastRoll: 0 };
        }
        
        // Evitar duplicados y limitar a 4
        if (rooms[roomId].players.length < 4 && !rooms[roomId].players.find(p => p.id === socket.id)) {
            const colors = ['red', 'green', 'yellow', 'blue'];
            rooms[roomId].players.push({ 
                id: socket.id, 
                color: colors[rooms[roomId].players.length] 
            });
        }
        
        io.to(roomId).emit('roomData', rooms[roomId]);
    });

    socket.on('rollDice', (roomId) => {
        const value = Math.floor(Math.random() * 6) + 1;
        io.to(roomId).emit('diceResult', { 
            value: value, 
            playerId: socket.id 
        });
    });

    socket.on('disconnect', () => {
        console.log('🔥 Usuario desconectado');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor en http://localhost:${PORT}`);
});