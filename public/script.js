const socket = io();
const board = document.getElementById('ludo-board');
const diceVal = document.getElementById('dice-val');
const rollBtn = document.getElementById('roll-btn');
const statusDisplay = document.getElementById('status');
const playerColorSpan = document.getElementById('player-color');
const roomId = "sala-pro";
let myColor = "";
let currentTurnColor = "";
let timerInterval;

// --- Sonidos ---
const diceSnd = new Audio('https://assets.mixkit.co/active_storage/sfx/2005/2005-preview.mp3');
const moveSnd = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
const startSnd = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
const captureSnd = new Audio('https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3');
const msgSnd = new Audio('https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3');

function playSound(snd) { snd.currentTime = 0; snd.play().catch(() => {}); }

// --- Datos del Tablero (Se mantienen igual) ---
const LUDO_PATH = [91, 92, 93, 94, 95, 81, 66, 51, 36, 21, 6, 7, 8, 23, 38, 53, 68, 83, 99, 100, 101, 102, 103, 104, 119, 134, 133, 132, 131, 130, 129, 143, 158, 173, 188, 203, 218, 217, 216, 201, 186, 171, 156, 141, 125, 124, 123, 122, 121, 120, 105, 90];
const BASE_SLOTS = { red: [16, 19, 61, 64], green: [25, 28, 70, 73], blue: [151, 154, 196, 199], yellow: [160, 163, 205, 208] };
const START_POSITIONS = { red: 91, green: 23, yellow: 133, blue: 201 };
const PATH_START_INDEX = { red: 0, green: 13, yellow: 26, blue: 39 };
const TURN_POINT = { red: 50, green: 11, yellow: 24, blue: 37 };
const HOME_STRETCH = {
    red: [106, 107, 108, 109, 110], green: [22, 37, 52, 67, 82],
    yellow: [114, 115, 116, 117, 118], blue: [142, 157, 172, 187, 202]
};

let gameState = {
    red: Array(4).fill().map((_, i) => ({id: `r${i+1}`, pos: 'base', inHomeStretch: false, isFinished: false})),
    green: Array(4).fill().map((_, i) => ({id: `g${i+1}`, pos: 'base', inHomeStretch: false, isFinished: false})),
    yellow: Array(4).fill().map((_, i) => ({id: `y${i+1}`, pos: 'base', inHomeStretch: false, isFinished: false})),
    blue: Array(4).fill().map((_, i) => ({id: `b${i+1}`, pos: 'base', inHomeStretch: false, isFinished: false}))
};

// --- Lógica de Inicialización ---
function initBoard() {
    board.innerHTML = '<div class="center-goal"></div>';
    for (let i = 0; i < 225; i++) {
        const row = Math.floor(i / 15), col = i % 15;
        if (row >= 6 && row <= 8 && col >= 6 && col <= 8) continue;
        const cell = document.createElement('div');
        cell.classList.add('cell'); cell.dataset.index = i;
        if (row < 6 && col < 6) cell.classList.add('home-base', 'red');
        else if (row < 6 && col > 8) cell.classList.add('home-base', 'green');
        else if (row > 8 && col > 8) cell.classList.add('home-base', 'yellow');
        else if (row > 8 && col < 6) cell.classList.add('home-base', 'blue');
        if ([...BASE_SLOTS.red, ...BASE_SLOTS.green, ...BASE_SLOTS.yellow, ...BASE_SLOTS.blue].includes(i)) cell.classList.add('piece-slot');
        board.appendChild(cell);
    }
    renderPieces();
}

function renderPieces() {
    document.querySelectorAll('.piece').forEach(p => p.remove());
    Object.keys(gameState).forEach(color => {
        gameState[color].forEach((pData, index) => {
            const p = document.createElement('div');
            p.classList.add('piece', color); p.id = pData.id;
            const parent = pData.pos === 'base' ? 
                document.querySelector(`[data-index="${BASE_SLOTS[color][index]}"]`) :
                (pData.inHomeStretch ? 
                    document.querySelector(`[data-index="${HOME_STRETCH[color][pData.pos]}"]`) :
                    document.querySelector(`[data-index="${LUDO_PATH[pData.pos]}"]`));
            if (parent) parent.appendChild(p);
        });
    });
}

function startTimer() {
    clearInterval(timerInterval);
    const timerBar = document.getElementById('timer-bar');
    let timeLeft = 30; // 30 segundos
    
    timerBar.style.width = "100%";
    timerBar.classList.remove('warning');

    timerInterval = setInterval(() => {
        timeLeft--;
        let percentage = (timeLeft / 30) * 100;
        timerBar.style.width = percentage + "%";

        if (timeLeft <= 10) timerBar.classList.add('warning');

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (myColor === currentTurnColor) {
                statusDisplay.innerText = "¡Tiempo agotado!";
                socket.emit('passTurn', roomId); // Avisar al servidor para pasar el turno
            }
        }
    }, 1000);
}

// --- Movimiento Sincronizado ---
async function movePiece(pData, steps, isRemote = false) {
    clearSelection();
    let color = pData.id.startsWith('r') ? 'red' : pData.id.startsWith('g') ? 'green' : pData.id.startsWith('y') ? 'yellow' : 'blue';
    
    // Si yo muevo, le aviso al resto
    if (!isRemote) {
        socket.emit('movePiece', { roomId, pieceId: pData.id, steps, color: myColor });
    }

    let direction = 1;
    for (let i = 0; i < steps; i++) {
        if (pData.inHomeStretch) {
            let nextPos = pData.pos + direction;
            if (nextPos > 5) { direction = -1; pData.pos = 4; }
            else if (nextPos < 0) { direction = 1; pData.pos = 0; }
            else { pData.pos = nextPos; }
            if (i === steps - 1 && pData.pos === 5) pData.isFinished = true;
        } else if (pData.pos === TURN_POINT[color]) {
            pData.inHomeStretch = true; pData.pos = 0;
        } else {
            pData.pos = (pData.pos + 1) % LUDO_PATH.length;
        }

        let targetIdx = pData.isFinished ? 112 : (pData.inHomeStretch ? HOME_STRETCH[color][pData.pos] : LUDO_PATH[pData.pos]);
        const targetCell = document.querySelector(`[data-index="${targetIdx}"]`);
        if (targetCell) {
            targetCell.appendChild(document.getElementById(pData.id));
            playSound(moveSnd);
        }
        await new Promise(r => setTimeout(r, 200));
    }

    // Detección de Captura (Solo la ejecuta el dueño del turno)
    if (!isRemote && !pData.isFinished && !pData.inHomeStretch) {
        const finalCell = document.querySelector(`[data-index="${LUDO_PATH[pData.pos]}"]`);
        const opponent = Array.from(finalCell.children).find(c => c.classList.contains('piece') && !c.classList.contains(myColor));
        if (opponent) socket.emit('capturePiece', { roomId, capturedPieceId: opponent.id, capturerColor: myColor });
    }

    if (!isRemote && steps !== 6) rollBtn.disabled = false;
    else if (!isRemote && steps === 6) { rollBtn.disabled = false; statusDisplay.innerText = "¡Repites turno por sacar 6!"; }
}

// --- Eventos de Socket ---
socket.on('roomData', (data) => {
    console.log("Datos de sala recibidos:", data);
    const me = data.players.find(p => p.id === socket.id);
    if(me) {
        myColor = me.color;
        document.getElementById('player-color').className = `color-dot ${myColor}`;
        statusDisplay.innerText = `Conectado como ${myColor.toUpperCase()}`;
    }
    
    // Actualizar LEDs
    document.querySelectorAll('.led-item').forEach(item => {
        const color = item.dataset.color;
        item.classList.toggle('connected', data.players.some(p => p.color === color));
    });
});

socket.on('opponentMoved', ({ pieceId, steps, color }) => {
    const pData = gameState[color].find(p => p.id === pieceId);
    if (pData) movePiece(pData, steps, true);
});

socket.on('pieceCaptured', ({ capturedPieceId, capturedPieceColor }) => {
    const pData = gameState[capturedPieceColor].find(p => p.id === capturedPieceId);
    if (pData) {
        pData.pos = 'base'; pData.inHomeStretch = false;
        const slotIdx = BASE_SLOTS[capturedPieceColor][gameState[capturedPieceColor].indexOf(pData)];
        document.querySelector(`[data-index="${slotIdx}"]`).appendChild(document.getElementById(capturedPieceId));
        playSound(captureSnd);
    }
});

socket.on('turnUpdate', (color) => {
    currentTurnColor = color;
    document.getElementById('turn-display').innerText = color.toUpperCase();
    document.getElementById('turn-display').className = `color-dot ${color}`;
    
    // Habilitar botón solo si es mi turno
    rollBtn.disabled = (myColor !== color);
    
    if (myColor === color) {
        statusDisplay.innerText = "¡Es tu turno!";
    } else {
        statusDisplay.innerText = `Esperando a ${color}...`;
    }
    
    startTimer(); // Reiniciar cronómetro para el nuevo turno
});

socket.on('diceResult', (data) => {
    diceVal.innerText = data.value; 
    playSound(diceSnd);
    if (data.playerId === socket.id) 
        enablePieceSelection(data.value);
});

socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    if (!rooms[roomId]) {
        rooms[roomId] = { id: roomId, players: [], turnIndex: 0 };
    }
    const colors = ['red', 'green', 'yellow', 'blue'];
    if (rooms[roomId].players.length < 4 && !rooms[roomId].players.find(p => p.id === socket.id)) {
        const usedColors = rooms[roomId].players.map(p => p.color);
        const availableColor = colors.find(c => !usedColors.includes(c));
        if (availableColor) rooms[roomId].players.push({ id: socket.id, color: availableColor });
    }
    io.to(roomId).emit('roomData', rooms[roomId]);
});

socket.on('movePiece', ({ roomId, pieceId, steps, color }) => {
    // Reenviar a todos menos al que movió (porque él ya lo movió localmente)
    socket.to(roomId).emit('opponentMoved', { pieceId, steps, color });
});

socket.on('disconnecting', () => {
    socket.rooms.forEach(roomId => {
        if (rooms[roomId]) {
            rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);
            io.to(roomId).emit('roomData', rooms[roomId]);
        }
    });
});

// --- Chat y UI ---
function enablePieceSelection(diceValue) {
    let canMove = false;
    gameState[myColor].forEach(pData => {
        const pEl = document.getElementById(pData.id);
        if (pData.isFinished) return;
        if (pData.pos === 'base' && diceValue === 6) {
            pEl.classList.add('selectable');
            pEl.onclick = () => { 
                clearSelection(); 
                pData.pos = PATH_START_INDEX[myColor];
                document.querySelector(`[data-index="${START_POSITIONS[myColor]}"]`).appendChild(pEl);
                socket.emit('movePiece', { roomId, pieceId: pData.id, steps: 0, color: myColor });
                rollBtn.disabled = false;
            };
            canMove = true;
        } else if (pData.pos !== 'base') {
            pEl.classList.add('selectable');
            pEl.onclick = () => movePiece(pData, diceValue);
            canMove = true;
        }
    });
    if (!canMove) { statusDisplay.innerText = "Sin movimientos."; setTimeout(() => rollBtn.disabled = false, 1000); }
}

function clearSelection() {
    document.querySelectorAll('.piece').forEach(p => { p.classList.remove('selectable'); p.onclick = null; });
}

function endTurn(wasSix) {
    if (wasSix) {
        statusDisplay.innerText = "¡Saca 6! Repites.";
        rollBtn.disabled = false;
        startTimer(); // Reiniciamos su propio tiempo
    } else {
        socket.emit('passTurn', roomId);
    }
}

initBoard();