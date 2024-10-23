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
var diffuseColorBuffer; // this contains diffuse color values in triples
var ambientColorBuffer; // this contains ambient color values in triples
var specularColorBuffer; // this contains specular color values in triples
var nBuffer; // this contains specular exponent values
var triangleBuffer; // this contains indices into vertexBuffer in triples
var triBufferSize = 0; // the number of indices in the triangle buffer
var eye; // vector representing eye location
var up; // vector representing up direction
var lookat; // vector representing eye look direction
var vertexPositionAttrib; // where to put position for vertex shader

var diffuseColorAttrib; // where to put diffuse color for vertex shader
var ambientColorAttrib; // where to put ambient color for vertex shader
var specularColorAttrib; // where to put specular color for vertex shader
var nAttrib; // where to put specular exponent for vertex shader
var normalAttrib; // where to put normal vector for vertex shader

var eyeUniform; // where to put eye vector for vertex shader
var upUniform; // where to put up vector for vertex shader
var lookatUniform; // where to put lookat flag for vertex shader

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
        var idxArray = []; // 1D array of indices for WebGL
        var diffuseColorArray = []; // 1D array of diffuse color coords for WebGL
        var ambientColorArray = []; // 1D array of ambient color coords for WebGL
        var specularColorArray = []; // 1D array of specular color coords for WebGL
        var nArray = [];
        var normalArray = []; // 1D array of normal vector coords for WebGL

        var idx = 0;
        inputTriangles.forEach(triangleSet => {
            triangleSet.triangles.forEach(triangle => {
                const vertices = triangle.map(vertex => triangleSet.vertices[vertex]);

                // Compute normal for triangle
                const A = [0,1,2].map(dim => vertices[2][dim] - vertices[0][dim]);
                const B = [0,1,2].map(dim => vertices[1][dim] - vertices[0][dim]);
                let normal = vec3.create();
                normal = vec3.cross(normal, A, B);
                const normalLength = vec3.len(normal);
                normal = normal.map(val => val / normalLength);
                
                vertices.forEach(vertex => {
                    // No more reusing vertices, because if I do then a vertex may border multiple triangles with different normals,
                    // so I wouldn't know how to provide info for specular highlight.
                    coordArray.push(vertex);
                    idxArray.push(idx++);
                    diffuseColorArray.push(triangleSet.material.diffuse);
                    ambientColorArray.push(triangleSet.material.ambient);
                    specularColorArray.push(triangleSet.material.specular);
                    nArray.push(triangleSet.material.n);
                    normalArray.push(normal);
                });
            });
        });
        coordArray = coordArray.flat();
        diffuseColorArray = diffuseColorArray.flat();
        ambientColorArray = ambientColorArray.flat();
        specularColorArray = specularColorArray.flat();
        normalArray = normalArray.flat();
        triBufferSize = idx;
    
        // send the vertex coords to webGL
        vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(coordArray),gl.STATIC_DRAW); // coords to that buffer

        // send the triangle idxs to webGL
        triangleBuffer = gl.createBuffer(); // init empty triangle idx buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffer); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(idxArray),gl.STATIC_DRAW); // idxs to that buffer

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
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(specularColorBuffer),gl.STATIC_DRAW); // colors to that buffer

        nBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER,nBuffer);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(nBuffer),gl.STATIC_DRAW);
        
        // send the normal vectors to webGL
        normalBuffer = gl.createBuffer(); // init empty vector buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(normalArray),gl.STATIC_DRAW); // vectors to that buffer
    } // end if triangles found
} // end load triangles

// setup the webGL shaders
function setupShaders() {
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        varying lowp vec3 diffuseCol;    
        varying lowp vec3 ambientCol;
        varying lowp vec3 specularCol;
        varying lowp float n;
        varying lowp vec3 norm;
        varying lowp vec3 toLight;
        varying lowp vec3 toEye;
        void main(void) {
            lowp vec3 color = ambientCol;
            lowp float difCoeff = dot(norm, toLight);
            //if(difCoeff > 0.0) {
                color += diffuseCol * difCoeff;
            //}
            lowp vec3 rVec = 2.0 * dot(toLight, norm) * norm - toLight;
            lowp float specCoeff = dot(toEye, rVec);
            if(specCoeff > 0.0) {
                color += specularCol * pow(specCoeff, n);
            }
            
            gl_FragColor = vec4(color, 1.0);
        }
    `;
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 vertexPosition;
        
        uniform highp vec3 eye;
        uniform highp vec3 up; // direction, not point
        uniform highp vec3 lookat; // direction, not point
        
        uniform float windowDist;
        uniform float left;
        uniform float right;
        uniform float bottom;
        uniform float top;
        
        uniform float near;
        uniform float far;

        attribute vec3 diffuseColor;
        attribute vec3 ambientColor;
        attribute vec3 specularColor;
        attribute float nVal;
        attribute vec3 normal;
        varying highp vec3 diffuseCol;
        varying highp vec3 ambientCol;
        varying highp vec3 specularCol;
        varying highp float n;
        varying highp vec3 norm;
        varying highp vec3 toLight;
        varying highp vec3 toEye;

        uniform vec3 lightPos;

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
            n = nVal;
            norm = normal;
            toLight = lightPos - vertexPosition;
            toEye = eye - vertexPosition;
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
                diffuseColorAttrib = // get pointer to diffuse color shader input
                    gl.getAttribLocation(shaderProgram, "diffuseColor");
                gl.enableVertexAttribArray(diffuseColorAttrib); // input to shader from array
                ambientColorAttrib = // get pointer to ambient color shader input
                    gl.getAttribLocation(shaderProgram, "ambientColor");
                gl.enableVertexAttribArray(ambientColorAttrib); // input to shader from array
                specularColorAttrib = // get pointer to specular color shader input
                    gl.getAttribLocation(shaderProgram, "specularColor");
                gl.enableVertexAttribArray(specularColorAttrib); // input to shader from array
                normalAttrib = // get pointer to normal vector shader input
                    gl.getAttribLocation(shaderProgram, "normal");
                gl.enableVertexAttribArray(normalAttrib); // input to shader from array
                
                eyeUniform = // get pointer to eye vector
                    gl.getUniformLocation(shaderProgram, "eye");
                upUniform = // get pointer to up vector
                    gl.getUniformLocation(shaderProgram, "up");
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
    eye=[0.5,0.5,-0.5];
    upArray=[0,1,0];
    lookatArray=[0,0,1];
    
    lookat=vec3.fromValues(...lookatArray);
    vec3.normalize(lookat,lookat);
    
    up=vec3.fromValues(...upArray);
    temp=vec3.create();
    vec3.dot(temp,up,lookat)
    up=vec3.sub(up,up,temp);
    vec3.normalize(up,up);

    right=vec3.create();
    vec3.cross(right,lookat,up);
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
    // diffuse color buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,diffuseColorBuffer); // activate
    gl.vertexAttribPointer(diffuseColorAttrib,3,gl.FLOAT,false,0,0); // feed
    // ambient color buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,ambientColorBuffer); // activate
    gl.vertexAttribPointer(ambientColorAttrib,3,gl.FLOAT,false,0,0); // feed
    // specular color buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,specularColorBuffer); // activate
    gl.vertexAttribPointer(specularColorAttrib,3,gl.FLOAT,false,0,0); // feed
    // normal buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,normalBuffer); // activate
    gl.vertexAttribPointer(normalAttrib,3,gl.FLOAT,false,0,0); // feed
    // idx buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer);
    gl.drawElements(gl.TRIANGLES,triBufferSize,gl.UNSIGNED_SHORT,0); // render
    
    // eye vector
    gl.uniform3fv(eyeUniform, eye); // feed
    // up vector
    gl.uniform3fv(upUniform, up); // feed
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
