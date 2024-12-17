 document.addEventListener('DOMContentLoaded', () => {
    const gameArea = document.querySelector('.game-area');
    const startButton = document.querySelector('#start-button');
    const scoreDisplay = document.querySelector('#score');
    const highScoreDisplay = document.querySelector('#high-score');
    const messageDisplay = document.querySelector('#message');
    const gameOverScreen = document.querySelector('#game-over-screen');
    const finalScoreDisplay = document.querySelector('#final-score');
    const restartButton = document.querySelector('#restart-button');

    let floors = [];
    let currentFloor;
    let score = 0;
    let highScore = 0;
    let mistakes = 0;
    let gameInterval;
    let floorSpeed = 20;
    let direction = 1;

    function createFloor() {
        const floor = document.createElement('div');
        floor.classList.add('floor');
        floor.style.width = '100%';
        floor.style.height = '50px';
        floor.style.backgroundColor = '#007bff';
        floor.style.position = 'absolute';
        floor.style.bottom = '0';
        return floor;
    }

    function startGame() {
        score = 0;
        mistakes = 0;
        floors = [];
        gameArea.innerHTML = '';
        scoreDisplay.textContent = `Score: ${score}`;
        messageDisplay.textContent = '';
        gameOverScreen.style.display = 'none';

        currentFloor = createFloor();
        gameArea.appendChild(currentFloor);
        floors.push(currentFloor);

        gameInterval = setInterval(() => {
            moveFloor();
        }, floorSpeed);
    }

    function moveFloor() {
        const floorWidth = parseInt(currentFloor.style.width);
        const floorLeft = parseInt(currentFloor.style.left) || 0;

        if (Math.abs(floorLeft) >= (300 - floorWidth) / 2) {
            direction = -direction;
        }

        currentFloor.style.left = `${floorLeft + direction}px`;
    }

    function placeFloor() {
        clearInterval(gameInterval);
        const lastFloor = floors[floors.length - 1];
        const lastFloorWidth = parseInt(lastFloor.style.width);
        const lastFloorLeft = parseInt(lastFloor.style.left) || 0;
        const currentFloorWidth = parseInt(currentFloor.style.width);
        const currentFloorLeft = parseInt(currentFloor.style.left) || 0;

        const overlap = Math.min(lastFloorWidth, currentFloorWidth) - Math.abs(lastFloorLeft - currentFloorLeft);

        if (overlap > 0) {
            currentFloor.style.width = `${overlap}px`;
            currentFloor.style.left = `${lastFloorLeft}px`;
            floors.push(currentFloor);
            score++;
            scoreDisplay.textContent = `Score: ${score}`;

            if (overlap < 50) {
                mistakes++;
                if (mistakes >= 3) {
                    endGame();
                    return;
                }
            }

            currentFloor = createFloor();
            gameArea.appendChild(currentFloor);
            gameInterval = setInterval(() => {
                moveFloor();
            }, floorSpeed);
        } else {
            endGame();
        }
    }

    function endGame() {
        clearInterval(gameInterval);
        if (score > highScore) {
            highScore = score;
            highScoreDisplay.textContent = `High Score: ${highScore}`;
        }
        finalScoreDisplay.textContent = score;
        gameOverScreen.style.display = 'flex';
    }

    startButton.addEventListener('click', startGame);
    gameArea.addEventListener('click', placeFloor);
    restartButton.addEventListener('click', startGame);
});
