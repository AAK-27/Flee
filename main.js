import { initBuffers } from "./init-buffers.js";
import { drawScene } from "./draw-scene.js";

const DEBUG = true;

const HITBOX_INSET = 2; // pixels inset from tile boundary for wall collision probes

class Player {
    // TODO: method to push nextDirection directly into dir if dir is empty
    constructor(gl, programInfo, buffers, x, y, size, spritePath, spriteInfo) {
        this.programInfo = programInfo;
        this.buffers = buffers;
        this.x = x;
        this.y = y;
        this.dirX = 0;
        this.dirY = 0;
        this.nextDirX = 0;
        this.nextDirY = 0;
        this.size = size;
        this.texture = loadTexture(gl, spritePath);
        this.animations = {};
        this.spriteSize = spriteInfo.size;
        this.flip = false;
        this.gridXOffset = 0;
        this.gridYOffset = 0;
        this.gridSize = this.size;
        this.velocity = this.size; // Default speed of 1 tile per second
        this.updateGridCoords();
        this.solid = false;
        this.level = "";
        for (let i = 0; i < spriteInfo.animations.length; i++) {
            this.animations[spriteInfo.animations[i].name] = {
                fps: spriteInfo.animations[i].fps,
                numFrames: spriteInfo.animations[i].numFrames,
                rowIndex: i,
            }
            if (i == 0) {
                this.animation = spriteInfo.animations[i].name;
            }
        }
    }

    setGrid(gridXOffset, gridYOffset, gridSize) {
        this.gridXOffset = gridXOffset;
        this.gridYOffset = gridYOffset;
        this.gridSize = gridSize;
        this.velocity = this.size*2; // Set speed to 2 tiles per second
    }

    // The player's logical probe point is (this.x + size/2, this.y + 0.75*size),
    // accounting for the 3/4 perspective visual offset on Y.
    updateGridCoords() {
        this.gridX = Math.floor((this.x + this.size / 2 - this.gridXOffset) / this.gridSize);
        this.gridY = Math.floor((this.y + 0.75 * this.size - this.gridYOffset) / this.gridSize);
    }

    getScreenCoordsFromGrid(gridX, gridY) {
        // Returns the top-left screen position of a tile
        return [gridX * this.gridSize + this.gridXOffset, gridY * this.gridSize + this.gridYOffset];
    }

    updateAnimation() {
        // Update the animation
        if (this.dirX !== 0) {
            this.animation = "run-side";
            this.flip = this.dirX === -1;
        }
        else if (this.dirY === -1) this.animation = "run-backward";
        else if (this.dirY === 1) this.animation = "run-forward";
    }

    tryMove(deltaTime) {
        this.dirUpdated = false; // Flag to only allow one direction change per frame
        // If direction is 0, 0 then update it to next direction
        if (this.dirX === 0 && this.dirY === 0 && (this.nextDirX !== 0 || this.nextDirY !== 0)) {
            this.dirX = this.nextDirX;
            this.dirY = this.nextDirY;
            // Reset the next direction
            this.nextDirX = 0;
            this.nextDirY = 0;
            this.updateAnimation();
            this.dirUpdated = true;
        }

        if (this.level && (this.dirX != 0 || this.dirY != 0)) {
            const inset = HITBOX_INSET;
            // Update position as a function of time
            const nextPosX = this.x + this.dirX * this.velocity * deltaTime;
            const nextPosY = this.y + this.dirY * this.velocity * deltaTime;

            // Leading edge probe: the point just inside the tile boundary in the direction of travel.
            // For X: probe the leading horizontal edge inset from the sprite edge.
            // For Y: probe using the 0.75*size feet offset, inset from the boundary.
            const probeX = this.dirX === 1  ? nextPosX + this.size - inset
                         : this.dirX === -1 ? nextPosX + inset
                         : nextPosX + this.size / 2;
            // Moving up: probe the feet point (y + 0.75*size) inset from above.
            // Moving down: probe the bottom edge of the sprite plus the visual offset,
            // inset from the boundary. The sprite sits 0.75*size above the grid so
            // its bottom edge maps to nextPosY + size + 0.75*size in grid space.
            const probeY = this.dirY === 1
                         ? nextPosY + this.size + 0.75 * this.size - inset
                         : nextPosY + 0.75 * this.size - inset;
            const nextGridX = Math.floor((probeX - this.gridXOffset) / this.gridSize);
            const nextGridY = Math.floor((probeY - this.gridYOffset) / this.gridSize);

            const attemptMoveForward = () => {
                if (this.level[nextGridY] && this.level[nextGridY].charAt(nextGridX) === '#') {
                    // If the player runs into a wall
                    // Snap to the tile boundary before the wall
                    if (this.dirX === 1) {
                        this.x = nextGridX * this.gridSize + this.gridXOffset - this.size + inset;
                        this.animation = "idle-side";
                    } else if (this.dirX === -1) {
                        this.x = (nextGridX + 1) * this.gridSize + this.gridXOffset - inset;
                        this.flip = true;
                        this.animation = "idle-side";
                    } else if (this.dirY === 1) {
                        this.y = nextGridY * this.gridSize + this.gridYOffset - this.size - 0.75 * this.size + inset;
                        this.animation = "idle-forward";
                    } else if (this.dirY === -1) {
                        this.y = nextGridY * this.gridSize + this.gridYOffset + this.gridSize - 0.75 * this.size + inset;
                        this.animation = "idle-backward";
                    }
                    // Stop the player
                    this.dirX = 0;
                    this.dirY = 0;
                } else {
                    this.x = nextPosX;
                    this.y = nextPosY;
                }
            };

            // Prevent 180 degree turns
            if (this.dirX != 0 && this.nextDirX === -this.dirX ||
                this.dirY != 0 && this.nextDirY === -this.dirY) {
                this.nextDirX = 0;
                this.nextDirY = 0;
            }

            // Try to turn or else just move forward
            if ((this.nextDirX != 0 || this.nextDirY != 0) && !this.dirUpdated) {
                // Alignment check: the player can turn on the current tile if it passes
                // through the tile center this frame. The tile center in screen coords is
                // the tile top-left + half a tile.
                const tileCenterX = this.gridX * this.gridSize + this.gridXOffset + this.gridSize / 2;
                // For Y the player's reference point is the feet (y + 0.75*size),
                // so the tile center for alignment is the tile top + half a tile.
                const tileCenterY = this.gridY * this.gridSize + this.gridYOffset + this.gridSize / 2;

                // Current and next feet/center positions for range checks
                const curFeetY = this.y + 0.75 * this.size;
                const nextFeetY = nextPosY + 0.75 * this.size;
                const curCenterX = this.x + this.size / 2;
                const nextCenterX = nextPosX + this.size / 2;

                if (this.nextDirY != 0 &&
                    (this.dirX > 0 && inRange(tileCenterX, curCenterX, nextCenterX) ||
                     this.dirX < 0 && inRange(tileCenterX, nextCenterX, curCenterX))) {
                    // Turning vertically: check the tile above/below in the current column
                    if (this.level[this.gridY + this.nextDirY] &&
                        this.level[this.gridY + this.nextDirY].charAt(this.gridX) === '#') {
                        attemptMoveForward();
                    } else {
                        this.dirX = this.nextDirX;
                        this.dirY = this.nextDirY;
                        this.nextDirX = 0;
                        this.nextDirY = 0;
                        this.updateAnimation();
                        // Snap center X to tile center
                        this.x = tileCenterX - this.size / 2;
                    }
                } else if (this.nextDirX != 0 &&
                    (this.dirY > 0 && inRange(tileCenterY, curFeetY, nextFeetY) ||
                     this.dirY < 0 && inRange(tileCenterY, nextFeetY, curFeetY))) {
                    // Turning horizontally: check the tile left/right in the current row
                    if (this.level[this.gridY] &&
                        this.level[this.gridY].charAt(this.gridX + this.nextDirX) === '#') {
                        attemptMoveForward();
                    } else {
                        this.dirX = this.nextDirX;
                        this.dirY = this.nextDirY;
                        this.nextDirX = 0;
                        this.nextDirY = 0;
                        this.updateAnimation();
                        // Snap feet Y to tile center
                        this.y = tileCenterY - 0.75 * this.size;
                    }
                } else {
                    attemptMoveForward();
                }
            } else {
                attemptMoveForward();
            }
        }

        // Update grid coordinates used to check for collisions
        this.updateGridCoords();
    }

    createDrawable(deltaTime, time) {
        
        this.tryMove(deltaTime);

        const animation = this.animations[this.animation];
        const frameIndex = Math.floor(time * animation.fps) % animation.numFrames;
        const texScale = [
            this.spriteSize / this.texture.width,
            this.spriteSize / this.texture.height,
        ];
        const texOffset = [
            frameIndex * texScale[0],
            animation.rowIndex * texScale[1],
        ];

        // Creeate the drawable object with the updated coordinates
        return {
            programInfo: this.programInfo,
            buffers: this.buffers,
            x: this.flip ? this.x + this.size: this.x,
            y: this.y,
            width: this.flip ? -this.size : this.size,
            height: this.size,
            texture: this.texture,
            uTexScale: texScale,
            uTexOffset:  texOffset,
            layer: 2, // The player renders one layer above walls to appear in front
        };
    }
}

const events = [];

window.addEventListener('keydown', (event) => {
    events.push({
        type: "keyDown",
        key: event.key,
    });
});

window.addEventListener('mousedown', (event) => {
    events.push({
        type: "mouseDown",
        x: event.x,
        y: event.y,
    });
});

main();

function main() {
    const canvas = document.getElementById('gl-canvas');
    const gl = canvas.getContext('webgl');

    if (gl == null) {
        alert("WebGL is not supported by your browser!");
        return;
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    // gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // Just flip texture coords instead; using this causes the uv coords to be flipped as well which breaks spritesheets

    const vsSource = `
        attribute vec4 aVertexPosition;

        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;

        // Decides if using colors or textures
        uniform bool uUseTexture; // Flag: true = use texture, false = use color

        attribute vec2 aTextureCoord;
        varying highp vec2 vTextureCoord;

        varying vec2 vLocalPos; // Needed for corner radius (only with colors)

        void main() {
            gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;

            if (uUseTexture) {
                vTextureCoord = aTextureCoord;
            } else {
                vLocalPos = aVertexPosition.xy;
            }            
        }
    `;

    const fsSource = `
        precision mediump float;

        // Decides if using colors or textures
        uniform bool uUseTexture; // Flag: true = use texture, false = use color

        // For colors
        uniform vec4 uColor;

        // For rounding corners (only with colors for now)
        varying vec2 vLocalPos;
        uniform float uRadius; // Corner radius in pixels
        uniform vec2 uRectSize;

        float roundedBoxSDF(vec2 centerPosition, vec2 size, float radius) {
            vec2 q = abs(centerPosition) - size + radius;
            return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
        }

        // For textures
        varying highp vec2 vTextureCoord;
        uniform sampler2D uSampler;
        uniform highp vec2 uTexOffset;
        uniform highp vec2 uTexScale;

        void main(void) {
            if (uUseTexture) {
                gl_FragColor = texture2D(uSampler, vTextureCoord * uTexScale + uTexOffset);
            } else {
                vec2 halfSize = uRectSize * 0.5;
                vec2 pixelPos = (vLocalPos - 0.5) * uRectSize;

                float distance = roundedBoxSDF(pixelPos, halfSize, uRadius);
                float alpha = smoothstep(1.0, 0.0, distance);

                if (alpha < 0.01) discard;

                gl_FragColor = vec4(uColor.rgb, uColor.a * alpha);
            }
        }
    `;

    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    gl.useProgram(shaderProgram);

    const programInfo = {
        program: shaderProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
            textureCoord: gl.getAttribLocation(shaderProgram, "aTextureCoord"),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
            modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
            uUseTexture: gl.getUniformLocation(shaderProgram, 'uUseTexture'),
            uSampler: gl.getUniformLocation(shaderProgram, 'uSampler'),
            uTexOffset: gl.getUniformLocation(shaderProgram, 'uTexOffset'),
            uTexScale: gl.getUniformLocation(shaderProgram, 'uTexScale'),
            uColor: gl.getUniformLocation(shaderProgram, 'uColor'),
            uRadius: gl.getUniformLocation(shaderProgram, 'uRadius'),
            uRectSize: gl.getUniformLocation(shaderProgram, 'uRectSize'),
        }
    };

    const buffers = initBuffers(gl);

    const player = new Player(
        gl, programInfo, buffers,
        0, 0, 32,
        "./runner-spritesheet.png", {
            size: 32,
            animations: [
                {
                    name: "idle-forward",
                    fps: 1,
                    numFrames: 2,
                },
                {
                    name: "idle-backward",
                    fps: 1,
                    numFrames: 2,
                },
                {
                    name: "idle-side",
                    fps: 1,
                    numFrames: 2,
                },
                {
                    name: "run-forward",
                    fps: 12,
                    numFrames: 6,
                },
                {
                    name: "run-backward",
                    fps: 12,
                    numFrames: 6,
                },
                {
                    name: "run-side",
                    fps: 8,
                    numFrames: 4,
                }
            ]
        }
    );

    // =========================
    //       Title Scene
    // =========================
    const titleScene = {
        handleEvent: function handleEvent(event) {
            if (event.type == "mouseDown" && scene === titleScene) {
                return levelSelectScene;
            } else {
                return titleScene;
            }
        },
        objects: []
    };
    // Add the title art
    const titleArt = loadTexture(gl, "./title-art.png");
    titleScene.objects.push({
        createDrawable() {
            const scale = Math.min(canvas.width / titleArt.width, canvas.height / titleArt.height);
            const xOffset = (canvas.width - (titleArt.width * scale)) / 2;
            const yOffset = (canvas.height - (titleArt.height * scale)) / 2; 
            return {
                programInfo: programInfo,
                buffers: buffers,
                x: xOffset,
                y: yOffset,
                width: titleArt.width * scale,
                height: titleArt.height * scale,
                texture: titleArt,
                uTexScale: [1, 1],
                uTexOffset: [0, 0]
            }
        }
    });

    // =========================
    //  Level Selection Scene
    // =========================
    const levelSelectScene = {
        // These are for positioning the level selection buttons
        padding: Math.min(canvas.width / 5, canvas.height / 3) * 0.1,
        buttonSize: Math.min(canvas.width / 5, canvas.height / 3) - Math.min(canvas.width / 5, canvas.height / 3) * 0.1 * 2,
        xOff: (canvas.width - Math.min(canvas.width / 5, canvas.height / 3) * 5) / 2,
        yOff: (canvas.height - Math.min(canvas.width / 5, canvas.height / 3) * 3) / 2,

        handleEvent: function handleEvent(event) {
            // Return the next scene which is usually just this scene
            if (event.type == "mouseDown") {
                // If the user clicked on the screen check if it landed on a level selection button
                for (let i = 0; i < 15; i++){
                    // Get the pixel coordinates of each button
                    const x = levelSelectScene.xOff + levelSelectScene.padding + (levelSelectScene.padding * 2 + levelSelectScene.buttonSize) * (i % 5);
                    const y = levelSelectScene.yOff + levelSelectScene.padding + (levelSelectScene.padding * 2 + levelSelectScene.buttonSize) * Math.floor(i / 5);
                    // Check if the mouse click landed inside the button
                    if (event.x >= x && event.x <= x + levelSelectScene.buttonSize &&
                        event.y >= y && event.y <= y + levelSelectScene.buttonSize) {
                        levelScene.loadLevel(i+1); // Load the corresponding level number
                        return levelScene;         // Switch to the level scene
                    }
                }
            }
            return levelSelectScene;
        },

        objects: [] // Array to hold all objects in the scene
    };
    // Add the level selection background art
    const levelSelectionArt = loadTexture(gl, "./title-art.png");
    levelSelectScene.objects.push({
        createDrawable() {
            const scale = Math.min(canvas.width / levelSelectionArt.width, canvas.height / levelSelectionArt.height);
            const xOffset = (canvas.width - (levelSelectionArt.width * scale)) / 2;
            const yOffset = (canvas.height - (levelSelectionArt.height * scale)) / 2;
            return {
                programInfo: programInfo,
                buffers: buffers,
                x: xOffset,
                y: yOffset,
                width: levelSelectionArt.width * scale,
                height: levelSelectionArt.height * scale,
                texture: levelSelectionArt,
                uTexScale: [1, 1],
                uTexOffset: [0, 0]
            }
        }
    });
    { // Add the level buttons to the scene in a 3x5 grid
        for (let i = 0; i < 15; i++){
            levelSelectScene.objects.push({
                createDrawable() {
                    return {
                        programInfo: programInfo,
                        buffers: buffers,
                        x: levelSelectScene.xOff + levelSelectScene.padding + (levelSelectScene.padding * 2 + levelSelectScene.buttonSize) * (i % 5),
                        y: levelSelectScene.yOff + levelSelectScene.padding + (levelSelectScene.padding * 2 + levelSelectScene.buttonSize) * Math.floor(i / 5),
                        width: levelSelectScene.buttonSize,
                        height: levelSelectScene.buttonSize,
                        color: [0.5, 0.5, 0.5, 0.85],
                        radius: 10,
                        rectSize: [levelSelectScene.buttonSize, levelSelectScene.buttonSize]
                    }
                }
            });
        }
    }

    // =========================
    //       Level Scene
    // =========================
    const levelScene = {
        useLayers: true, // Tells drawScene to sort the objects in the scene by layer before rendering to ensure eveything renders in the correct order
        handleEvent: function handleEvent(event) {
            if (event.type == "keyDown") {
                switch (event.key) {
                    case 'ArrowRight':
                        player.nextDirX = 1;
                        player.nextDirY = 0;
                        break;
                    case 'ArrowLeft':
                        player.nextDirX = -1;
                        player.nextDirY = 0;
                        break;
                    case 'ArrowUp':
                        player.nextDirX = 0;
                        player.nextDirY = -1;
                        break;
                    case 'ArrowDown':
                        player.nextDirX = 0;
                        player.nextDirY = 1;
                        break;
                    case 'Escape':
                        return levelSelectScene;
                }
            }
            return levelScene;
        },
        loadLevel: function loadLevel(levelNum) {
            // First clear all the objects in the scene
            while (levelScene.objects.length > 0) {
                levelScene.objects.pop();
            }
            // Load the level file
            fetch(`./levels/level${levelNum}.txt`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.text();
            })
            .then(levelText => {
                console.log(levelText);
                let rows = levelText.split('\n');
                rows.forEach((row, y) => {
                    rows[y] = row.trimEnd();
                });
                levelScene.level = rows;
                // Load the textures for the level
                const wallTexture = loadTexture(gl, 'level-spritesheet.png');
                const floorTexture = loadTexture(gl, 'dirt-floor.png');
                // Calculate scaling for the level
                const tileSize = Math.min(canvas.width / (rows[0].length), canvas.height / rows.length);
                const xOffset = (canvas.width - tileSize * rows[0].length) / 2;
                const yOffset = (canvas.height - tileSize * rows.length) / 2 + tileSize/2;
                levelScene.gridXOffset = xOffset;
                levelScene.gridYOffset = yOffset;
                levelScene.gridSize = tileSize;
                for (let y = 0; y < rows.length; y++) {
                    for (let x = 0; x < rows[y].length; x++) {
                        switch (rows[y].charAt(x)) {
                            case ('#'): { // Walls
                                const [texCoords, flip] = matchWallSprite(getNeighborTiles(rows, x, y));
                                levelScene.objects.push({
                                    gridX: x,
                                    gridY: y,
                                    solid: true,
                                    createDrawable() {
                                        return {
                                            programInfo: programInfo,
                                            buffers: buffers,
                                            x: Math.ceil(x*tileSize + xOffset + (flip ? tileSize : 0)),
                                            y: Math.ceil(y*tileSize + yOffset - tileSize / 32 * 16),
                                            width: Math.ceil(flip? -tileSize : tileSize),
                                            height: Math.ceil(tileSize / 32 * 48),
                                            texture: wallTexture,
                                            uTexScale: [ 32 / wallTexture.width, 48 / wallTexture.height ],
                                            uTexOffset: [ 32 / wallTexture.width * texCoords[0], 48 / wallTexture.height * texCoords[1]],
                                            layer: 1, // Walls render on the layer above floors
                                        }
                                    }
                                });
                                break;
                            } case ('_'): { // Pathways
                                levelScene.objects.push({
                                    gridX: x,
                                    gridY: y,
                                    solid: false,
                                    createDrawable() {
                                        return {
                                            programInfo: programInfo,
                                            buffers: buffers,
                                            x: x*tileSize + xOffset,
                                            y: y*tileSize + yOffset,
                                            width: tileSize,
                                            height: tileSize,
                                            texture: floorTexture,
                                            uTexScale: [1, 1],
                                            uTexOffset: [0, 0],
                                            layer: 0, // Floors render on the first layer
                                        }
                                    }
                                });
                                break;
                            } case ('S'): { // Spawn point
                                // Add the player at the spawn point
                                player.x = Math.round(x * tileSize + xOffset + HITBOX_INSET);
                                player.y = Math.round(y * tileSize + yOffset - 0.75 * tileSize + HITBOX_INSET);
                                player.size = tileSize;
                                player.setGrid(xOffset, yOffset, tileSize)
                                levelScene.objects.push(player);
                                // Add a debug box to show player grid position
                                levelScene.objects.push({
                                    createDrawable() {
                                        const [x, y] = player.getScreenCoordsFromGrid(player.gridX, player.gridY)
                                        return {
                                            programInfo: programInfo,
                                            buffers: buffers,
                                            x: x,
                                            y: y,
                                            width: tileSize,
                                            height: tileSize,
                                            color: [ 0.5, 0.5, 0, 0.5 ],
                                            radius: 0,
                                            rectSize: [tileSize, tileSize],
                                            layer: 3,
                                        }
                                    }
                                })
                                // Add the floor tile under the player
                                levelScene.objects.push({
                                    gridX: x,
                                    gridY: y,
                                    solid: false,
                                    createDrawable() {
                                        return {
                                            programInfo: programInfo,
                                            buffers: buffers,
                                            x: x*tileSize + xOffset,
                                            y: y*tileSize + yOffset,
                                            width: tileSize,
                                            height: tileSize,
                                            texture: floorTexture,
                                            uTexScale: [1, 1],
                                            uTexOffset: [0, 0],
                                            layer: 0,
                                        }
                                    }
                                });
                                break;
                            } case ('E'): { // Exit point
                                // Add the floor tile under the exit
                                levelScene.objects.push({
                                    gridX: x,
                                    gridY: y,
                                    solid: false,
                                    createDrawable() {
                                        return {
                                            programInfo: programInfo,
                                            buffers: buffers,
                                            x: x*tileSize + xOffset,
                                            y: y*tileSize + yOffset,
                                            width: tileSize,
                                            height: tileSize,
                                            texture: floorTexture,
                                            uTexScale: [1, 1],
                                            uTexOffset: [0, 0],
                                            layer: 0,
                                        }
                                    }
                                });
                                break;
                            } case ('X'): { // Trap
                                // Add the floor tile under the trap
                                levelScene.objects.push({
                                    gridX: x,
                                    gridY: y,
                                    solid: false,
                                    createDrawable() {
                                        return {
                                            programInfo: programInfo,
                                            buffers: buffers,
                                            x: x*tileSize + xOffset,
                                            y: y*tileSize + yOffset,
                                            width: tileSize,
                                            height: tileSize,
                                            texture: floorTexture,
                                            uTexScale: [1, 1],
                                            uTexOffset: [0, 0],
                                            layer: 0,
                                        }
                                    }
                                });
                                break;
                            }
                        }
                    }
                }
                if (DEBUG) {
                    // Draw grid lines for debugging
                    // Horizontal lines
                    for (let row = 0; row <= rows.length; row++) {
                        levelScene.objects.push({
                            createDrawable() {
                                return {
                                    programInfo, buffers,
                                    x: xOffset,
                                    y: row * tileSize + yOffset,
                                    width: rows[0].length * tileSize,
                                    height: 1,
                                    color: [1, 0, 0, 1],
                                    radius: 0,
                                    rectSize: [rows[0].length * tileSize, 1],
                                    layer: 3,
                                };
                            }
                        });
                    }
                    // Vertical lines
                    for (let col = 0; col <= rows[0].length; col++) {
                        levelScene.objects.push({
                            createDrawable() {
                                return {
                                    programInfo, buffers,
                                    x: col * tileSize + xOffset,
                                    y: yOffset,
                                    width: 1,
                                    height: rows.length * tileSize,
                                    color: [1, 0, 0, 1],
                                    radius: 0,
                                    rectSize: [1, rows.length * tileSize],
                                    layer: 3,
                                };
                            }
                        });
                    }
                }
                
                player.level = levelScene.level;
            })
            .catch(error => {
                console.error('An error occured while loading the level:', error);
            });
        },
        objects: [],
        level: "",
        gridXOffset: 0,
        gridYOffset: 0,
        gridSize: 0,
    };


    let scene = titleScene;

    let then = 0;
    let deltaTime = 0;
    function render(now) {
        now *= 0.001; // convert to seconds
        deltaTime = now - then;
        then = now;

        while (events.length > 0) {
            const event = events.pop();
            scene = scene.handleEvent(event);
        }

        drawScene(gl, canvas, scene, deltaTime, now);

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    // Warn if the shader program failed
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert(`Unable to initialize the shader program: ${gl.getProgramInfoLog(shaderProgram)}`);
        return null;
    }
    return shaderProgram;
}

function loadShader(gl, type, source) {
    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(`An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`);
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Use a blue pixel as the texture until it loads
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([0, 0, 255, 255]);
    gl.texImage2D(
        gl.TEXTURE_2D,
        level,
        internalFormat,
        width,
        height,
        border,
        srcFormat,
        srcType,
        pixel,
    );

    const image = new Image();
    image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            level,
            internalFormat,
            srcFormat,
            srcType,
            image,
        );

        // WebGL1 has different requirements for power of 2 images
        // so check if image is power of 2
        if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
            // If power of 2, generate mips
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        } else {
            // Else turn off mips and set wrapping to clamp to edge
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        }

        // Store width and height with each texture for later use
        texture.width = image.width;
        texture.height = image.height;
    };
    image.src = url;

    return texture;
}

function isPowerOf2(value) {
    return (value & (value - 1)) === 0;
}

function getNeighborTiles(level, x, y) {
    // Return a string of 9 tiles representing the 3x3 area of tiles around the given coordinate
    let tiles = "";
    const centerTile = level[y].charAt(x);
    for (let locY = y - 1; locY <= y + 1; locY++) {
        let row = "";
        for (let locX = x - 1; locX <= x + 1; locX++) {
            if (locY < 0 || locY >= level.length || locX < 0 || locX >= level[0].length) {
                row = row.concat(centerTile);
            } else {
                const tile = level[locY].charAt(locX);
                if (tile == 'S' || tile == 'E' || tile == 'X') {
                    row = row.concat('_');
                } else {
                    row = row.concat(tile);
                }
            }
        }
        tiles = tiles.concat(row);
    }
    return tiles;
}

function matchWallSprite(neighborTiles) {
    // Take the string of 9 tiles in a 3x3 around the target tile and return the
    // corresponding texture coordinates for that wall, and a boolean if it needs
    // to be flipped
    switch (neighborTiles) {
        // #### BASIC OUTER WALLS ####
        // Top left outer wall
        case (`########_`):
            return [[0, 0], false];
        // Top outer wall
        case (`######___`):
        case (`#######__`):
        case (`######__#`):
        case (`#######_#`):
            return [[1, 0], false];
        // Top right outer wall
        case (`######_##`):
            return [[2, 0], false];
        // Outer right wall
        case (`###_##_##`):
        case (`_##_##_##`):
        case (`_##_#####`):
        case (`###_#####`):
            return [[2, 1], false];
        // Outer bottom right corner
        case (`_########`):
            return [[2, 2], false];
        // Outer bottom edge
        case (`___######`):
        case (`#_#######`):
        case (`#__######`):
        case (`__#######`):
            return [[1, 2], false];
        // Outer bottom left corner
        case (`##_######`):
            return [[0, 2], false];
        // Outer left wall
        case (`##_##_##_`):
        case (`#####_##_`):
        case (`##_##_###`):
        case (`#####_###`):
            return [[0, 1], false];

        // #### STANDALONE COLUMN ####
        // Standalone column
        case (`____#____`):
            return [[1, 1], false];
        
        // #### VERTICAL WALLS ####
        // Upper wall cap
        case (`____#__#_`):
        case (`____#__##`):
        case (`____#_##_`):
        case (`____#_###`):
            return [[3, 0], false];
        // Vertical wall
        case (`_#__#__#_`):
        case (`##__#__##`):
        case (`##__#__#_`):
        case (`###_#__#_`):
        case (`_#__#_###`):
            return [[3, 1], false];
        // Lower wall cap
        case (`_#__#____`):
        case (`##__#____`):
        case (`_##_#____`):
        case (`###_#____`):
            return [[3, 2], false];
        
        // #### HORIZONTAL WALLS ####
        // Left wall cap
        case (`____##___`):
            return [[0, 3], false];
        // Horizontal wall
        case (`___###___`):
        case (`#__####__`):
        case (`__####__#`):
        case (`#_####___`):
            return [[1, 3], false];
        // Right wall cap
        case (`___##____`):
            return [[2, 3], false];
        
        // #### INNER WALL JUNCTIONS ####
        // Inner top left turn
        case (`____##_#_`):
            return [[4, 0], false];
        // Inner top T junction
        case (`___###_#_`):
            return [[5, 0], false];
        // Inner top right turn
        case (`___##__#_`):
            return [[6, 0], false];
        // Inner left T junction
        case (`_#__##_#_`):
            return [[4, 1], false];
        // Inner plus junction
        case (`_#_###_#_`):
            return [[5, 1], false];
        // Inner right T junction
        case (`_#_##__#_`):
            return [[6, 1], false];
        // Inner bottom left turn
        case (`_#__##___`):
            return [[4, 2], false];
        // Inner bottom T junction
        case (`_#_###___`):
            return [[5, 2], false];
        // Inner bottom right turn
        case (`_#_##____`):
            return [[6, 2], false];
        
        // #### DENSE CORNERS ####
        // Top left corner
        case (`____##_##`):
            return [[3, 3], false];
        // Top right corner
        case (`___##_##_`):
            return [[7, 0], false];
        // Bottom left corner
        case (`_##_##___`):
            return [[7, 3], false];
        // Bottom right corner
        case (`##_##____`):
            return [[6, 3], false];

        // #### OUTER WALL JUNCTIONS ####
        // Outer left T junction
        case (`##_#####_`):
            return [[7, 1], false];
        // Outer top T junction
        case (`######_#_`):
            return [[5, 3], false];
        // Outer right T junction
        case (`_#####_##`):
            return [[7, 2], false];
        // Outer bottom T junction
        case (`_#_######`):
            return [[4, 3], false];
        
        // #### DEFAULT CASE ####
        default:
            // Standalone column
            return [[1, 1], false];
    }
}

function inRange(x, a, b) {
    return x >= a && x <= b;
}

// function cropImage(imgSrc, cropX, cropY, cropWidth, cropHeight) {
//     return new Promise((resolve) => {
//         const image = new Image();
//         image.src = imgSrc;

//         image.onload = () => {
//             const canvas = document.createElement('canvas');
//             canvas.width = cropWidth;
//             canvas.height = cropHeight;
//             const ctx = canvas.getContext('2d');

//             ctx.drawImage(
//                 image,
//                 cropX, cropY, cropWidth, cropHeight,
//                 0, 0, cropWidth, cropHeight
//             );

//             resolve(canvas.toDataURL('image/png'));
//         }
//     });
// }

// loadSpritesheet(spritePath, spriteInfo) {
//     const spriteSheet = new Image();
//     spriteSheet.src = spritePath;
//     spriteSheet.onload = () => {
//         const spriteSize, spriteKeys = spriteInfo;
//         this.animations = {};
//         for (let i = 0; i < spriteKeys.length; i++) {
//             const key, fps, numFrames = spriteKeys;
//             this.animations[key] = {
//                 fps: fps,
//                 numFrames: numFrames,
//                 frames: [],
//             }
//             for (let j = 0; j < numFrames; j++) {
//                 const dataURL = cropImage(spriteSheet, j * spriteSize, i * spriteSize, spriteSize, spriteSize);
//                 this.animations[key].frames.push(dataURL);
//             }
//         }
        
//         return this.animations;
//     }
// }