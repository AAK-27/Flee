function drawScene(gl, canvas, scene, time) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const projectionMatrix = mat4.create();

    mat4.ortho(projectionMatrix, 0, canvas.width, canvas.height, 0, -1, 1);

    if (scene.useLayers) {
        // This is only for the level scene to ensure objects are rendered in the correct order
        const drawables = scene.objects.map(obj => obj.createDrawable(time));
        drawables.sort((a, b) => a.layer - b.layer);
        drawables.forEach(d => drawObject(gl, projectionMatrix, d));
    } else {
        // Otherwise they are rendered in the order they were added to the scene
        scene.objects.forEach(gameObject => {
            drawObject(gl, projectionMatrix, gameObject.createDrawable(time));
        });
    }
}

function setPositionAttribute(gl, buffers, programInfo) {
    const numComponents = 2;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        numComponents,
        type,
        normalize,
        stride,
        offset
    );

    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
}

function setColorAttribute(gl, buffers, programInfo) {
    const numComponents = 4;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexColor,
        numComponents,
        type,
        normalize,
        stride,
        offset
    );

    gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);
}

function setTextureAttribute(gl, buffers, programInfo) {
    const num = 2;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
    gl.vertexAttribPointer(
        programInfo.attribLocations.textureCoord,
        num,
        type,
        normalize,
        stride,
        offset,
    );
    
    gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);
}

function drawObject(gl, projectionMatrix, drawable) {
    const { programInfo, buffers, x, y, width, height } = drawable;

    setPositionAttribute(gl, buffers, programInfo);

    const modelViewMatrix = mat4.create();
    mat4.translate(modelViewMatrix, modelViewMatrix, [x, y, 0]);
    mat4.scale(modelViewMatrix, modelViewMatrix,[width, height, 1]);

    gl.uniformMatrix4fv(
        programInfo.uniformLocations.modelViewMatrix,
        false,
        modelViewMatrix
    );
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.projectionMatrix,
        false,
        projectionMatrix,
    );

    if (drawable.texture) {
        gl.uniform1i(programInfo.uniformLocations.uUseTexture, 1);
        setTextureAttribute(gl, buffers, programInfo);
        gl.uniform2f(programInfo.uniformLocations.uTexScale, drawable.uTexScale[0], drawable.uTexScale[1]);
        gl.uniform2f(programInfo.uniformLocations.uTexOffset, drawable.uTexOffset[0], drawable.uTexOffset[1]);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, drawable.texture);
        gl.uniform1i(programInfo.uniformLocations.uSampler, 0);
    } else {
        gl.uniform1i(programInfo.uniformLocations.uUseTexture, 0);
        gl.uniform4fv(programInfo.uniformLocations.uColor, drawable.color);
        gl.uniform1f(programInfo.uniformLocations.uRadius, drawable.radius);
        gl.uniform2f(programInfo.uniformLocations.uRectSize, width, height);
    }

    {
        const offset = 0;
        const vertexCount = 4;
        gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
    }
}

class Scene {
    constructor(gl, canvas, name) {
        this.gl = gl;
        this.canvas = canvas;
        this.objects = [];
        this.name = name;
    }
    add(gameObject) {
        this.objects.push(gameObject);
    }
    handleEvent(event) {
        
    }
}

class MenuScene extends Scene {
    constructor(gl, canvas, name, bg) {
        super(gl, canvas, name);
        this.bg = loadTexture(bg);
        this.add(this.bg);
    }
}

export { drawScene };