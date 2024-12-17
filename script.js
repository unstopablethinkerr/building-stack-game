 document.addEventListener('DOMContentLoaded', () => {
    const gameArea = document.querySelector('.game-area');
    const startButton = document.querySelector('#start-button');
    const restartButton = document.querySelector('#restart-button');
    const swingingFloor = document.querySelector('#swinging-floor');
    const baseFloor = document.querySelector('#base-floor');
    const livesDisplay = document.querySelector('.lives');
    const levelDisplay = document.querySelector('.level');
    const gameOverScreen = document.querySelector('#game-over-screen');
    const finalScoreDisplay = document.querySelector('#final-score');

    let lives = 3;
    let level = 1;
    let score = 0;
    let gameInterval;
    let floorSpeed = 20;
    let direction = 1;

    function startGame() {
        lives = 3;
        level = 1;
        score = 0;
        livesDisplay.textContent = '❤️'.repeat(lives);
        levelDisplay.textContent = `${level} LVL`;
        gameOverScreen.style.display = 'none';
        swingingFloor.style.width = '100px';
        baseFloor.style.width = '100px';

        gameInterval = setInterval(() => {
            moveFloor();
        }, floorSpeed);
    }

    function moveFloor() {
        const floorLeft = parseInt(swingingFloor.style.left) || 0;

        if (Math.abs(floorLeft) >= 75) {
            direction = -direction;
        }

        swingingFloor.style.left = `${floorLeft + direction}px`;
    }

    function placeFloor() {
        clearInterval(gameInterval);
        const baseFloorWidth = parseInt(baseFloor.style.width);
        const baseFloorLeft = parseInt(baseFloor.style.left) || 0;
        const swingingFloorWidth = parseInt(swingingFloor.style.width);
        const swingingFloorLeft = parseInt(swingingFloor.style.left) || 0;

        const overlap = Math.min(baseFloorWidth, swingingFloorWidth) - Math.abs(baseFloorLeft - swingingFloorLeft);

        if (overlap > 0) {
            swingingFloor.style.width = `${overlap}px`;
            swingingFloor.style.left = `${baseFloorLeft}px`;
            baseFloor.style.width = `${overlap}px`;
            baseFloor.style.left = `${baseFloorLeft}px`;
            score++;
            level++;
            levelDisplay.textContent = `${level} LVL`;

            if (overlap < 50) {
                lives--;
                livesDisplay.textContent = '❤️'.repeat(lives);
                if (lives <= 0) {
                    endGame();
                    return;
                }
            }

            swingingFloor.style.width = '100px';
            swingingFloor.style.left = '0';
            gameInterval = setInterval(() => {
                moveFloor();
            }, floorSpeed);
        } else {
            endGame();
        }
    }

    function endGame() {
        clearInterval(gameInterval);
        finalScoreDisplay.textContent = score;
        gameOverScreen.style.display = 'flex';
    }

    startButton.addEventListener('click', startGame);
    restartButton.addEventListener('click', startGame);
    gameArea.addEventListener('click', placeFloor);
});
