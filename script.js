(() => {
    'use strict';

    // ---------- Config (logical units, the canvas scales to fit the screen) ----------
    const W = 300;
    const H = 500;
    const BLOCK_H = 22;          // height of one stacked block
    const BASE_W = 170;          // width of the starting block
    const MIN_W = 6;             // never spawn a block thinner than this
    const GROUND_Y = H - 30;     // y of the ground line (bottom of the base block)
    const HOOK_Y = 110;          // screen y where a swinging block hangs
    const CAM_LINE = 230;        // screen y where the top of the tower is kept
    const PERFECT_TOL = 3;       // px: how close to centred counts as "perfect"
    const SLOPPY_RATIO = 0.35;   // overlap below this share of the block costs a life
    const GRAVITY = 0.0022;      // px / ms^2
    const MAX_LIVES = 3;

    const CLOUDS = [
        { y: 80,  s: 1.0,  sp: 0.007, o: 0 },
        { y: 170, s: 0.7,  sp: 0.012, o: 140 },
        { y: 300, s: 0.85, sp: 0.005, o: 60 }
    ];
    const SKYLINE = Array.from({ length: 9 }, (_, i) => ({
        x: i * 38 - 8,
        w: 34 + ((i * 13) % 14),
        h: 60 + ((i * 37) % 80)
    }));

    // ---------- DOM ----------
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const startScreen = document.getElementById('start-screen');
    const gameOverScreen = document.getElementById('game-over-screen');
    const startButton = document.getElementById('start-button');
    const restartButton = document.getElementById('restart-button');
    const scoreEl = document.getElementById('score');
    const livesEl = document.getElementById('lives');
    const bestEl = document.getElementById('best');
    const finalScoreEl = document.getElementById('final-score');
    const newBestEl = document.getElementById('new-best');

    // ---------- Best score (storage may be blocked, so guard it) ----------
    function loadBest() {
        try {
            return Number(localStorage.getItem('stackBest')) || 0;
        } catch (e) {
            return 0;
        }
    }

    function saveBest(value) {
        try {
            localStorage.setItem('stackBest', String(value));
        } catch (e) {
            /* ignore: best score simply will not persist */
        }
    }

    // ---------- State ----------
    let best = loadBest();
    let mode = 'idle';           // idle | swing | drop | ending | over
    let stack = [];              // placed blocks, index 0 is the base
    let cur = null;              // block swinging on the crane
    let falling = null;          // block being dropped
    let score = 0;
    let lives = MAX_LIVES;
    let combo = 0;
    let phase = 0;               // crane swing phase (radians)
    let cam = 0;                 // smoothed camera offset (px)
    let camTarget = 0;
    let shake = 0;
    let endTimer = 0;
    let time = 0;                // total elapsed ms (for clouds)
    let particles = [];
    let debris = [];
    let floaters = [];
    let lastFrame = performance.now();

    // ---------- Helpers ----------
    function makeBlock(x, w, index) {
        return { x, w, hue: (index * 23 + 200) % 360, sat: 70 };
    }

    function topBlock() {
        return stack[stack.length - 1];
    }

    function roundRect(x, y, w, h, r) {
        const width = Math.max(0, w);
        const radius = Math.max(0, Math.min(r, width / 2, h / 2));
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + width, y, x + width, y + h, radius);
        ctx.arcTo(x + width, y + h, x, y + h, radius);
        ctx.arcTo(x, y + h, x, y, radius);
        ctx.arcTo(x, y, x + width, y, radius);
        ctx.closePath();
    }

    function drawBlock(x, y, w, h, hue, sat) {
        if (w <= 0) return;
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, `hsl(${hue}, ${sat}%, 70%)`);
        g.addColorStop(1, `hsl(${hue}, ${sat}%, 46%)`);
        ctx.fillStyle = g;
        roundRect(x, y, w, h, 4);
        ctx.fill();

        ctx.strokeStyle = `hsl(${hue}, ${sat}%, 28%)`;
        ctx.lineWidth = 1.2;
        roundRect(x, y, w, h, 4);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(x + 4, y + 3, Math.max(0, w - 8), 3);
    }

    function spawnCurrent() {
        const prev = topBlock();
        const w = Math.max(MIN_W, prev.w);
        cur = makeBlock((W - w) / 2, w, stack.length);
    }

    function swingSpeed() {
        return 0.0024 + Math.min(score, 30) * 0.00007; // radians per ms
    }

    function updateSwing(dt) {
        phase += dt * swingSpeed();
        const amp = W / 2 - cur.w / 2 - 6;
        cur.x = W / 2 - cur.w / 2 + amp * Math.sin(phase);
    }

    function updateHud() {
        scoreEl.textContent = score;
        livesEl.textContent = '❤️'.repeat(lives) + '🤍'.repeat(MAX_LIVES - lives);
        bestEl.textContent = Math.max(best, score);
    }

    function loseLife() {
        lives = Math.max(0, lives - 1);
        shake = 10;
        updateHud();
    }

    function spawnParticles(x, y, hue, count) {
        for (let i = 0; i < count; i++) {
            particles.push({
                x: x + (Math.random() - 0.5) * 40,
                y,
                vx: (Math.random() - 0.5) * 0.12,
                vy: -0.05 - Math.random() * 0.1,
                life: 0,
                max: 500 + Math.random() * 400,
                hue: hue + (Math.random() * 30 - 15)
            });
        }
    }

    function spawnFloater(text, color, x, y) {
        floaters.push({ text, color, x, y, life: 0, max: 1000 });
    }

    function spawnDebris(x, w, y, hue, sat) {
        debris.push({ x, w, y, vy: 0.02, hue, sat });
    }

    // ---------- Game flow ----------
    function dropBlock() {
        if (mode !== 'swing' || !cur) return;

        const prev = topBlock();
        const overlap = Math.min(cur.x + cur.w, prev.x + prev.w) - Math.max(cur.x, prev.x);
        const perfect = Math.abs(cur.x - prev.x) < PERFECT_TOL;
        const missed = overlap <= 1;
        const sloppy = !missed && !perfect && overlap < cur.w * SLOPPY_RATIO;

        falling = {
            x: cur.x,
            w: cur.w,
            hue: cur.hue,
            sat: cur.sat,
            y: HOOK_Y - cam,            // world-space y (screen y = y + cam)
            vy: 0.05,
            target: GROUND_Y - (stack.length + 1) * BLOCK_H,
            missed,
            perfect,
            sloppy
        };
        cur = null;
        mode = 'drop';
    }

    function land() {
        const f = falling;
        const prev = topBlock();
        const left = Math.max(f.x, prev.x);
        const right = Math.min(f.x + f.w, prev.x + prev.w);

        const newX = f.perfect ? prev.x : left;
        const newW = f.perfect ? prev.w : right - left;

        // Cut-off overhang falls away as debris
        if (!f.perfect) {
            if (f.x < prev.x) {
                spawnDebris(f.x, prev.x - f.x, f.target, f.hue, f.sat);
            }
            const prevRight = prev.x + prev.w;
            const blockRight = f.x + f.w;
            if (blockRight > prevRight) {
                spawnDebris(prevRight, blockRight - prevRight, f.target, f.hue, f.sat);
            }
        }

        stack.push({ x: newX, w: newW, hue: f.hue, sat: f.sat });
        falling = null;

        const topY = GROUND_Y - stack.length * BLOCK_H + cam;
        const cx = newX + newW / 2;

        if (f.perfect) {
            combo++;
            score += 2;
            spawnParticles(cx, topY, 48, 22);
            spawnFloater(combo > 1 ? `Perfect x${combo}! +2` : 'Perfect! +2', '#ffd93d', cx, topY - 16);
        } else {
            combo = 0;
            score += 1;
            spawnParticles(cx, topY, f.hue, 10);
            spawnFloater(f.sloppy ? 'Sloppy! -1 ❤️' : 'Nice! +1', f.sloppy ? '#ff6b6b' : '#ffffff', cx, topY - 16);
        }

        if (f.sloppy) {
            loseLife();
        }

        camTarget = Math.max(0, CAM_LINE - (GROUND_Y - stack.length * BLOCK_H));
        updateHud();
        afterTurn();
    }

    function handleMiss() {
        const f = falling;
        falling = null;
        spawnFloater('Miss! -1 ❤️', '#ff6b6b', f.x + f.w / 2, HOOK_Y + 20);
        loseLife();
        afterTurn();
    }

    function afterTurn() {
        if (lives <= 0) {
            cur = null;
            mode = 'ending';
            endTimer = 0;
            return;
        }
        spawnCurrent();
        mode = 'swing';
    }

    function showGameOver() {
        mode = 'over';
        const isNewBest = score > best && score > 0;
        if (isNewBest) {
            best = score;
            saveBest(best);
        }
        finalScoreEl.textContent = score;
        newBestEl.hidden = !isNewBest;
        updateHud();
        gameOverScreen.classList.remove('hidden');
    }

    function resetWorld() {
        stack = [makeBlock((W - BASE_W) / 2, BASE_W, 0)];
        stack[0].hue = 215;
        stack[0].sat = 16;
        falling = null;
        debris = [];
        particles = [];
        floaters = [];
        score = 0;
        lives = MAX_LIVES;
        combo = 0;
        cam = 0;
        camTarget = 0;
        shake = 0;
        endTimer = 0;
        spawnCurrent();
        updateHud();
    }

    function startGame() {
        resetWorld();
        mode = 'swing';
        startScreen.classList.add('hidden');
        gameOverScreen.classList.add('hidden');
    }

    // ---------- Update ----------
    function updateDrop(dt) {
        falling.vy += GRAVITY * dt;
        falling.y += falling.vy * dt;

        if (!falling.missed && falling.y >= falling.target) {
            falling.y = falling.target;
            land();
        } else if (falling.missed && falling.y + cam > H + 40) {
            handleMiss();
        }
    }

    function updateEffects(dt) {
        for (const p of particles) {
            p.life += dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 0.0004 * dt;
        }
        particles = particles.filter(p => p.life < p.max);

        for (const d of debris) {
            d.vy += GRAVITY * dt;
            d.y += d.vy * dt;
        }
        debris = debris.filter(d => d.y + cam < H + 60);

        for (const f of floaters) {
            f.life += dt;
            f.y -= dt * 0.04;
        }
        floaters = floaters.filter(f => f.life < f.max);
    }

    function update(dt) {
        time += dt;
        cam += (camTarget - cam) * Math.min(1, dt * 0.004);
        if (shake > 0) shake = Math.max(0, shake - dt * 0.03);

        if ((mode === 'idle' || mode === 'swing') && cur) {
            updateSwing(dt);
        } else if (mode === 'drop' && falling) {
            updateDrop(dt);
        } else if (mode === 'ending') {
            endTimer += dt;
            if (endTimer > 900) showGameOver();
        }

        updateEffects(dt);
    }

    // ---------- Draw ----------
    function drawSky() {
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#3fa7ec');
        g.addColorStop(0.6, '#bfe6ff');
        g.addColorStop(1, '#ffe7c2');
        ctx.fillStyle = g;
        ctx.fillRect(-20, -20, W + 40, H + 40);
    }

    function drawSun() {
        const g = ctx.createRadialGradient(W - 50, 70, 4, W - 50, 70, 60);
        g.addColorStop(0, 'rgba(255, 240, 170, 1)');
        g.addColorStop(1, 'rgba(255, 240, 170, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(W - 120, 0, 140, 140);
        ctx.fillStyle = '#fff3b0';
        ctx.beginPath();
        ctx.arc(W - 50, 70, 18, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawClouds() {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        for (const c of CLOUDS) {
            const x = ((c.o + time * c.sp) % (W + 160)) - 80;
            ctx.beginPath();
            ctx.arc(x, c.y, 18 * c.s, 0, Math.PI * 2);
            ctx.arc(x + 22 * c.s, c.y - 8 * c.s, 24 * c.s, 0, Math.PI * 2);
            ctx.arc(x + 48 * c.s, c.y, 18 * c.s, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawSkyline() {
        for (const b of SKYLINE) {
            ctx.fillStyle = 'rgba(40, 90, 140, 0.35)';
            ctx.fillRect(b.x, H - b.h, b.w, b.h);
            ctx.fillStyle = 'rgba(255, 240, 180, 0.5)';
            for (let wy = H - b.h + 8; wy < H - 10; wy += 12) {
                for (let wx = b.x + 6; wx < b.x + b.w - 8; wx += 9) {
                    ctx.fillRect(wx, wy, 3, 4);
                }
            }
        }
    }

    function drawGround() {
        const gy = GROUND_Y + cam;
        if (gy > H) return;
        ctx.fillStyle = '#8bd65e';
        ctx.fillRect(-20, gy, W + 40, 10);
        const g = ctx.createLinearGradient(0, gy + 10, 0, H + 20);
        g.addColorStop(0, '#b97a4b');
        g.addColorStop(1, '#6e4327');
        ctx.fillStyle = g;
        ctx.fillRect(-20, gy + 10, W + 40, H);
    }

    function drawTower() {
        for (let i = 0; i < stack.length; i++) {
            const b = stack[i];
            const y = GROUND_Y - (i + 1) * BLOCK_H + cam;
            drawBlock(b.x, y, b.w, BLOCK_H, b.hue, b.sat);
        }
    }

    function drawDebris() {
        for (const d of debris) {
            ctx.globalAlpha = 0.85;
            drawBlock(d.x, d.y + cam, d.w, BLOCK_H, d.hue, d.sat);
        }
        ctx.globalAlpha = 1;
    }

    function drawCurrent() {
        if (cur && (mode === 'idle' || mode === 'swing')) {
            drawBlock(cur.x, HOOK_Y, cur.w, BLOCK_H, cur.hue, cur.sat);
        }
        if (falling) {
            drawBlock(falling.x, falling.y + cam, falling.w, BLOCK_H, falling.hue, falling.sat);
        }
    }

    function drawGuide() {
        if (mode !== 'swing' || !cur) return;
        const cx = cur.x + cur.w / 2;
        const fromY = HOOK_Y + BLOCK_H;
        const toY = GROUND_Y - stack.length * BLOCK_H + cam;
        if (toY <= fromY) return;
        ctx.save();
        ctx.setLineDash([5, 6]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, fromY);
        ctx.lineTo(cx, toY);
        ctx.stroke();
        ctx.restore();
    }

    function drawCrane() {
        let cx = W / 2;
        let topY = null;
        if (falling) {
            cx = falling.x + falling.w / 2;
            topY = falling.y + cam;
        } else if (cur && (mode === 'idle' || mode === 'swing')) {
            cx = cur.x + cur.w / 2;
            topY = HOOK_Y;
        }

        // Masts and jib
        ctx.fillStyle = '#2d3e50';
        ctx.fillRect(4, 0, 8, 26);
        ctx.fillRect(W - 12, 0, 8, 26);
        ctx.fillStyle = '#ffb703';
        ctx.fillRect(0, 12, W, 10);
        ctx.strokeStyle = '#2d3e50';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 12, W, 10);

        if (topY !== null) {
            // Trolley, cable and hook
            ctx.fillStyle = '#2d3e50';
            ctx.fillRect(cx - 12, 22, 24, 10);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(cx, 32);
            ctx.lineTo(cx, topY);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(cx, topY - 3, 3.5, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    function drawParticles() {
        for (const p of particles) {
            ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
            ctx.fillStyle = `hsl(${p.hue}, 90%, 60%)`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawFloaters() {
        ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
        for (const f of floaters) {
            ctx.globalAlpha = Math.max(0, 1 - f.life / f.max);
            ctx.fillStyle = f.color;
            ctx.strokeText(f.text, f.x, f.y);
            ctx.fillText(f.text, f.x, f.y);
        }
        ctx.globalAlpha = 1;
    }

    function draw() {
        ctx.save();
        ctx.clearRect(-20, -20, W + 40, H + 40);
        if (shake > 0) {
            ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        }
        drawSky();
        drawSun();
        drawClouds();
        drawSkyline();
        drawGround();
        drawCrane();
        drawTower();
        drawDebris();
        drawCurrent();
        drawGuide();
        drawParticles();
        drawFloaters();
        ctx.restore();
    }

    // ---------- Sizing (keeps the drawing sharp on HiDPI screens) ----------
    function resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));
        ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    }

    // ---------- Loop ----------
    function frame(now) {
        const dt = Math.min(50, now - lastFrame);
        lastFrame = now;
        update(dt);
        draw();
        requestAnimationFrame(frame);
    }

    // ---------- Input ----------
    canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        dropBlock();
    });

    document.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        const isDropKey = e.code === 'Space' || e.code === 'ArrowDown';
        if (isDropKey && mode === 'swing' && !(e.target instanceof HTMLButtonElement)) {
            e.preventDefault();
            dropBlock();
        }
    });

    startButton.addEventListener('click', () => {
        startButton.blur();
        startGame();
    });

    restartButton.addEventListener('click', () => {
        restartButton.blur();
        startGame();
    });

    window.addEventListener('resize', resize);

    // ---------- Init ----------
    resetWorld();
    mode = 'idle';
    resize();
    updateHud();
    requestAnimationFrame((now) => {
        lastFrame = now;
        frame(now);
    });
})();
