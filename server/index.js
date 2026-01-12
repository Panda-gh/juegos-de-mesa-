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
    cors: { origin: "*" }
});

const rooms = {};

io.on('connection', (socket) => {
    console.log('⚡ Usuario conectado:', socket.id);

    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        if (!rooms[roomId]) {
            // Estado básico del juego en el servidor
            rooms[roomId] = { 
                id: roomId, 
                players: [],
                // Podrías añadir aquí el control de turnos en el futuro
                // currentTurnIndex: 0, 
                // turnOrder: ['red', 'green', 'yellow', 'blue']
            };
        }
        
        // Asignar color si hay espacio y no está repetido
        const colors = ['red', 'green', 'yellow', 'blue'];
        const existingPlayer = rooms[roomId].players.find(p => p.id === socket.id);
        
        if (!existingPlayer && rooms[roomId].players.length < 4) {
            const availableColor = colors.find(c => !rooms[roomId].players.some(p => p.color === c));
            if (availableColor) {
                rooms[roomId].players.push({ id: socket.id, color: availableColor });
            }
        }
        
        io.to(roomId).emit('roomData', rooms[roomId]);
    });

    socket.on('rollDice', (roomId) => {
        const value = Math.floor(Math.random() * 6) + 1;
        io.to(roomId).emit('diceResult', { value: value, playerId: socket.id });
    });

    // --- NUEVO: Lógica de Captura ---
    socket.on('capturePiece', ({ roomId, capturedPieceId, capturerColor }) => {
        console.log(`⚔️ Captura en sala ${roomId}: ${capturerColor} capturó a ${capturedPieceId}`);
        // Mapear ID de ficha a su color (ej: 'r1' -> 'red')
        const colorMap = { 'r': 'red', 'g': 'green', 'y': 'yellow', 'b': 'blue' };
        const capturedPieceColor = colorMap[capturedPieceId.charAt(0)];

        // Avisar a todos para que animen la captura
        io.to(roomId).emit('pieceCaptured', { capturedPieceId, capturedPieceColor, capturerColor });
    });

    // --- NUEVO: Lógica del Chat Volátil ---
    socket.on('chatMessage', ({ roomId, message, color }) => {
        // Reenviar el mensaje a todos en la sala
        io.to(roomId).emit('chatMessage', { message, color });
    });

    socket.on('disconnect', () => {
        console.log('🔥 Usuario desconectado');
        // En un juego real, aquí deberías manejar la desconexión de un jugador
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});