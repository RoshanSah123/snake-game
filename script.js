// Game Configuration
const GRID_SIZE = 30;
const CELL_SIZE = 20;
const TICK_START = 180;        // Start slower (180ms between moves)
const TICK_MINIMUM = 60;        // Fastest speed (60ms)
const SPEED_INCREASE_POINTS = 3; // Speed increases every 3 points
const SPEED_INCREMENT = 4;      // Decrease by 4ms each time

// Advanced Particle System
class Particle {
    constructor(x, y, color, velocity) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.velocity = velocity;
        this.life = 1;
        this.decay = 0.02;
        this.size = 3;
    }
    
    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.life -= this.decay;
        this.size *= 0.98;
        return this.life > 0;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 5;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
    }
}

// Game Variables
let canvas, ctx, effectsCanvas, effectsCtx;
let snake = [];
let direction = 'RIGHT';
let nextDirection = 'RIGHT';
let food = { x: 15, y: 15 };
let score = 0;
let highScore = 0;
let level = 1;
let gameLoop = null;
let isGameRunning = false;
let isPaused = false;
let currentSpeed = TICK_START;
let particles = [];
let foodPulse = 0;
let speedMultiplier = 1;

// Audio
let audioContext = null;

// DOM Elements
let scoreElement, highScoreElement, levelElement;
let startScreen, pauseScreen, gameOverModal;
let finalScoreElement, bestScoreElement;

// Initialize
window.addEventListener('DOMContentLoaded', init);

function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    effectsCanvas = document.getElementById('effectsCanvas');
    effectsCtx = effectsCanvas.getContext('2d');
    
    scoreElement = document.getElementById('score');
    highScoreElement = document.getElementById('highScore');
    levelElement = document.getElementById('level');
    startScreen = document.getElementById('startScreen');
    pauseScreen = document.getElementById('pauseScreen');
    gameOverModal = document.getElementById('gameOverModal');
    finalScoreElement = document.getElementById('finalScore');
    bestScoreElement = document.getElementById('bestScore');
    
    loadHighScore();
    
    document.addEventListener('keydown', handleKeyPress);
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('restartBtn').addEventListener('click', () => restartGame());
    document.getElementById('pauseBtn').addEventListener('click', togglePause);
    document.getElementById('resumeBtn').addEventListener('click', togglePause);
    document.getElementById('restartFromPauseBtn').addEventListener('click', () => {
        pauseScreen.style.display = 'none';
        restartGame();
    });
    document.getElementById('modalRestartBtn').addEventListener('click', () => {
        gameOverModal.style.display = 'none';
        restartGame();
    });
    document.getElementById('modalMenuBtn').addEventListener('click', () => {
        gameOverModal.style.display = 'none';
        showStartScreen();
    });
    
    initAudio();
    initGameState();
    draw();
    showStartScreen();
    
    // Animation loop for effects
    function animateEffects() {
        if (effectsCtx) {
            effectsCtx.clearRect(0, 0, canvas.width, canvas.height);
            particles = particles.filter(p => p.update(effectsCtx));
            particles.forEach(p => p.draw(effectsCtx));
        }
        requestAnimationFrame(animateEffects);
    }
    animateEffects();
}

function initGameState() {
    const center = Math.floor(GRID_SIZE / 2);
    snake = [
        { x: center, y: center },
        { x: center - 1, y: center },
        { x: center - 2, y: center }
    ];
    direction = 'RIGHT';
    nextDirection = 'RIGHT';
    score = 0;
    level = 1;
    currentSpeed = TICK_START;
    isPaused = false;
    particles = [];
    speedMultiplier = 1;
    
    updateScoreDisplay();
    generateFood();
}

function showStartScreen() {
    if (gameLoop) {
        clearInterval(gameLoop);
        gameLoop = null;
    }
    isGameRunning = false;
    initGameState();
    draw();
    startScreen.style.display = 'flex';
}

function startGame() {
    startScreen.style.display = 'none';
    isGameRunning = true;
    startGameLoop();
    draw();
    playSound(523.25, 200);
    createParticleExplosion(canvas.width / 2, canvas.height / 2, '#00ff9d', 30);
}

function startGameLoop() {
    if (gameLoop) clearInterval(gameLoop);
    gameLoop = setInterval(() => {
        updateGame();
        draw();
    }, currentSpeed);
}

function updateGame() {
    if (!isGameRunning || isPaused) return;
    
    direction = nextDirection;
    
    const head = snake[0];
    let newHead = { ...head };
    
    switch (direction) {
        case 'UP': newHead.y--; break;
        case 'DOWN': newHead.y++; break;
        case 'LEFT': newHead.x--; break;
        case 'RIGHT': newHead.x++; break;
    }
    
    const isEating = (newHead.x === food.x && newHead.y === food.y);
    
    snake.unshift(newHead);
    
    if (!isEating) {
        snake.pop();
    } else {
        score++;
        updateScoreDisplay();
        playSound(523.25, 150);
        
        // Create particle effect at food position
        createParticleExplosion(food.x * CELL_SIZE, food.y * CELL_SIZE, '#ff4444', 20);
        
        generateFood();
        
        // Increase speed gradually as score increases
        updateGameSpeed();
        
        // Update level (every 5 points)
        level = Math.floor(score / 5) + 1;
        levelElement.textContent = level;
        
        // Visual feedback for speed increase
        if (score > 0 && score % SPEED_INCREASE_POINTS === 0) {
            createParticleExplosion(canvas.width / 2, canvas.height - 50, '#00ff9d', 15);
        }
    }
    
    if (checkCollisions()) {
        gameOver();
    }
}

function updateGameSpeed() {
    // Calculate new speed based on score
    // Starts at TICK_START (180ms) and gradually decreases to TICK_MINIMUM (60ms)
    let targetSpeed = TICK_START - (score * 1.5);
    
    // Clamp between minimum and maximum
    targetSpeed = Math.max(TICK_MINIMUM, Math.min(TICK_START, targetSpeed));
    
    // Only update if speed has changed
    if (targetSpeed !== currentSpeed) {
        currentSpeed = targetSpeed;
        
        // Restart game loop with new speed
        if (gameLoop && isGameRunning && !isPaused) {
            clearInterval(gameLoop);
            gameLoop = setInterval(() => {
                updateGame();
                draw();
            }, currentSpeed);
        }
        
        // Visual speed indicator (flash effect)
        if (score > 0) {
            showSpeedEffect();
        }
    }
}

function showSpeedEffect() {
    // Create a temporary speed line effect
    for (let i = 0; i < 10; i++) {
        setTimeout(() => {
            if (isGameRunning) {
                createParticleExplosion(
                    canvas.width / 2 + (Math.random() - 0.5) * 100,
                    canvas.height - 30,
                    '#00ff9d',
                    2
                );
            }
        }, i * 30);
    }
}

function createParticleExplosion(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        const velocity = {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed
        };
        particles.push(new Particle(x, y, color, velocity));
    }
}

function generateFood() {
    let newFood;
    let validPosition = false;
    
    while (!validPosition) {
        newFood = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE)
        };
        validPosition = !snake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
    }
    
    food = newFood;
    
    // Add glow effect
    foodPulse = 0;
}

function checkCollisions() {
    const head = snake[0];
    
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        createParticleExplosion(head.x * CELL_SIZE, head.y * CELL_SIZE, '#ff0000', 40);
        return true;
    }
    
    for (let i = 1; i < snake.length; i++) {
        if (snake[i].x === head.x && snake[i].y === head.y) {
            createParticleExplosion(head.x * CELL_SIZE, head.y * CELL_SIZE, '#ff0000', 40);
            return true;
        }
    }
    
    return false;
}

function gameOver() {
    isGameRunning = false;
    playSound(261.63, 400);
    saveHighScore();
    
    finalScoreElement.textContent = score;
    bestScoreElement.textContent = highScore;
    gameOverModal.style.display = 'flex';
    
    if (gameLoop) {
        clearInterval(gameLoop);
        gameLoop = null;
    }
}

function restartGame() {
    if (gameLoop) clearInterval(gameLoop);
    startScreen.style.display = 'none';
    pauseScreen.style.display = 'none';
    gameOverModal.style.display = 'none';
    
    initGameState();
    isGameRunning = true;
    startGameLoop();
    draw();
    playSound(523.25, 150);
}

function togglePause() {
    if (!isGameRunning) return;
    
    isPaused = !isPaused;
    const pauseBtn = document.getElementById('pauseBtn');
    
    if (isPaused) {
        pauseBtn.innerHTML = '<span class="btn-icon">▶️</span><span>RESUME</span>';
        pauseScreen.style.display = 'flex';
        playSound(440, 100);
    } else {
        pauseBtn.innerHTML = '<span class="btn-icon">⏸️</span><span>PAUSE</span>';
        pauseScreen.style.display = 'none';
        playSound(523.25, 100);
        draw();
    }
}

function handleKeyPress(e) {
    const key = e.key;
    
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'p', 'P', 'r', 'R'].includes(key)) {
        e.preventDefault();
    }
    
    if (isGameRunning && startScreen.style.display === 'none') {
        if (key === 'ArrowUp' && direction !== 'DOWN') nextDirection = 'UP';
        else if (key === 'ArrowDown' && direction !== 'UP') nextDirection = 'DOWN';
        else if (key === 'ArrowLeft' && direction !== 'RIGHT') nextDirection = 'LEFT';
        else if (key === 'ArrowRight' && direction !== 'LEFT') nextDirection = 'RIGHT';
        
        if (key === 'p' || key === 'P') togglePause();
    }
    
    if (key === 'r' || key === 'R') {
        if (!isGameRunning && gameOverModal.style.display === 'flex') {
            gameOverModal.style.display = 'none';
        }
        if (startScreen.style.display === 'flex') {
            startGame();
        } else {
            restartGame();
        }
    }
}

function updateScoreDisplay() {
    scoreElement.textContent = score;
    saveHighScore();
}

function loadHighScore() {
    const saved = localStorage.getItem('snakeHighScorePremium');
    if (saved) {
        highScore = parseInt(saved);
        highScoreElement.textContent = highScore;
    }
}

function saveHighScore() {
    if (score > highScore) {
        highScore = score;
        highScoreElement.textContent = highScore;
        localStorage.setItem('snakeHighScorePremium', highScore);
    }
}

function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {}
}

function playSound(frequency, duration) {
    if (!audioContext) return;
    if (audioContext.state === 'suspended') audioContext.resume();
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = frequency;
    gainNode.gain.value = 0.2;
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + duration / 1000);
    oscillator.stop(audioContext.currentTime + duration / 1000);
}

function draw() {
    if (!ctx) return;
    
    // Background with gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#0a0a2a');
    gradient.addColorStop(1, '#030318');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Grid with glow
    ctx.strokeStyle = 'rgba(0, 255, 157, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL_SIZE, 0);
        ctx.lineTo(i * CELL_SIZE, canvas.height);
        ctx.stroke();
        ctx.moveTo(0, i * CELL_SIZE);
        ctx.lineTo(canvas.width, i * CELL_SIZE);
        ctx.stroke();
    }
    
    // Food with pulse animation
    foodPulse = (foodPulse + 0.1) % (Math.PI * 2);
    const pulseScale = 0.8 + Math.sin(foodPulse) * 0.2;
    ctx.save();
    ctx.translate(food.x * CELL_SIZE + CELL_SIZE/2, food.y * CELL_SIZE + CELL_SIZE/2);
    ctx.scale(pulseScale, pulseScale);
    ctx.fillStyle = '#ff4444';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff4444';
    ctx.fillRect(-CELL_SIZE/2 + 2, -CELL_SIZE/2 + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    ctx.restore();
    
    // Snake with gradient and glow
    for (let i = 0; i < snake.length; i++) {
        const seg = snake[i];
        const intensity = 1 - (i / snake.length) * 0.5;
        const gradient = ctx.createLinearGradient(
            seg.x * CELL_SIZE, seg.y * CELL_SIZE,
            (seg.x + 1) * CELL_SIZE, (seg.y + 1) * CELL_SIZE
        );
        
        if (i === 0) {
            gradient.addColorStop(0, '#00ff9d');
            gradient.addColorStop(1, '#00cc7a');
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#00ff9d';
        } else {
            gradient.addColorStop(0, `rgba(46, 204, 113, ${intensity})`);
            gradient.addColorStop(1, `rgba(39, 174, 96, ${intensity})`);
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#2ecc71';
        }
        
        ctx.fillStyle = gradient;
        ctx.fillRect(seg.x * CELL_SIZE + 1, seg.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
        
        // Eyes for head
        if (i === 0) {
            ctx.fillStyle = 'white';
            const eyeSize = 3;
            const eyeOffset = 5;
            if (direction === 'RIGHT') {
                ctx.fillRect(seg.x * CELL_SIZE + CELL_SIZE - eyeOffset, seg.y * CELL_SIZE + 5, eyeSize, eyeSize);
                ctx.fillRect(seg.x * CELL_SIZE + CELL_SIZE - eyeOffset, seg.y * CELL_SIZE + CELL_SIZE - 8, eyeSize, eyeSize);
            } else if (direction === 'LEFT') {
                ctx.fillRect(seg.x * CELL_SIZE + eyeOffset - eyeSize, seg.y * CELL_SIZE + 5, eyeSize, eyeSize);
                ctx.fillRect(seg.x * CELL_SIZE + eyeOffset - eyeSize, seg.y * CELL_SIZE + CELL_SIZE - 8, eyeSize, eyeSize);
            } else if (direction === 'UP') {
                ctx.fillRect(seg.x * CELL_SIZE + 5, seg.y * CELL_SIZE + eyeOffset - eyeSize, eyeSize, eyeSize);
                ctx.fillRect(seg.x * CELL_SIZE + CELL_SIZE - 8, seg.y * CELL_SIZE + eyeOffset - eyeSize, eyeSize, eyeSize);
            } else {
                ctx.fillRect(seg.x * CELL_SIZE + 5, seg.y * CELL_SIZE + CELL_SIZE - eyeOffset, eyeSize, eyeSize);
                ctx.fillRect(seg.x * CELL_SIZE + CELL_SIZE - 8, seg.y * CELL_SIZE + CELL_SIZE - eyeOffset, eyeSize, eyeSize);
            }
        }
    }
    
    ctx.shadowBlur = 0;
    
    // Display speed indicator (optional)
    if (isGameRunning && !isPaused) {
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = 'rgba(0, 255, 157, 0.5)';
        ctx.textAlign = 'right';
        const speedPercent = ((TICK_START - currentSpeed) / (TICK_START - TICK_MINIMUM) * 100).toFixed(0);
        ctx.fillText(`SPEED: ${speedPercent}%`, canvas.width - 10, 25);
    }
}