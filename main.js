import * as THREE from './three.module.js';
import { OrbitControls } from './OrbitControls.js';

// Create the scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Create a raycaster and a mouse vector
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Track the currently highlighted cube
let highlightedCube = null;

// Set up the renderer with shadows enabled and a dark grey background
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x2c2c2c); // Dark grey background
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows
document.body.appendChild(renderer.domElement);

// Load texture
const textureLoader = new THREE.TextureLoader();
const texture = textureLoader.load('cube_texture.jpg');
texture.magFilter = THREE.NearestFilter;
texture.minFilter = THREE.NearestFilter;

// Define cube size, grid size, and spacing
const cubeSize = 0.5;
const gridSize = 10;
const spacing = 0.05;

const boundaryMin = -(gridSize / 2) * (cubeSize + spacing);
const boundaryMax = (gridSize / 2 - 1) * (cubeSize + spacing);

// Track all cubes and their original positions
const cubes = [];
const originalPositions = new Map();
const cubePositions = new Map(); // Track stacking on z-axis

// Utility to get x, y key for cube positions
function positionKey(x, y) {
    return `${x}_${y}`;
}

// Create the cubes in a grid
for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
        for (let z = 0; z < gridSize; z++) {
            const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
            const material = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                opacity: 0.01,
                transparent: true,
            });
            if(z==0){
                material.opacity=.8;
            }

            const smallCube = new THREE.Mesh(geometry, material);
            smallCube.castShadow = true;
            smallCube.receiveShadow = true;

            smallCube.position.set(
                (x - gridSize / 2) * (cubeSize + spacing),
                (y - gridSize / 2) * (cubeSize + spacing),
                (z - gridSize / 2) * (cubeSize + spacing)
            );

            // Add textured property to track if the cube has been textured
            smallCube.textured = false;

            // Track original position for reset
            originalPositions.set(smallCube, smallCube.position.clone());

            // Add cube to the scene
            cubes.push(smallCube);
            scene.add(smallCube);

            // Initialize stack height tracking
            if (!cubePositions.has(positionKey(smallCube.position.x, smallCube.position.y))) {
                cubePositions.set(positionKey(smallCube.position.x, smallCube.position.y), 0);
            }
        }
    }
}

// Add directional light and set its shadow properties
const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
scene.add(directionalLight);

// Ambient light for soft general lighting
const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambientLight);

// Update light position to always stay at the top left relative to the camera
function updateLightPosition() {
    const lightOffset = new THREE.Vector3(-5, 5, 5);  // Top-left in 3D space
    directionalLight.position.copy(camera.position).add(lightOffset);
}

// Add camera controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2;
camera.position.z = 15;

// Handle left-click to drop cube to lowest z-axis from top of grid
function onCubeClick(event) {
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(cubes);

    if (intersects.length > 0) {
        const clicked = intersects[0].object;

        // Get x, y position of the clicked cube
        const clickedX = clicked.position.x;
        const clickedY = clicked.position.y;

        // Get the current stack height at this x, y position
        let currentZ = cubePositions.get(positionKey(clickedX, clickedY)) || 0;

        // Check if the current stack height is less than the grid height
        const maxStackHeight = gridSize; // Set grid height limit
        if (currentZ < maxStackHeight) {
            // Create a new cube (not modifying the clicked cube)
            const cube = new THREE.Mesh(clicked.geometry, clicked.material.clone()); // Clone the material

            // Set the new cube's position to match the clicked cube's position
            cube.position.set(clickedX, clickedY, clicked.position.z);

            // Add the new cube to the scene
            scene.add(cube);

            // Apply texture and opacity change to the new cube, not the clicked one
            cube.material.map = texture;
            cube.material.opacity = 1;
            cube.material.needsUpdate = true;

            // Reset the emissive color to black (default) so it's not red
            cube.material.emissive.setHex(0x000000);

            // Mark the new cube as textured
            cube.textured = true;

            // Add the newly placed cube to the cubes array
            cubes.push(cube);  // Ensure the new cube is tracked for raycasting

            // Calculate the new z position based on the current stack height
            const newZPosition = ((currentZ + 1) * (cubeSize + spacing)) - (gridSize / 2) * (cubeSize + spacing);

            // Constrain z position within grid boundaries
            const constrainedZPosition = Math.min(boundaryMax, Math.max(boundaryMin, newZPosition));

            // Animate the new cube dropping from the top to the lowest available z position
            gsap.fromTo(cube.position,
                { z: (gridSize / 2) * (cubeSize + spacing) }, // Start at the top of the grid
                {
                    z: constrainedZPosition, // Drop to the lowest available z position
                    duration: 1.5,
                    ease: "bounce.out",
                }
            );

            // Update stack height for this x, y position
            cubePositions.set(positionKey(clickedX, clickedY), currentZ + 1);
        } else {
            console.log("Stack is full, cannot place any more cubes here.");
        }
    }
}

// Handle mouse movement to highlight cubes
function onMouseMove(event) {
    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Update the raycaster based on the mouse position and camera
    raycaster.setFromCamera(mouse, camera);

    // Find intersections
    const intersects = raycaster.intersectObjects(cubes);

    // Reset the previous highlighted cubes in the column
    if (highlightedCubes && highlightedCubes.length > 0) {
        highlightedCubes.forEach((cube) => {
            cube.material.emissive.setHex(0x000000); // Reset emissive color
        });
        highlightedCubes = []; // Clear the array
    }

    if (intersects.length > 0) {
        const intersectedCube = intersects[0].object;

        // Get the intersected cube's X and Y coordinates
        const targetX = intersectedCube.position.x;
        const targetY = intersectedCube.position.y;

        // Highlight all cubes in the same X-Y column (different Z)
        cubes.forEach((cube) => {
            // Check if the cube has the same X and Y coordinates (use a small tolerance for floating point precision)
            if (Math.abs(cube.position.x - targetX) < 0.001 && Math.abs(cube.position.y - targetY) < 0.001) {
                cube.material.emissive.setHex(0xff0000); // Red highlight
                highlightedCubes.push(cube); // Store the highlighted cubes
            }
        });
    }
}

let highlightedCubes = [];
// Function to undo cube positions and reset texture/opacity
function undoAllCubes() {
    cubes.forEach(cube => {
        const originalPosition = originalPositions.get(cube);

        // Reset position with animation
        gsap.to(cube.position, {
            x: originalPosition.x,
            y: originalPosition.y,
            z: originalPosition.z,
            duration: 1,
            ease: "power2.out",
        });

        // Reset texture and opacity
        cube.material.map = null; // Remove texture
        cube.material.opacity = 0.1; // Reset to original opacity
        cube.material.needsUpdate = true;

        // Reset textured flag
        cube.textured = false;
    });

    // Reset stack heights
    cubePositions.forEach((_, key) => {
        cubePositions.set(key, 0);
    });
}

// Add mousemove event listener
window.addEventListener('mousemove', onMouseMove, false);
// Handle both left-click (drop) and right-click (undo) with one event listener
window.addEventListener('mousedown', (event) => {
    switch (event.button) {
        case 0: // Left-click
            onCubeClick(event);
            break;
        case 2: // Right-click
            //event.preventDefault();
            //undoAllCubes();
            break;
    }
}, false);

// Handle window resize
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    updateLightPosition();
    controls.update();
    renderer.render(scene, camera);
}

animate();


