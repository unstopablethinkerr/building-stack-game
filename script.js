const tower = document.querySelector('.tower');
const currentFloor = document.querySelector('.current-floor');
const nextFloor = document.querySelector('.next-floor');
const startButton = document.querySelector('.start-button');
const instructions = document.querySelector('.instructions');
const scoreElement = document.querySelector('.score');

let score = 0;
let isGameStarted = false;
let floorSize = 100;
let swingAngle = 0;
let swingDirection = 1;

startButton.addEventListener('click', () => {
    if (!isGameStarted) {
        isGameStarted = true;
        startButton.style.display = 'none';
        instructions.textContent = 'Stack the floors perfectly!';
        swing();
    }
});

function swing() {
    setInterval(() => {
        swingAngle += 5 * swingDirection;
        if (swingAngle >= 30) {
            swingDirection = -1;
        } else if (swingAngle <= -30) {
            swingDirection = 1;
        }
        currentFloor.style.transform = `rotate(${swingAngle}deg)`;
    }, 10);
}

document.addEventListener('click', () => {
    if (!isGameStarted) return;

    currentFloor.style.left = '0';
    currentFloor.style.visibility = 'visible';

    nextFloor.style.left = '0';
    nextFloor.style.visibility = 'visible';
    nextFloor.style.height = `${floorSize}px`;

    if (floorSize < 15) {
        gameOver();
    }

    score++;
    scoreElement.textContent = `Score: ${score}`;
});

function gameOver() {
    instructions.textContent = 'Game Over! Click to restart.';
    score = 0;
    scoreElement.textContent = 'Score: 0';
    isGameStarted = false;
    startButton.style.display = 'block';

    currentFloor.style.visibility = 'hidden';
    nextFloor.style.visibility = 'hidden';
    nextFloor.style.height = '20px';
}

window.addEventListener('click', () => {
    if (isGameStarted) {
        gameOver();
    }
});
