import { initBuffers } from "./init-buffers.js";
import { drawScene } from "./draw-scene.js";

class Player {
    constructor(gl, programInfo, buffers, x, y, size, spritePath, spriteInfo) {
        this.programInfo = programInfo;
        this.buffers = buffers;
        this.x = x;
        this.y = y;
        this.dirX = 0;
        this.dirY = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.nextDirX = 0;
        this.nextDirY = 0;
        this.size = size;
        this.texture = loadTexture(gl, spritePath);
        this.animations = {};
        this.spriteSize = spriteInfo.size;
        this.gridXOffset = 0;
        this.gridYOffset = 0;
        this.gridSize = this.size;
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
    }

    updateGridCoords() {
        this.gridX = Math.floor((this.x - this.gridXOffset) / this.gridSize);
        this.gridY = Math.floor((this.y - this.gridYOffset + 0.5 * this.gridSize) / this.gridSize);
    }

    getScreenCoordsFromGrid(gridX, gridY) {
        return [gridX * this.gridSize + this.gridXOffset, (gridY - 0.5) * this.gridSize + this.gridYOffset];
    }

    tryMove() {
        // If the next direction is the same direction then ignore the move
        if (this.nextDirX === -this.dirX && this.nextDirX !== 0) return null;
        if (this.nextDirY === -this.dirY && this.nextDirY !== 0) return null;

        if (this.nextDirX != 0) { // If the next direction is in the x-axis...
            let gridNextTargetX = this.gridX;
            const row = this.level[this.gridY];
            // Check for walls in the current row in that direction
            for (let x = this.gridX + this.nextDirX; x < row.length && x >= 0; x+=this.nextDirX) {
                if (row.charAt(x) === '#') {
                    // When a wall is found set the target position right before the wall
                    gridNextTargetX = x - this.nextDirX;
                    break;
                }
            }
            if (gridNextTargetX == this.gridX) {
                return null // If the target position is the current position do nothing
            } else {
                // Now gridNextTargetX and this.gridY are a valid target position,
                // but we need to wait for the player to reach the intersection before turning.
                // Since the turn is in the x-direction the player is moving in the y-direction
                // so we need to make sure the player is aligned with the grid in the y-direction
                const alignedY = this.getScreenCoordsFromGrid(this.gridX, this.gridY)[1];
                if (this.y != alignedY) {
                    this.targetX = this.x; // The x-coordinate is already aligned
                    this.targetY = alignedY;
                } else {
                    // Set the new target position and direction
                    [this.targetX, this.targetY] = this.getScreenCoordsFromGrid(gridNextTargetX, this.gridY);
                    this.dirX = this.nextDirX;
                    this.dirY = 0;
                    this.nextDirX = 0;
                    this.nextDirY = 0;
                    return [[this.gridX, this.gridY], [this.nextDirX, this.nextDirY]];
                }
            }
        } else if (this.nextDirY != 0) { // If the next direction is in the y-axis...
            let gridNextTargetY = this.gridY;
            // Check for walls in the current column in that direction
            for (let y = this.gridY + this.nextDirY; y < this.level.length && y >= 0; y+=this.nextDirY) {
                if (this.level[y].charAt(this.gridX) === '#') {
                    // When a wall is found set the target position right before the wall
                    gridNextTargetY = y - this.nextDirY;
                    break;
                }
            }
            if (gridNextTargetY == this.gridY) {
                return null // If the target position is the current position do nothing
            } else {
                // Now this.gridX and gridNextTargetY are a valid target position,
                // but we need to wait for the player to reach the intersection before turning.
                // Since the turn is in the y-direction the player is moving in the x-direction
                // so we need to make sure the player is aligned with the grid in the x-direction
                const alignedX = this.getScreenCoordsFromGrid(this.gridX, this.gridY)[0];
                if (this.x != alignedX) {
                    this.targetX = alignedX;
                    this.targetY = this.y; // The y-coordinate is already aligned
                } else {
                    // Set the new target position and direction
                    [this.targetX, this.targetY] = this.getScreenCoordsFromGrid(this.gridX, gridNextTargetY);
                    this.dirX = 0;
                    this.dirY = this.nextDirY;
                    this.nextDirX = 0;
                    this.nextDirY = 0;
                    return [[this.gridX, this.gridY], [this.nextDirX, this.nextDirY]];
                }
            }
        }
    }

    createDrawable(time) {
        // TODO: Update the position based on velocity
        this.x += this.dirX;
        this.y += this.dirY;
        // Check if the player passed the target position in this frame
        // The target position is set at the beginning of a motion to a
        // point where the player either turns or stops to avoid running 
        // through walls
        if (this.dirX > 0 && this.x > this.targetX ||
            this.dirX < 0 && this.x < this.targetX ||
            this.dirY > 0 && this.y > this.targetY ||
            this.dirY < 0 && this.y < this.targetY) {
            // If they passed the target position then snap them to the target position
            this.x = this.targetX;
            this.y = this.targetY;
            // TODO: Set their velocity to the next direction if they choose to turn
            // for now just resets directions to zero
            this.dirX = 0;
            this.dirY = 0;
        }
        // Update grid coordinates used to check for collisions
        this.updateGridCoords();
        this.tryMove();

        if (this.dirX !== 0) this.animation = "run-side";
        else if (this.dirY === -1) this.animation = "run-backward";
        else if (this.dirY === 1) this.animation = "run-forward";

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
            x: this.dirX == -1 ? this.x + this.size: this.x,
            y: this.y,
            width: this.dirX == -1 ? -this.size : this.size,
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
        createDrawable(time) {
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
        createDrawable(time) {
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
                createDrawable(time) {
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
                const rows = levelText.split('\n');
                levelScene.level = rows;
                // Load the textures for the level
                const wallTexture = loadTexture(gl, 'brick-wall.png');
                const floorTexture = loadTexture(gl, 'dirt-floor.png');
                // Calculate scaling for the level
                const tileSize = Math.min(canvas.width / (rows[0].length), canvas.height / rows.length);
                const xOffset = (canvas.width - tileSize * rows[0].length) / 2;
                const yOffset = (canvas.height - tileSize * rows.length) / 2;
                levelScene.gridXOffset = xOffset;
                levelScene.gridYOffset = yOffset + 8;
                levelScene.gridSize = tileSize;
                for (let y = 0; y < rows.length; y++) {
                    for (let x = 0; x < rows[y].length; x++) {
                        switch (rows[y].charAt(x)) {
                            case ('#'): { // Walls
                                levelScene.objects.push({
                                    gridX: x,
                                    gridY: y,
                                    solid: true,
                                    createDrawable(time) {
                                        return {
                                            programInfo: programInfo,
                                            buffers: buffers,
                                            x: x*tileSize + xOffset,
                                            y: y*tileSize + yOffset - tileSize / 32 * 16,
                                            width: tileSize,
                                            height: tileSize / 32 * 48,
                                            texture: wallTexture,
                                            uTexScale: [1, 1],
                                            uTexOffset: [0, 0],
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
                                    createDrawable(time) {
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
                                player.x = x * tileSize + xOffset;
                                player.y = y * tileSize + yOffset + 8 * tileSize / 32 - tileSize;
                                player.size = tileSize;
                                player.setGrid(xOffset, yOffset, tileSize)
                                levelScene.objects.push(player);
                                // Add the floor tile under the player
                                levelScene.objects.push({
                                    gridX: x,
                                    gridY: y,
                                    solid: false,
                                    createDrawable(time) {
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

        drawScene(gl, canvas, scene, now);

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