 document.addEventListener('DOMContentLoaded', (event) => {
    const tower = document.querySelector('.tower');
    const incomingFloor = document.querySelector('.incoming-floor');
    const swingButton = document.querySelector('.swing-button');
    const mistakesText = document.getElementById('mistakes');
    const floorSizeText = document.getElementById('floor-size');
    const towerHeightText = document.getElementById('tower-height');

    let towerHeight = 0;
    let floorSize = 100; // Percentage
    let mistakes = 0;
    let swingOffset = 0; // Pixels, will oscillate
    const swingSpeed = 2; // Pixels per frame
    const swingRange = 50; // Pixels from center
    const placementTolerance = 10; // Pixels for perfect placement
    let isSwinging = true;

    function animateSwing() {
        if (!isSwinging) return;
        swingOffset += swingSpeed;
        
        // Oscillate
        if (Math.abs(swingOffset) >= swingRange) {
            swingSpeed *= -1;
        }
        
        incomingFloor.style.transform = `translateX(${swingOffset}px)`;
        requestAnimationFrame(animateSwing);
    }
    animateSwing();

    swingButton.addEventListener('click', () => {
        isSwinging = false; // Stop the swing animation for a moment
        
        const placementError = Math.abs(swingOffset);
        if (placementError > placementTolerance) {
            // Mistake
            mistakes++;
            mistakesText.textContent = mistakes;
            if (mistakes >= 3) {
                alert("Game Over! Final Tower Height: " + towerHeight + " floors");
                return;
            }
            
            // Reduce floor size
            floorSize -= 10;
            if (floorSize < 20) { // Ensure we can still see the floor
                alert("Floors too small! Game Over. Final Tower Height: " + towerHeight + " floors");
                return;
            }
            floorSizeText.textContent = floorSize + "%";
            incomingFloor.style.width = floorSize + "%";
            tower.style.width = floorSize + "%"; // Update tower width for next floors
        } else {
            // Perfect or acceptable placement
            towerHeight++;
            towerHeightText.textContent = towerHeight;
            // Add new floor to tower (visually, by moving incoming floor down)
            const newFloor = incomingFloor.cloneNode(true);
            newFloor.style.top = (towerHeight * 30) + 'px'; // 30 = height + margin
            newFloor.style.transform = 'translateX(0)'; // Reset
            document.querySelector('.game-container').appendChild(newFloor);
        }
        
        // Reset for next floor
        setTimeout(() => {
            incomingFloor.style.transform = 'translateX(0)';
            swingOffset = 0;
            isSwinging = true; // Restart swing animation
            animateSwing(); // Ensure it kicks off again
        }, 500); // Wait half a second before resetting
    });
});
