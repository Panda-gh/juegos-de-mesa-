const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, '../public')));

const server = http.createServer(app);
const io = new Server(server);

const rooms = {};
const COLORS = ['red', 'green', 'yellow', 'blue'];

io.on('connection', (socket) => {
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        if (!rooms[roomId]) {
            rooms[roomId] = { 
                players: [], 
                turnIndex: 0 
            };
        }

        const room = rooms[roomId];
        
        // Asignar color solo si no tiene uno
        if (room.players.length < 4 && !room.players.find(p => p.id === socket.id)) {
            const usedColors = room.players.map(p => p.color);
            const availableColor = COLORS.find(c => !usedColors.includes(c));
            if (availableColor) {
                room.players.push({ id: socket.id, color: availableColor });
            }
        }

        io.to(roomId).emit('roomData', room);
        // Notificar de quién es el turno inicialmente
        if (room.players.length > 0) {
            io.to(roomId).emit('turnUpdate', room.players[room.turnIndex].color);
        }
    });

    socket.on('rollDice', (roomId) => {
        const room = rooms[roomId];
        if (!room || room.players.length === 0) return;
    
        // SEGURIDAD: Verificar si el que lanza es el dueño del turno
        const currentPlayer = room.players[room.turnIndex];
        
        if (currentPlayer && currentPlayer.id === socket.id) {
            const value = Math.floor(Math.random() * 6) + 1;
            io.to(roomId).emit('diceResult', { 
                value, 
                playerId: socket.id,
                color: currentPlayer.color 
            });
            console.log(`Jugador ${currentPlayer.color} lanzó un ${value}`);
        } else {
            console.log(`Intento de trampa: ${socket.id} intentó lanzar sin ser su turno.`);
        }
    });

    socket.on('passTurn', (roomId) => {
        const room = rooms[roomId];
        if (!room || room.players.length === 0) return;
    
        // SEGURIDAD: Solo el jugador actual o el sistema (si añades tiempo) pueden pasar turno
        const currentPlayer = room.players[room.turnIndex];
        
        if (currentPlayer && currentPlayer.id === socket.id) {
            room.turnIndex = (room.turnIndex + 1) % room.players.length;
            const nextColor = room.players[room.turnIndex].color;
            io.to(roomId).emit('turnUpdate', nextColor);
        }
    });

    socket.on('disconnecting', () => {
        socket.rooms.forEach(roomId => {
            if (rooms[roomId]) {
                rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);
                if (rooms[roomId].players.length === 0) {
                    delete rooms[roomId];
                } else {
                    io.to(roomId).emit('roomData', rooms[roomId]);
                }
            }
        });
    });
});

server.listen(3000, () => console.log("🚀 Ludo Pro en puerto 3000"));
