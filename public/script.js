const socket = io();
const board = document.getElementById('ludo-board');
const diceVal = document.getElementById('dice-val');
const rollBtn = document.getElementById('roll-btn');
const statusDisplay = document.getElementById('status');
const roomId = "sala-pro";
let myColor = "";

const diceSnd = new Audio('https://assets.mixkit.co/active_storage/sfx/2005/2005-preview.mp3');
const moveSnd = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3');
const startSnd = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
const captureSnd = new Audio('https://assets.mixkit.co/active_storage/sfx/2572/2572-preview.mp3'); // Nuevo sonido
const msgSnd = new Audio('https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3'); // Sonido de mensaje

function playSound(snd) { snd.currentTime = 0; snd.play().catch(() => {}); }
// 1. RUTA COMPLETA (Indispensable para que movePiece funcione)
const LUDO_PATH = [
    91, 92, 93, 94, 95, 81, 66, 51, 36, 21, 6, 7, 8, 
    23, 38, 53, 68, 83, 99, 100, 101, 102, 103, 104, 119, 
    134, 133, 132, 131, 130, 129, 143, 158, 173, 188, 203, 
    218, 217, 216, 201, 186, 171, 156, 141, 125, 124, 123, 
    122, 121, 120, 105, 90
];

const BASE_SLOTS = {
    red: [16, 19, 61, 64],
    green: [25, 28, 70, 73],
    blue: [151, 154, 196, 199],
    yellow: [160, 163, 205, 208]
};

const gameState = {
    red: [ {id: 'r1', pos: 'base', inHomeStretch: false, isFinished: false}, {id: 'r2', pos: 'base', inHomeStretch: false, isFinished: false}, {id: 'r3', pos: 'base', inHomeStretch: false, isFinished: false}, {id: 'r4', pos: 'base', inHomeStretch: false, isFinished: false} ],
    green: [ {id: 'g1', pos: 'base', inHomeStretch: false, isFinished: false}, {id: 'g2', pos: 'base', inHomeStretch: false, isFinished: false}, {id: 'g3', pos: 'base', inHomeStretch: false, isFinished: false}, {id: 'g4', pos: 'base', inHomeStretch: false, isFinished: false} ],
    yellow: [ {id: 'y1', pos: 'base', inHomeStretch: false, isFinished: false}, {id: 'y2', pos: 'base', inHomeStretch: false, isFinished: false}, {id: 'y3', pos: 'base', inHomeStretch: false, isFinished: false}, {id: 'y4', pos: 'base', inHomeStretch: false, isFinished: false} ],
    blue: [ {id: 'b1', pos: 'base', inHomeStretch: false, isFinished: false}, {id: 'b2', pos: 'base', inHomeStretch: false, isFinished: false}, {id: 'b3', pos: 'base', inHomeStretch: false, isFinished: false}, {id: 'b4', pos: 'base', inHomeStretch: false, isFinished: false} ]
};

const HOME_STRETCH = {
    red:    [106, 107, 108, 109, 110], // Pasillo horizontal izquierdo
    green:  [22, 37, 52, 67, 82],      // Pasillo vertical superior
    yellow: [114, 115, 116, 117, 118], // Pasillo horizontal derecho
    blue:   [142, 157, 172, 187, 202]  // Pasillo vertical inferior
};

// El índice en LUDO_PATH justo antes de entrar al pasillo
const TURN_POINT = {
    red: 50,    // La casilla 51 es la entrada
    green: 11,  
    yellow: 24, 
    blue: 37    
};

const START_POSITIONS = { 
    red: 91,    // Fila 6, Col 1
    green: 23,  // Fila 1, Col 8 (Corregido: era 7)
    yellow: 133, // Fila 8, Col 13
    blue: 201   // Fila 13, Col 6 (Corregido: era 217)
};
const PATH_START_INDEX = { red: 0, green: 13, yellow: 26, blue: 39 };

// --- INICIALIZACIÓN DEL TABLERO ---
function initBoard() {
    board.innerHTML = '';
    const centerGoal = document.createElement('div');
    centerGoal.classList.add('center-goal');
    board.appendChild(centerGoal);

    for (let i = 0; i < 225; i++) {
        const row = Math.floor(i / 15);
        const col = i % 15;
        if (row >= 6 && row <= 8 && col >= 6 && col <= 8) continue;

        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.index = i;

        if (row < 6 && col < 6) cell.classList.add('home-base', 'red');
        else if (row < 6 && col > 8) cell.classList.add('home-base', 'green');
        else if (row > 8 && col > 8) cell.classList.add('home-base', 'yellow');
        else if (row > 8 && col < 6) cell.classList.add('home-base', 'blue');
        
        if ([...BASE_SLOTS.red, ...BASE_SLOTS.green, ...BASE_SLOTS.yellow, ...BASE_SLOTS.blue].includes(i)) {
            cell.classList.add('piece-slot');
        }

        if (row === 7 && col > 0 && col < 6) cell.classList.add('path-red');
        else if (col === 7 && row > 0 && row < 6) cell.classList.add('path-green');
        else if (row === 7 && col > 8 && col < 14) cell.classList.add('path-yellow');
        else if (col === 7 && row > 8 && row < 14) cell.classList.add('path-blue');
        else if (!cell.classList.contains('home-base')) cell.classList.add('path');

        board.appendChild(cell);
    }
    renderPieces();
}

function renderPieces() {
    document.querySelectorAll('.piece').forEach(p => p.remove());
    Object.keys(gameState).forEach(color => {
        gameState[color].forEach((pData, index) => {
            const p = document.createElement('div');
            p.classList.add('piece', color);
            p.id = pData.id;
            if (pData.pos === 'base') {
                document.querySelector(`[data-index="${BASE_SLOTS[color][index]}"]`).appendChild(p);
            }
        });
    });
}

// --- LÓGICA DE JUEGO ---

rollBtn.onclick = () => {
    rollBtn.disabled = true;
    socket.emit('rollDice', roomId);
};

function enablePieceSelection(diceValue) {
    if (!myColor) return;
    let possibleMoves = 0;
    gameState[myColor].forEach(pData => {
        const pEl = document.getElementById(pData.id);
        if (pData.isFinished) return;
        if (pData.pos === 'base' && diceValue === 6) {
            pEl.classList.add('selectable'); pEl.onclick = () => releasePiece(pData);
            possibleMoves++;
        } else if (pData.pos !== 'base') {
            pEl.classList.add('selectable'); pEl.onclick = () => movePiece(pData, diceValue);
            possibleMoves++;
        }
    });
    if (possibleMoves === 0) {
        statusDisplay.innerText = "No puedes mover. Fin del turno.";
        setTimeout(() => rollBtn.disabled = false, 1500); // Simular cambio de turno
    }
}


async function releasePiece(pData) {
    clearSelection();
    pData.pos = PATH_START_INDEX[myColor];
    document.querySelector(`[data-index="${START_POSITIONS[myColor]}"]`).appendChild(document.getElementById(pData.id));
    playSound(startSnd);
    statusDisplay.innerText = "¡Ficha en juego!";
    rollBtn.disabled = false; // Sacar 6 da turno extra
}

async function movePiece(pData, steps) {
    clearSelection();
    let direction = 1;
    for (let i = 0; i < steps; i++) {
        if (pData.inHomeStretch) {
            let nextPos = pData.pos + direction;
            if (nextPos > 5) { direction = -1; pData.pos = 4; }
            else if (nextPos < 0) { direction = 1; pData.pos = 0; }
            else { pData.pos = nextPos; }
            if (i === steps - 1 && pData.pos === 5) pData.isFinished = true;
        } else if (pData.pos === TURN_POINT[myColor]) {
            pData.inHomeStretch = true; pData.pos = 0;
        } else {
            pData.pos = (pData.pos + 1) % LUDO_PATH.length;
        }

        let targetIndex = pData.isFinished ? 112 : (pData.inHomeStretch ? HOME_STRETCH[myColor][pData.pos] : LUDO_PATH[pData.pos]);
        const targetCell = document.querySelector(`[data-index="${targetIndex}"]`);
        if (targetCell) {
            targetCell.appendChild(document.getElementById(pData.id));
            if(pData.isFinished) { document.getElementById(pData.id).style.opacity = 0.5; statusDisplay.innerText = "¡Ficha en meta!"; }
            else playSound(moveSnd);
        }
        await new Promise(r => setTimeout(r, 250));
    }
    
    // --- NUEVO: Detección de Captura ---
    if (!pData.isFinished && !pData.inHomeStretch) {
        const finalCell = document.querySelector(`[data-index="${LUDO_PATH[pData.pos]}"]`);
        const opponentPiece = Array.from(finalCell.children).find(c => c.classList.contains('piece') && c.id !== pData.id && !c.classList.contains(myColor));
        if (opponentPiece) {
            console.log(`¡Capturando a ${opponentPiece.id}!`);
            socket.emit('capturePiece', { roomId, capturedPieceId: opponentPiece.id, capturerColor: myColor });
        }
    }

    checkWin();
    if(steps !== 6) rollBtn.disabled = false; // Solo repite si es 6 (simplificado)
}

function checkWinCondition() {
    const finishedCount = gameState[myColor].filter(p => p.isFinished).length;
    if (finishedCount === 4) {
        statusDisplay.innerText = "¡HAS GANADO EL JUEGO! 🏆";
        alert("¡Felicidades! Eres el ganador.");
    }
}

function clearSelection() {
    document.querySelectorAll('.piece').forEach(p => {
        p.classList.remove('selectable');
        p.onclick = null;
    });
}

function checkWin() {
    if (gameState[myColor].every(p => p.isFinished)) {
        statusDisplay.innerText = "🎉 ¡HAS GANADO! 🎉"; alert("¡Felicidades! Ganaste la partida.");
    }
}

const chatContainer = document.getElementById('chat-container');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

document.getElementById('toggle-chat-btn').onclick = () => { chatContainer.classList.remove('hidden'); chatInput.focus(); };
document.getElementById('close-chat-btn').onclick = () => chatContainer.classList.add('hidden');

function sendChatMessage() {
    const message = chatInput.value.trim();
    if (message && myColor) {
        socket.emit('chatMessage', { roomId, message, color: myColor });
        chatInput.value = '';
    }
}
document.getElementById('send-chat-btn').onclick = sendChatMessage;
chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendChatMessage(); };

socket.on('chatMessage', ({ message, color }) => {
    const isMe = color === myColor;
    const msgEl = document.createElement('div');
    msgEl.classList.add('message', isMe ? 'my-message' : 'other-message');
    if (!isMe) {
        msgEl.innerHTML = `<span class="message-author ${color}">${color}</span>`;
        playSound(msgSnd); // Sonido al recibir mensaje de otro
    }
    msgEl.appendChild(document.createTextNode(message));
    chatMessages.appendChild(msgEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

// --- COMUNICACIÓN CON EL SERVIDOR ---

socket.on('connect', () => socket.emit('joinRoom', roomId));

socket.on('roomData', (data) => {
    const me = data.players.find(p => p.id === socket.id);
    if(me) {
        myColor = me.color;
        playerColorSpan.className = `color-dot ${myColor}`;
        statusDisplay.innerText = `Conectado. Eres el color ${myColor.toUpperCase()}.`;
    } else {
        statusDisplay.innerText = "Sala llena o error al unir.";
        rollBtn.disabled = true;
    }
});

socket.on('diceResult', (data) => {
    diceVal.innerText = data.value; playSound(diceSnd);
    if (data.playerId === socket.id) {
        statusDisplay.innerText = `¡Sacaste un ${data.value}! Mueve una ficha.`;
        enablePieceSelection(data.value);
    } else {
        statusDisplay.innerText = `Oponente sacó un ${data.value}.`;
    }
});

socket.on('pieceCaptured', ({ capturedPieceId, capturedPieceColor, capturerColor }) => {
    const pieceEl = document.getElementById(capturedPieceId);
    if (pieceEl) {
        // Buscar slot vacío en la base
        const emptySlotIdx = BASE_SLOTS[capturedPieceColor].find(idx => document.querySelector(`[data-index="${idx}"]`).children.length === 0);
        if (emptySlotIdx) {
            document.querySelector(`[data-index="${emptySlotIdx}"]`).appendChild(pieceEl);
            playSound(captureSnd);
            
            // Actualizar estado local si es mi ficha o si la capturé yo
            if (capturedPieceColor === myColor) {
                const myPiece = gameState[myColor].find(p => p.id === capturedPieceId);
                if(myPiece) { myPiece.pos = 'base'; myPiece.inHomeStretch = false; }
                statusDisplay.innerText = "¡Oh no! Te han capturado una ficha.";
            } else if (capturerColor === myColor) {
                statusDisplay.innerText = "¡Captura exitosa! ¡A casa!";
            }
        }
    }
});

initBoard();