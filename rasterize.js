/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog3/triangles2.json"; // triangles file loc
const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog3/ellipsoids.json";
//const INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog3/spheres.json"; // spheres file loc
var Eye = new vec4.fromValues(0.5,0.5,-0.5,1.0); // default eye position in world space

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var vertexBuffer; // this contains vertex coordinates in triples
var triangleBuffer; // this contains indices into vertexBuffer in triples
var triBufferSize = 0; // the number of indices in the triangle buffer

var normalBuffer; // this contains triangle normals

var diffuseColorBuffer; // this contains diffuse color values in triples
var ambientColorBuffer; // this contains ambient color values in triples
var specularColorBuffer; // this contains specular color values in triples
var nBuffer; // this contains specular exponent values

var eye; // vector representing eye location
var up; // vector representing up direction
var lookat; // vector representing eye look direction

var lightPos; // vector representing light position

var vertexPositionAttrib; // where to put position for vertex 

var normalAttrib; // where to put normal vector for vertex shader

var diffuseColorAttrib; // where to put diffuse color for vertex shader
var ambientColorAttrib; // where to put ambient color for vertex shader
var specularColorAttrib; // where to put specular color for vertex shader
var nAttrib; // where to put specular exponent for vertex shader

var eyeUniform; // where to put eye vector for vertex shader
var upUniform; // where to put up vector for vertex shader
var lookatUniform; // where to put lookat flag for vertex shader

var lightPosUniform; // where to put lightPos vector for vertex shader

var windowDistUniform; // where to put windowDist value for vertex shader
var leftUniform; // where to put left value for vertex shader
var rightUniform; // where to put right value for vertex shader
var bottomUniform; // where to put bottom value for vertex shader
var topUniform; // where to put top value for vertex shader
var nearUniform; // where to put near value for vertex shader
var farUniform; // where to put far value for vertex shader

// The triangles from the file.
var inputTriangles;
// Vertices after transformation by per-triangle-set matrices.
var transformedVertices = [];
// per-triangle-set matrices.
var transformMatrices = [];
// selected triangle set
var selectedTriangleSet = -1;
var selectionOn = false;

// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get input spheres

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    gl = canvas.getContext("webgl"); // get a webgl object from it
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

// read triangles in, load them into webgl buffers
function handleTriangles() {
    if (inputTriangles != String.null) { 
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        
        var coordArray = []; // 1D array of vertex coords for WebGL
        var idxArray = []; // 1D array of indices for WebGL
        
        var normalArray = []; // 1D array of normal vector coords for WebGL
        
        var diffuseColorArray = []; // 1D array of diffuse color coords for WebGL
        var ambientColorArray = []; // 1D array of ambient color coords for WebGL
        var specularColorArray = []; // 1D array of specular color coords for WebGL
        var nArray = [];

        var idx = 0;
        inputTriangles.forEach((triangleSet,i) => {
            const transformedVertices = getTransformedVertices(triangleSet.vertices, i);
            triangleSet.triangles.forEach(triangle => {
                const vertices = triangle.map(vertex => transformedVertices[vertex]);

                // Compute normal for triangle
                const A = vec3.create();
                vec3.sub(A, vertices[1], vertices[0]);
                const B = vec3.create();
                vec3.sub(B, vertices[2], vertices[0]);
                let normal = vec3.create();
                vec3.cross(normal, A, B);
                vec3.normalize(normal, normal);
                
                vertices.forEach(vertex => {
                    // No more triangles sharing vertices, because they may have different normals,
                    // so I wouldn't know how to provide info for specular highlight.
                    // I don't need to duplicate triangles to make them double-sided; the shader already makes them double-sided.
                    coordArray.push(vertex);
                    idxArray.push(idx++);
                    
                    normalArray.push(normal);
                    
                    diffuseColorArray.push(triangleSet.material.diffuse);
                    ambientColorArray.push(triangleSet.material.ambient);
                    specularColorArray.push(triangleSet.material.specular);
                    nArray.push(triangleSet.material.n);
                });
            });
        });
        coordArray = coordArray.map(x=>Array.from(x)).flat();
        triBufferSize = idx;
        
        normalArray = normalArray.map(x=>Array.from(x)).flat();
        
        diffuseColorArray = diffuseColorArray.flat();
        ambientColorArray = ambientColorArray.flat();
        specularColorArray = specularColorArray.flat();
    
        // send the vertex coords to webGL
        vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(coordArray),gl.STATIC_DRAW); // coords to that buffer

        // send the triangle idxs to webGL
        triangleBuffer = gl.createBuffer(); // init empty triangle idx buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffer); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(idxArray),gl.STATIC_DRAW); // idxs to that buffer
        
        // send the normal vectors to webGL
        normalBuffer = gl.createBuffer(); // init empty vector buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(normalArray),gl.STATIC_DRAW); // vectors to that buffer

        // send the diffuse vertex colors to webGL
        diffuseColorBuffer = gl.createBuffer(); // init empty vertex color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,diffuseColorBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(diffuseColorArray),gl.STATIC_DRAW); // colors to that buffer
        
        // send the ambient vertex colors to webGL
        ambientColorBuffer = gl.createBuffer(); // init empty vertex color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,ambientColorBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(ambientColorArray),gl.STATIC_DRAW); // colors to that buffer
        
        // send the specular vertex colors to webGL
        specularColorBuffer = gl.createBuffer(); // init empty vertex color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,specularColorBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(specularColorArray),gl.STATIC_DRAW); // colors to that buffer

        // send the specular exponent to webGL
        nBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER,nBuffer);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(nArray),gl.STATIC_DRAW);
    } // end if triangles found
} // end load triangles

// setup the webGL shaders
function setupShaders() {
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        varying lowp vec3 vertexPos;
        
        varying lowp vec3 norm;
        
        varying lowp vec3 diffuseCol;    
        varying lowp vec3 ambientCol;
        varying lowp vec3 specularCol;
        varying lowp float nVal;
        
        uniform lowp vec3 eye;
        uniform lowp vec3 lightPos;
        
        void main(void) {
            lowp vec3 normVector = norm;
            
            lowp vec3 toLight = normalize(lightPos - vertexPos);
            lowp vec3 toEye = normalize(eye - vertexPos);
            
            if(dot(normVector, toEye) < 0.0)
                normVector *= -1.0;
                
            lowp vec3 color = ambientCol;

            lowp float diffCoeff = dot(normVector, toLight);
            if(diffCoeff > 0.0) {
                color += diffuseCol * diffCoeff;
            
                lowp float specCoeff = dot(normVector, normalize(toEye + toLight));
                if(specCoeff > 0.0) {
                    color += specularCol * pow(specCoeff,nVal);
                }
            }

            color = min(color, vec3(1,1,1));
            
            gl_FragColor = vec4(color, 1.0);
        }
    `;
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 vertexPosition;
        varying lowp vec3 vertexPos;
        
        attribute vec3 normal;
        varying highp vec3 norm; // direction

        attribute vec3 diffuseColor;
        varying highp vec3 diffuseCol;
        attribute vec3 ambientColor;
        varying highp vec3 ambientCol;
        attribute vec3 specularColor;
        varying highp vec3 specularCol;
        attribute float n;
        varying highp float nVal;
        
        uniform lowp vec3 eye; // location
        uniform highp vec3 up; // direction
        uniform highp vec3 lookat; // direction

        uniform vec3 lightPos; // location
        
        uniform float windowDist;
        uniform float left;
        uniform float right;
        uniform float bottom;
        uniform float top;
        uniform float near;
        uniform float far;

        void main(void) {
            // Perspective viewing transform.
            vec3 relativePosition = vertexPosition - eye;
            float distAlongLookat = dot(lookat, relativePosition) / dot(lookat, lookat);
            vec3 projectedPosition = relativePosition / distAlongLookat * windowDist;
            vec3 upOrthVec = up - dot(up, lookat) / dot(lookat, lookat);
            float distAlongUp = dot(upOrthVec, projectedPosition) / dot(upOrthVec, upOrthVec);
            vec3 rightVec = cross(lookat, up);
            float distAlongRight = dot(rightVec, projectedPosition) / dot(rightVec, rightVec);

            // Clipping transform.
            vec3 clippedPosition = vec3(
                (distAlongRight - left) / (right - left),
                (distAlongUp - bottom) / (top - bottom),
                (distAlongLookat - near) / (far - near)
            ) * 2.0 - 1.0;
            
            gl_Position = vec4(clippedPosition, 1.0); // use the altered position
            
            diffuseCol = diffuseColor;
            ambientCol = ambientColor;
            specularCol = specularColor;
            nVal = n;
            norm = normal;

            vertexPos = vertexPosition;
        }
    `;
    
    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                vertexPositionAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexPosition"); 
                gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array
                
                normalAttrib = // get pointer to normal vector shader input
                    gl.getAttribLocation(shaderProgram, "normal");
                gl.enableVertexAttribArray(normalAttrib); // input to shader from array
                
                diffuseColorAttrib = // get pointer to diffuse color shader input
                    gl.getAttribLocation(shaderProgram, "diffuseColor");
                gl.enableVertexAttribArray(diffuseColorAttrib); // input to shader from array
                ambientColorAttrib = // get pointer to ambient color shader input
                    gl.getAttribLocation(shaderProgram, "ambientColor");
                gl.enableVertexAttribArray(ambientColorAttrib); // input to shader from array
                specularColorAttrib = // get pointer to specular color shader input
                    gl.getAttribLocation(shaderProgram, "specularColor");
                gl.enableVertexAttribArray(specularColorAttrib); // input to shader from array
                nAttrib = // get pointer to specular exponent shader input
                    gl.getAttribLocation(shaderProgram, "n");
                gl.enableVertexAttribArray(nAttrib); // input to shader from array
                
                eyeUniform = // get pointer to eye vector
                    gl.getUniformLocation(shaderProgram, "eye");
                upUniform = // get pointer to up vector
                    gl.getUniformLocation(shaderProgram, "up");
                lookatUniform = // get pointer to lookat vector
                    gl.getUniformLocation(shaderProgram, "lookat");
                
                lightPosUniform = // get pointer to lightPos vector
                    gl.getUniformLocation(shaderProgram, "lightPos");

                windowDistUniform = // get pointer to windowDist value
                    gl.getUniformLocation(shaderProgram, "windowDist");
                leftUniform = // get pointer to left value
                    gl.getUniformLocation(shaderProgram, "left");
                rightUniform = // get pointer to right value
                    gl.getUniformLocation(shaderProgram, "right");
                bottomUniform = // get pointer to bottom value
                    gl.getUniformLocation(shaderProgram, "bottom");
                topUniform = // get pointer to top value
                    gl.getUniformLocation(shaderProgram, "top");
                nearUniform = // get pointer to near value
                    gl.getUniformLocation(shaderProgram, "near");
                farUniform = // get pointer to far value
                    gl.getUniformLocation(shaderProgram, "far");
            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
    altPosition = false;
    setTimeout(function alterPosition() {
        altPosition = !altPosition;
        setTimeout(alterPosition, 2000);
    }, 2000); // switch flag value every 2 seconds
    eye=[0.5,0.5,-0.5];
    up=[0,1,0];
    lookat=[0,0,1];
    lightPos=[-0.5,1.5,-0.5];
} // end setup shaders
var bgColor = 0;
// render the loaded model
function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    gl.clearColor(bgColor, 0, 0, 1.0);
    requestAnimationFrame(renderTriangles);
    // vertex buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); // feed
    // idx buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer);
    
    // normal buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffer); // activate
    gl.vertexAttribPointer(normalAttrib,3,gl.FLOAT,false,0,0); // feed
    
    // diffuse color buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,diffuseColorBuffer); // activate
    gl.vertexAttribPointer(diffuseColorAttrib,3,gl.FLOAT,false,0,0); // feed
    // ambient color buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,ambientColorBuffer); // activate
    gl.vertexAttribPointer(ambientColorAttrib,3,gl.FLOAT,false,0,0); // feed
    // specular color buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,specularColorBuffer); // activate
    gl.vertexAttribPointer(specularColorAttrib,3,gl.FLOAT,false,0,0); // feed
    // specular exponent buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,nBuffer); // activate
    gl.vertexAttribPointer(nAttrib,1,gl.FLOAT,false,0,0); // feed
    
    // eye vector
    gl.uniform3fv(eyeUniform, eye); // feed
    // up vector
    gl.uniform3fv(upUniform, up); // feed
    // lookat vector
    gl.uniform3fv(lookatUniform, lookat); // feed
    
    // lightPos vector
    gl.uniform3fv(lightPosUniform, lightPos); // feed
    
    // windowDist value
    gl.uniform1f(windowDistUniform, 0.5); // feed
    // left value
    gl.uniform1f(leftUniform, -0.5); // feed
    // right value
    gl.uniform1f(rightUniform, 0.5); // feed
    // bottom value
    gl.uniform1f(bottomUniform, -0.5); // feed
    // top value
    gl.uniform1f(topUniform, 0.5); // feed
    // near value
    gl.uniform1f(nearUniform, 0.5); // feed
    // far value
    gl.uniform1f(farUniform, 1.5); // feed

    gl.drawElements(gl.TRIANGLES,triBufferSize,gl.UNSIGNED_SHORT,0); // render
} // end render triangles


function getTransformedVertices(untransformedVertices, i) {
    console.log(transformMatrices);
    // If up-to-date vertices are already computed, don't recompute.
    if(transformedVertices[i])
        return transformedVertices[i];
    
    // Lengthen the array to hold this index.
    while(transformedVertices.length <= i)
        transformedVertices.push(undefined);
    while(transformMatrices.length <= i)
        transformMatrices.push(mat4.create());

    // Transform the vertices.
    transformedVertices[i] = untransformedVertices.map(untransformedVertex => {
        const transformedVertex = vec3.create();
        vec3.transformMat4(transformedVertex, untransformedVertex, transformMatrices[i]);
        return transformedVertex;
    });
    return transformedVertices[i];
}

function centroid(vertices) {
    const centroidPoint = vec3.create();
    if(vertices.length == 0)
        return centroidPoint;
    vertices.forEach(vertex => {
        vec3.add(centroidPoint, centroidPoint, vertex);
    });
    vec3.scale(centroidPoint, centroidPoint, 1/vertices.length);
    return centroidPoint;
}

function specialAction() {
    
}

/* MAIN -- HERE is where execution begins after window load */

function main() {
  
    setupWebGL(); // set up the webGL environment
    inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");
    handleTriangles(); // load in the triangles from tri file
    setupShaders(); // setup the webGL shaders
    renderTriangles(); // draw the triangles using webGL


    // spacebar listener
    var specialOn = false;
    document.addEventListener('keydown', (e) => {
        const tempVec = vec3.create();
        const tempMat = mat4.create();
        switch(e.key) {
            // Cycle selection left in the array of triangle sets
            case "ArrowLeft":
                if(selectionOn) {
                    // Unscale triangle set by 1.2
                    const center = centroid(transformedVertices[selectedTriangleSet]);
                    const transformMatrix = transformMatrices[selectedTriangleSet];
                    vec3.negate(tempVec, center);
                    mat4.fromTranslation(tempMat, tempVec);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    mat4.fromScaling(tempMat, vec3.fromValues(1/1.2, 1/1.2, 1/1.2));
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    mat4.fromTranslation(tempMat, center);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    // Invalidate old selected triangle set's transformedVertices, they must be recomputed.
                    transformedVertices[selectedTriangleSet] = undefined;
                }
                
                // Change selection.
                selectedTriangleSet--;
                if(selectedTriangleSet < 0)
                    selectedTriangleSet = transformedVertices.length - 1;
                
                if(selectedTriangleSet !== -1) {
                    selectionOn = true;
                    
                    // Lengthen the array to hold this index.
                    while(transformedVertices.length <= selectedTriangleSet)
                        transformedVertices.push(undefined);
                    while(transformMatrices.length <= selectedTriangleSet)
                        transformMatrices.push(mat4.create());

                    // Scale triangle set by 1.2
                    const center = centroid(transformedVertices[selectedTriangleSet]);
                    const transformMatrix = transformMatrices[selectedTriangleSet];
                    vec3.negate(tempVec, center);
                    mat4.fromTranslation(tempMat, tempVec);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    mat4.fromScaling(tempMat, vec3.fromValues(1.2,1.2,1.2));
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    mat4.fromTranslation(tempMat, center);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    // Invalidate new selected triangle set's transformedVertices, they must be recomputed.
                    transformedVertices[selectedTriangleSet] = undefined;
                    handleTriangles();
                }
                break;
            // Cycle selection right in the array of triangle sets
            case "ArrowRight":
                if(selectionOn) {
                    // Unscale triangle set by 1.2
                    const center = centroid(transformedVertices[selectedTriangleSet]);
                    const transformMatrix = transformMatrices[selectedTriangleSet];
                    vec3.negate(tempVec, center);
                    mat4.fromTranslation(tempMat, tempVec);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    mat4.fromScaling(tempMat, vec3.fromValues(1/1.2, 1/1.2, 1/1.2));
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    mat4.fromTranslation(tempMat, center);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    // Invalidate old selected triangle set's transformedVertices, they must be recomputed.
                    transformedVertices[selectedTriangleSet] = undefined;
                }
                
                // Change selection.
                selectedTriangleSet++;
                if(selectedTriangleSet >= transformedVertices.length)
                    selectedTriangleSet = 0;
                
                if(selectedTriangleSet !== -1) {
                    selectionOn = true;
                    
                    // Lengthen the array to hold this index.
                    while(transformedVertices.length <= selectedTriangleSet)
                        transformedVertices.push(undefined);
                    while(transformMatrices.length <= selectedTriangleSet)
                        transformMatrices.push(mat4.create());

                    // Scale triangle set by 1.2
                    const center = centroid(transformedVertices[selectedTriangleSet]);
                    const transformMatrix = transformMatrices[selectedTriangleSet];
                    vec3.negate(tempVec, center);
                    mat4.fromTranslation(tempMat, tempVec);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    mat4.fromScaling(tempMat, vec3.fromValues(1.2,1.2,1.2));
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    mat4.fromTranslation(tempMat, center);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    // Invalidate new selected triangle set's transformedVertices, they must be recomputed.
                    transformedVertices[selectedTriangleSet] = undefined;
                    handleTriangles();
                }
                break;
            // Deselect triangle set
            case ' ':
                if(selectionOn) {
                    selectionOn = false;
                    
                    // Unscale triangle set by 1.2
                    const center = centroid(transformedVertices[selectedTriangleSet]);
                    const transformMatrix = transformMatrices[selectedTriangleSet];
                    vec3.negate(tempVec, center);
                    mat4.fromTranslation(tempMat, tempVec);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    mat4.fromScaling(tempMat, vec3.fromValues(1/1.2, 1/1.2, 1/1.2));
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    mat4.fromTranslation(tempMat, center);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    
                    // Invalidate old selected triangle set's transformedVertices, they must be recomputed.
                    transformedVertices[selectedTriangleSet] = undefined;
                    handleTriangles();
                }
                break;
            case '!':
                if (!specialOn) {
                    specialOn = true;
                    specialAction();
                }
        }
    })
    
    // shift listener
    document.addEventListener('keypress', (e) => {
        const MOVEMENT_SPEED = 0.03;
        const ROTATION_SPEED = 0.03;
        // 3 degrees
        const SIN_THETA = 0.0299955002025;
        const COS_THETA = 0.999550033749;
        
        const eyeVec = vec3.fromValues(...eye);
        const lookatVec = vec3.fromValues(...lookat);
        vec3.normalize(lookatVec,lookatVec);
        const upVec = vec3.fromValues(...up);
        vec3.scaleAndAdd(upVec,upVec,lookatVec,-vec3.dot(upVec,lookatVec)/vec3.dot(lookatVec,lookatVec));
        vec3.normalize(upVec,upVec);
        const rightVec = vec3.create();
        vec3.cross(rightVec,lookatVec,upVec);
        
        const tempVec = vec3.create();
        const tempMat = mat4.create();
        
        switch(e.key) {
            // Move left
            case 'a':
                vec3.scaleAndAdd(eyeVec,eyeVec,rightVec,-MOVEMENT_SPEED);
                break;
            // Move right
            case 'd':
                vec3.scaleAndAdd(eyeVec,eyeVec,rightVec,MOVEMENT_SPEED);
                break;
            // Move forward
            case 'w':
                vec3.scaleAndAdd(eyeVec,eyeVec,lookatVec,MOVEMENT_SPEED);
                break;
            // Move backward
            case 's':
                vec3.scaleAndAdd(eyeVec,eyeVec,lookatVec,-MOVEMENT_SPEED);
                break;
            // Move up
            case 'q':
                vec3.scaleAndAdd(eyeVec,eyeVec,upVec,MOVEMENT_SPEED);
                break;
            // Move down
            case 'e':
                vec3.scaleAndAdd(eyeVec,eyeVec,upVec,-MOVEMENT_SPEED);
                break;


                
            // Turn left
            case 'A':
                vec3.transformMat3(lookatVec,lookatVec,mat3.fromValues(
                    upVec[0]*upVec[0]*(1-COS_THETA) + COS_THETA,
                    upVec[0]*upVec[1]*(1-COS_THETA) + upVec[2]*SIN_THETA,
                    upVec[0]*upVec[2]*(1-COS_THETA) - upVec[1]*SIN_THETA,
                    upVec[1]*upVec[0]*(1-COS_THETA) - upVec[2]*SIN_THETA,
                    upVec[1]*upVec[1]*(1-COS_THETA) + COS_THETA,
                    upVec[1]*upVec[2]*(1-COS_THETA) + upVec[0]*SIN_THETA,
                    upVec[2]*upVec[0]*(1-COS_THETA) + upVec[1]*SIN_THETA,
                    upVec[2]*upVec[1]*(1-COS_THETA) - upVec[0]*SIN_THETA,
                    upVec[2]*upVec[2]*(1-COS_THETA) + COS_THETA,
                ));
                break;
            // Turn right
            case 'D':
                vec3.transformMat3(lookatVec,lookatVec,mat3.fromValues(
                    upVec[0]*upVec[0]*(1-COS_THETA) + COS_THETA,
                    upVec[0]*upVec[1]*(1-COS_THETA) - upVec[2]*SIN_THETA,
                    upVec[0]*upVec[2]*(1-COS_THETA) + upVec[1]*SIN_THETA,
                    upVec[1]*upVec[0]*(1-COS_THETA) + upVec[2]*SIN_THETA,
                    upVec[1]*upVec[1]*(1-COS_THETA) + COS_THETA,
                    upVec[1]*upVec[2]*(1-COS_THETA) - upVec[0]*SIN_THETA,
                    upVec[2]*upVec[0]*(1-COS_THETA) - upVec[1]*SIN_THETA,
                    upVec[2]*upVec[1]*(1-COS_THETA) + upVec[0]*SIN_THETA,
                    upVec[2]*upVec[2]*(1-COS_THETA) + COS_THETA,
                ));
                break;
            // Lean forward to look down. It feels more intuitive to make W look upward,
            // but the instructions say to make it like this instead.
            case 'W':
                vec3.transformMat3(lookatVec,lookatVec,mat3.fromValues(
                    rightVec[0]*rightVec[0]*(1-COS_THETA) + COS_THETA,
                    rightVec[0]*rightVec[1]*(1-COS_THETA) - rightVec[2]*SIN_THETA,
                    rightVec[0]*rightVec[2]*(1-COS_THETA) + rightVec[1]*SIN_THETA,
                    rightVec[1]*rightVec[0]*(1-COS_THETA) + rightVec[2]*SIN_THETA,
                    rightVec[1]*rightVec[1]*(1-COS_THETA) + COS_THETA,
                    rightVec[1]*rightVec[2]*(1-COS_THETA) - rightVec[0]*SIN_THETA,
                    rightVec[2]*rightVec[0]*(1-COS_THETA) - rightVec[1]*SIN_THETA,
                    rightVec[2]*rightVec[1]*(1-COS_THETA) + rightVec[0]*SIN_THETA,
                    rightVec[2]*rightVec[2]*(1-COS_THETA) + COS_THETA,
                ));
                vec3.transformMat3(upVec,upVec,mat3.fromValues(
                    rightVec[0]*rightVec[0]*(1-COS_THETA) + COS_THETA,
                    rightVec[0]*rightVec[1]*(1-COS_THETA) - rightVec[2]*SIN_THETA,
                    rightVec[0]*rightVec[2]*(1-COS_THETA) + rightVec[1]*SIN_THETA,
                    rightVec[1]*rightVec[0]*(1-COS_THETA) + rightVec[2]*SIN_THETA,
                    rightVec[1]*rightVec[1]*(1-COS_THETA) + COS_THETA,
                    rightVec[1]*rightVec[2]*(1-COS_THETA) - rightVec[0]*SIN_THETA,
                    rightVec[2]*rightVec[0]*(1-COS_THETA) - rightVec[1]*SIN_THETA,
                    rightVec[2]*rightVec[1]*(1-COS_THETA) + rightVec[0]*SIN_THETA,
                    rightVec[2]*rightVec[2]*(1-COS_THETA) + COS_THETA,
                ));
                break;
            // Lean backward to look up.
            case 'S':
                vec3.transformMat3(lookatVec,lookatVec,mat3.fromValues(
                    rightVec[0]*rightVec[0]*(1-COS_THETA) + COS_THETA,
                    rightVec[0]*rightVec[1]*(1-COS_THETA) + rightVec[2]*SIN_THETA,
                    rightVec[0]*rightVec[2]*(1-COS_THETA) - rightVec[1]*SIN_THETA,
                    rightVec[1]*rightVec[0]*(1-COS_THETA) - rightVec[2]*SIN_THETA,
                    rightVec[1]*rightVec[1]*(1-COS_THETA) + COS_THETA,
                    rightVec[1]*rightVec[2]*(1-COS_THETA) + rightVec[0]*SIN_THETA,
                    rightVec[2]*rightVec[0]*(1-COS_THETA) + rightVec[1]*SIN_THETA,
                    rightVec[2]*rightVec[1]*(1-COS_THETA) - rightVec[0]*SIN_THETA,
                    rightVec[2]*rightVec[2]*(1-COS_THETA) + COS_THETA,
                ));
                vec3.transformMat3(upVec,upVec,mat3.fromValues(
                    rightVec[0]*rightVec[0]*(1-COS_THETA) + COS_THETA,
                    rightVec[0]*rightVec[1]*(1-COS_THETA) + rightVec[2]*SIN_THETA,
                    rightVec[0]*rightVec[2]*(1-COS_THETA) - rightVec[1]*SIN_THETA,
                    rightVec[1]*rightVec[0]*(1-COS_THETA) - rightVec[2]*SIN_THETA,
                    rightVec[1]*rightVec[1]*(1-COS_THETA) + COS_THETA,
                    rightVec[1]*rightVec[2]*(1-COS_THETA) + rightVec[0]*SIN_THETA,
                    rightVec[2]*rightVec[0]*(1-COS_THETA) + rightVec[1]*SIN_THETA,
                    rightVec[2]*rightVec[1]*(1-COS_THETA) - rightVec[0]*SIN_THETA,
                    rightVec[2]*rightVec[2]*(1-COS_THETA) + COS_THETA,
                ));
                break;

                
            case 'k':
                if(selectionOn) {
                    vec3.scale(tempVec, rightVec, -MOVEMENT_SPEED);
                    const transformMatrix = transformMatrices[selectedTriangleSet];
                    mat4.fromTranslation(tempMat, tempVec);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    // Invalidate selected triangle set's transformedVertices, they must be recomputed.
                    transformedVertices[selectedTriangleSet] = undefined;
                    handleTriangles();
                }
                break;
            case ';':
                if(selectionOn) {
                    vec3.scale(tempVec, rightVec, MOVEMENT_SPEED);
                    const transformMatrix = transformMatrices[selectedTriangleSet];
                    mat4.fromTranslation(tempMat, tempVec);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    // Invalidate selected triangle set's transformedVertices, they must be recomputed.
                    transformedVertices[selectedTriangleSet] = undefined;
                    handleTriangles();
                }
                break;
            case 'o':
                if(selectionOn) {
                    vec3.scale(tempVec, lookatVec, MOVEMENT_SPEED);
                    const transformMatrix = transformMatrices[selectedTriangleSet];
                    mat4.fromTranslation(tempMat, tempVec);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    // Invalidate selected triangle set's transformedVertices, they must be recomputed.
                    transformedVertices[selectedTriangleSet] = undefined;
                    handleTriangles();
                }
                break;
            case 'l':
                if(selectionOn) {
                    vec3.scale(tempVec, lookatVec, -MOVEMENT_SPEED);
                    const transformMatrix = transformMatrices[selectedTriangleSet];
                    mat4.fromTranslation(tempMat, tempVec);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    // Invalidate selected triangle set's transformedVertices, they must be recomputed.
                    transformedVertices[selectedTriangleSet] = undefined;
                    handleTriangles();
                }
                break;
            case 'i':
                if(selectionOn) {
                    vec3.scale(tempVec, upVec, MOVEMENT_SPEED);
                    const transformMatrix = transformMatrices[selectedTriangleSet];
                    mat4.fromTranslation(tempMat, tempVec);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    // Invalidate selected triangle set's transformedVertices, they must be recomputed.
                    transformedVertices[selectedTriangleSet] = undefined;
                    handleTriangles();
                }
                break;
            case 'p':
                if(selectionOn) {
                    vec3.scale(tempVec, upVec, -MOVEMENT_SPEED);
                    const transformMatrix = transformMatrices[selectedTriangleSet];
                    mat4.fromTranslation(tempMat, tempVec);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    // Invalidate selected triangle set's transformedVertices, they must be recomputed.
                    transformedVertices[selectedTriangleSet] = undefined;
                    handleTriangles();
                }
                break;
            case 'K':
                if(selectionOn) {
                    const center = centroid(transformedVertices[selectedTriangleSet]);
                    const transformMatrix = transformMatrices[selectedTriangleSet];
                    vec3.negate(tempVec, center);
                    mat4.fromTranslation(tempMat, tempVec);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    mat4.fromRotation(tempMat, ROTATION_SPEED, upVec);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    mat4.fromTranslation(tempMat, center);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    
                    // Invalidate selected triangle set's transformedVertices, they must be recomputed.
                    transformedVertices[selectedTriangleSet] = undefined;
                    handleTriangles();
                }
                break;
            case ':':
                if(selectionOn) {
                    const center = centroid(transformedVertices[selectedTriangleSet]);
                    const transformMatrix = transformMatrices[selectedTriangleSet];
                    vec3.negate(tempVec, center);
                    mat4.fromTranslation(tempMat, tempVec);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    mat4.fromRotation(tempMat, -ROTATION_SPEED, upVec);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    mat4.fromTranslation(tempMat, center);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    
                    // Invalidate selected triangle set's transformedVertices, they must be recomputed.
                    transformedVertices[selectedTriangleSet] = undefined;
                    handleTriangles();
                }
                break;
            case 'O':
                if(selectionOn) {
                    const center = centroid(transformedVertices[selectedTriangleSet]);
                    const transformMatrix = transformMatrices[selectedTriangleSet];
                    vec3.negate(tempVec, center);
                    mat4.fromTranslation(tempMat, tempVec);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    mat4.fromRotation(tempMat, -ROTATION_SPEED, rightVec);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    mat4.fromTranslation(tempMat, center);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    
                    // Invalidate selected triangle set's transformedVertices, they must be recomputed.
                    transformedVertices[selectedTriangleSet] = undefined;
                    handleTriangles();
                }
                break;
            case 'L':
                if(selectionOn) {
                    const center = centroid(transformedVertices[selectedTriangleSet]);
                    const transformMatrix = transformMatrices[selectedTriangleSet];
                    vec3.negate(tempVec, center);
                    mat4.fromTranslation(tempMat, tempVec);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    mat4.fromRotation(tempMat, ROTATION_SPEED, rightVec);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    mat4.fromTranslation(tempMat, center);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    
                    // Invalidate selected triangle set's transformedVertices, they must be recomputed.
                    transformedVertices[selectedTriangleSet] = undefined;
                    handleTriangles();
                }
                break;
            case 'I':
                if(selectionOn) {
                    const center = centroid(transformedVertices[selectedTriangleSet]);
                    const transformMatrix = transformMatrices[selectedTriangleSet];
                    vec3.negate(tempVec, center);
                    mat4.fromTranslation(tempMat, tempVec);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    mat4.fromRotation(tempMat, ROTATION_SPEED, lookatVec);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    mat4.fromTranslation(tempMat, center);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    
                    // Invalidate selected triangle set's transformedVertices, they must be recomputed.
                    transformedVertices[selectedTriangleSet] = undefined;
                    handleTriangles();
                }
                break;
            case 'P':
                if(selectionOn) {
                    const center = centroid(transformedVertices[selectedTriangleSet]);
                    const transformMatrix = transformMatrices[selectedTriangleSet];
                    vec3.negate(tempVec, center);
                    mat4.fromTranslation(tempMat, tempVec);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    mat4.fromRotation(tempMat, -ROTATION_SPEED, lookatVec);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    mat4.fromTranslation(tempMat, center);
                    mat4.mul(transformMatrix, tempMat, transformMatrix);
                    
                    // Invalidate selected triangle set's transformedVertices, they must be recomputed.
                    transformedVertices[selectedTriangleSet] = undefined;
                    handleTriangles();
                }
                break;
        }
        eye = Array.from(eyeVec);
        lookat = Array.from(lookatVec);
        up = Array.from(upVec);
    });
  
} // end main
