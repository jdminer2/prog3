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
var colorBuffer; // this contains color values in triples
var triangleBuffer; // this contains indices into vertexBuffer in triples
var triBufferSize = 0; // the number of indices in the triangle buffer
var altPosition; // flag indicating whether to alter vertex positions
var eye; // vector representing eye location
var lookat; // vector representing eye look direction
var lookatDist; // value representing distance from eye to window
var vertexPositionAttrib; // where to put position for vertex shader
var vertexColorAttrib; // where to put color for vertex shader
var altPositionUniform; // where to put altPosition flag for vertex shader
var eyeUniform; // where to put eye vector for vertex shader
var lookatUniform; // where to put lookat flag for vertex shader
var lookatDistUniform; // where to put lookatDist value for vertex shader

var windowDistUniform; // where to put windowDist value for vertex shader
var leftUniform; // where to put left value for vertex shader
var rightUniform; // where to put right value for vertex shader
var bottomUniform; // where to put bottom value for vertex shader
var topUniform; // where to put top value for vertex shader
var nearUniform; // where to put near value for vertex shader
var farUniform; // where to put far value for vertex shader


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
function loadTriangles() {
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");
    if (inputTriangles != String.null) { 
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var coordArray = []; // 1D array of vertex coords for WebGL
        var colorArray = []; // 1D array of color coords for WebGL
        var idxArray = []; // 1D array of indices for WebGL
        
        for (var whichSet=0; whichSet<inputTriangles.length; whichSet++) {
            var idxOffset = coordArray.length / 3;
            // set up the vertex coord array
            for (whichSetVert=0; whichSetVert<inputTriangles[whichSet].vertices.length; whichSetVert++){
                coordArray = coordArray.concat(inputTriangles[whichSet].vertices[whichSetVert]);
                colorArray = colorArray.concat(inputTriangles[whichSet].material.diffuse);
            }
            for (whichSetTri=0; whichSetTri<inputTriangles[whichSet].triangles.length; whichSetTri++){
                var currentTriangle = inputTriangles[whichSet].triangles[whichSetTri];
                idxArray.push(currentTriangle[0] + idxOffset,
                              currentTriangle[1] + idxOffset,
                              currentTriangle[2] + idxOffset
                             );
            }
        } // end for each triangle set 
        triBufferSize = idxArray.length;
        
        // send the vertex coords to webGL
        vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(coordArray),gl.STATIC_DRAW); // coords to that buffer

        // send the vertex colors to webGL
        colorBuffer = gl.createBuffer(); // init empty vertex color buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,colorBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(colorArray),gl.STATIC_DRAW); // colors to that buffer

        // send the triangle idxs to webGL
        triangleBuffer = gl.createBuffer(); // init empty triangle idx buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffer); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(idxArray),gl.STATIC_DRAW); // idxs to that buffer
    } // end if triangles found
} // end load triangles

// setup the webGL shaders
function setupShaders() {
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        varying lowp vec3 color;
        void main(void) {
            gl_FragColor = vec4(color, 1.0);
        }
    `;
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 vertexPosition;
        attribute vec3 vertexColor;
        varying highp vec3 color;
        uniform highp vec3 eye;
        uniform highp vec3 lookat;
        uniform float windowDist;
        uniform float left;
        uniform float right;
        uniform float bottom;
        uniform float top;
        uniform float near;
        uniform float far;

        void main(void) {
            // Perspective projection transform points onto a plane windowDist units ahead of the eye.
            vec3 relativePosition = vertexPosition - eye;
            float distAlongLookat = dot(lookat, relativePosition) / dot(lookat, lookat);
            vec3 projectedPosition = relativePosition / distAlongLookat * windowDist;

            // Frustum clipping: take the rectangle [left,right] [bottom,top] from the projected plane, where the eye is looking at (0,0).
            // Stretch this rectangle onto the canvas. Also setting the depth here for near/far clipping.
            vec3 clippedPosition = vec3(
                (projectedPosition[0] - left) / (right - left),
                (projectedPosition[1] - bottom) / (top - bottom),
                (distAlongLookat - near) / (far - near)
            ) * 2.0 - 1.0;
            
            gl_Position = vec4(clippedPosition, 1.0); // use the altered position
            color = vertexColor;
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
                vertexColorAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexColor");
                gl.enableVertexAttribArray(vertexColorAttrib); // input to shader from array
                altPositionUniform = // get pointer to altPosition flag
                    gl.getUniformLocation(shaderProgram, "altPosition");
                eyeUniform = // get pointer to eye vector
                    gl.getUniformLocation(shaderProgram, "eye");
                lookatUniform = // get pointer to lookat vector
                    gl.getUniformLocation(shaderProgram, "lookat");

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
    eye = [0.5,0.5,-0.5];
    lookat = [0,0,1];
    lookatDist = 0.5;
} // end setup shaders
var bgColor = 0;
// render the loaded model
function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    bgColor = (bgColor < 1) ? (bgColor + 0.001) : 0;
    gl.clearColor(bgColor, 0, 0, 1.0);
    requestAnimationFrame(renderTriangles);
    // vertex buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); // feed
    // color buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,colorBuffer); // activate
    gl.vertexAttribPointer(vertexColorAttrib,3,gl.FLOAT,false,0,0); // feed
    // idx buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer);
    gl.drawElements(gl.TRIANGLES,triBufferSize,gl.UNSIGNED_SHORT,0); // render
    // altPosition boolean
    gl.uniform1i(altPositionUniform, altPosition); // feed
    // eye vector
    gl.uniform3fv(eyeUniform, eye); // feed
    // lookat vector
    gl.uniform3fv(lookatUniform, lookat); // feed
    
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


/* MAIN -- HERE is where execution begins after window load */

function main() {
  
  setupWebGL(); // set up the webGL environment
  loadTriangles(); // load in the triangles from tri file
  setupShaders(); // setup the webGL shaders
  renderTriangles(); // draw the triangles using webGL
  
} // end main
