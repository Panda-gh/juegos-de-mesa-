const socket = io();
const board = document.getElementById('ludo-board');
const diceVal = document.getElementById('dice-val');
const rollBtn = document.getElementById('roll-btn');
const status = document.getElementById('status'); // <-- Faltaba esto

const diceSnd = new Audio('https://www.soundjay.com/board-games/sounds/dice-roll-1.mp3');
const moveSnd = new Audio('https://www.soundjay.com/button/sounds/button-16.mp3');
const startSnd = new Audio('https://www.soundjay.com/button/sounds/button-3.mp3');

const roomId = "sala-pro";
let myColor = "";

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
    red: [ {id: 'r1', pos: 'base'}, {id: 'r2', pos: 'base'}, {id: 'r3', pos: 'base'}, {id: 'r4', pos: 'base'} ],
    green: [ {id: 'g1', pos: 'base'}, {id: 'g2', pos: 'base'}, {id: 'g3', pos: 'base'}, {id: 'g4', pos: 'base'} ],
    yellow: [ {id: 'y1', pos: 'base'}, {id: 'y2', pos: 'base'}, {id: 'y3', pos: 'base'}, {id: 'y4', pos: 'base'} ],
    blue: [ {id: 'b1', pos: 'base'}, {id: 'b2', pos: 'base'}, {id: 'b3', pos: 'base'}, {id: 'b4', pos: 'base'} ]
};

const START_POSITIONS = { red: 91, green: 7, yellow: 133, blue: 217 };
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
        
        const allBaseIndices = [...BASE_SLOTS.red, ...BASE_SLOTS.green, ...BASE_SLOTS.yellow, ...BASE_SLOTS.blue];
        if (allBaseIndices.includes(i)) {
            cell.classList.add('piece-slot');
            cell.style.background = "white";
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
                const slotIndex = BASE_SLOTS[color][index];
                document.querySelector(`[data-index="${slotIndex}"]`).appendChild(p);
            }
        });
    });
}

// --- LÓGICA DE JUEGO ---

rollBtn.onclick = () => {
    socket.emit('rollDice', roomId);
};

function enablePieceSelection(diceValue) {
    if (!myColor) return;
    const myPieces = gameState[myColor];
    let possibleMoves = 0;

    myPieces.forEach(pData => {
        const pieceElement = document.getElementById(pData.id);
        if (pData.pos === 'base' && diceValue === 6) {
            pieceElement.classList.add('selectable');
            pieceElement.onclick = () => releasePiece(pData);
            possibleMoves++;
        } else if (pData.pos !== 'base') {
            pieceElement.classList.add('selectable');
            pieceElement.onclick = () => movePiece(pData, diceValue);
            possibleMoves++;
        }
    });

    if (possibleMoves === 0) status.innerText = "No puedes mover ninguna ficha.";
}

async function releasePiece(pData) {
    clearSelection();
    pData.pos = PATH_START_INDEX[myColor];
    const startGridIndex = START_POSITIONS[myColor];
    document.querySelector(`[data-index="${startGridIndex}"]`).appendChild(document.getElementById(pData.id));
    status.innerText = "¡Ficha en juego!";
}

async function movePiece(pData, steps) {
    clearSelection();
    for (let i = 0; i < steps; i++) {
        pData.pos = (pData.pos + 1) % LUDO_PATH.length;
        const nextGridIndex = LUDO_PATH[pData.pos];
        document.querySelector(`[data-index="${nextGridIndex}"]`).appendChild(document.getElementById(pData.id));
        await new Promise(r => setTimeout(r, 200));
    }
}

function clearSelection() {
    document.querySelectorAll('.piece').forEach(p => {
        p.classList.remove('selectable');
        p.onclick = null;
    });
}

// --- COMUNICACIÓN CON EL SERVIDOR ---

socket.on('connect', () => socket.emit('joinRoom', roomId));

socket.on('roomData', (data) => {
    const me = data.players.find(p => p.id === socket.id);
    if(me) {
        myColor = me.color;
        status.innerText = `Conectado como: ${myColor}`;
    }
});

socket.on('diceResult', (data) => {
    diceVal.innerText = data.value;
    if (data.playerId === socket.id) {
        status.innerText = `¡Sacaste ${data.value}!`;
        enablePieceSelection(data.value);
    } else {
        status.innerText = "Esperando oponente...";
    }
});

initBoard();