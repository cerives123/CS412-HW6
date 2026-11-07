const VERTEX_SHADER = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
in vec3 aTangent;
in vec2 aTexCoord;

uniform mat4 uModelView;
uniform mat4 uProjection;

out vec3 vPosition;
out vec3 vNormal;
out vec3 vTangent;
out vec2 vTexCoord;

void main() {
  vec4 p = uModelView * vec4(aPosition, 1.0);
  vPosition = p.xyz;

  // Inverse transpose for potential non-uniform scalings
  mat3 mv = mat3(uModelView);
  vNormal = transpose(inverse(mv)) * aNormal;


  vTangent = mv * aTangent;
  vTexCoord = aTexCoord;
  gl_Position = uProjection * p;
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision mediump float;

in vec3 vPosition;
in vec3 vNormal;
in vec3 vTangent;
in vec2 vTexCoord;


uniform sampler2D uTexture;
uniform sampler2D uDetail;
uniform int uMapping;  // 0 = bump mapping, 1 = normal mapping
//spotlights for displays
uniform vec3 uLightPos[3];
uniform vec3 uLightDir[3];
uniform vec3 uLightColor[3];


out vec4 fragColor;

const float bumpScale = 3.0;

// convert RGB to luminance (Rec._601 standard, https://en.wikipedia.org/wiki/Rec._601)
// or you can use a height map texture
float height(vec2 uv) {
  return dot(
    texture(uDetail, uv).rgb,
    vec3(0.299, 0.587, 0.114)
  );
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 T = normalize(vTangent - dot(vTangent, N) * N);
  vec3 B = normalize(cross(N, T));
  mat3 TBN = mat3(T, B, N);

  // Fang bump mapping uses its height texture
  if (uMapping == 0) {
    vec2 texel = 1.0 / vec2(textureSize(uDetail, 0));
    float dx = height(vTexCoord + vec2(texel.x, 0.0)) -height(vTexCoord - vec2(texel.x, 0.0));
    float dy = height(vTexCoord + vec2(0.0, texel.y)) -height(vTexCoord - vec2(0.0, texel.y));
    N = normalize(TBN * normalize(vec3(-bumpScale * dx, -bumpScale * dy, 1.0)));
  }

  //Halo normal mapping uses a separate normal map
  else if (uMapping == 1) {
    vec3 mapped = texture(uDetail, vTexCoord).rgb * 2.0 - 1.0;
    N = normalize(TBN * normalize(mapped));
  }

  // Ordinary texturing (uMapping = 2)
  // uses the original geometry normal.

  vec3 baseColor = texture(uTexture, vTexCoord).rgb;
  vec3 color = baseColor * 0.24;
  vec3 V = normalize(-vPosition);

  // Lighting from three colored spotlights
  for (int i = 0; i < 3; i++) {
    vec3 towardLight = uLightPos[i] - vPosition;
    float d = length(towardLight);
    vec3 L = normalize(towardLight);

    float cone = dot(normalize(uLightDir[i]), -L);
    float spot = smoothstep(0.80, 0.96, cone);
    float attenuation = 1.0 / (1.0 + 0.04 * d * d);

    float diffuse = max(dot(N, L), 0.0);
    vec3 R = reflect(-L, N);

    float spec = diffuse > 0.0 ? pow(max(dot(V, R), 0.0), 30.0) : 0.0;

    color += (baseColor * diffuse + vec3(0.28) * spec) * uLightColor[i] * spot * attenuation;
  }
  fragColor = vec4(color, 1.0);
}
`;

// WebGL setup
const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl2");

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

const ATTRIBUTES = { aPosition: 0, aNormal: 1, aTexCoord: 2, aTangent: 3 };

function createProgram(vsSource, fsSource) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, vsSource));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fsSource));
  for (const name in ATTRIBUTES) gl.bindAttribLocation(prog, ATTRIBUTES[name], name);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  return prog;
}

// Shader editors
const vertEditor = document.getElementById("vertEditor");
const fragEditor = document.getElementById("fragEditor");
const shaderError = document.getElementById("shaderError");
vertEditor.value = VERTEX_SHADER;
fragEditor.value = FRAGMENT_SHADER;

let program, uModelView, uProjection, uLightPos, uMapping;
let uLightDir, uLightColor;

function updateProgram() {
  try {
    const prog = createProgram(
      vertEditor.value,
      fragEditor.value
    );
    if (program) gl.deleteProgram(program);
    program = prog;
    gl.useProgram(program);
    uModelView = gl.getUniformLocation(program, "uModelView");
    uProjection = gl.getUniformLocation(program, "uProjection");
    uMapping = gl.getUniformLocation(program, "uMapping");
    // Spotlight uniforms
    uLightPos = gl.getUniformLocation(program, "uLightPos[0]");
    uLightDir = gl.getUniformLocation(program, "uLightDir[0]");
    uLightColor = gl.getUniformLocation(program, "uLightColor[0]");
    gl.uniform1i(gl.getUniformLocation(program, "uTexture"), 0);
    gl.uniform1i(gl.getUniformLocation(program, "uDetail"), 1);
    shaderError.textContent = "";
  } catch (e) {
    shaderError.textContent = e.message.replace(/\0/g, "");
  }
}
updateProgram();
vertEditor.addEventListener("input", updateProgram);
fragEditor.addEventListener("input", updateProgram);

function bindAttribute(name, data, size) {
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.vertexAttribPointer(ATTRIBUTES[name], size, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(ATTRIBUTES[name]);
}

function createMesh({ positions, normals, tangents, texCoords, indices }) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  bindAttribute("aPosition", positions, 3);
  bindAttribute("aNormal", normals, 3);
  bindAttribute("aTangent", tangents, 3);
  bindAttribute("aTexCoord", texCoords, 2);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  return { vao, count: indices.length };
}

const cubeMesh = createMesh(createCube());
const sphereMesh = createMesh(createSphere());
const torusMesh = createMesh(createTorus());
const coneMesh = createMesh(createCone());
//const cylinderMesh = createMesh(createCylinder());

function loadTexture(url) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 255, 255]));

  const image = new Image();
  image.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);  // images start at the top row, texture coordinates at the bottom
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  };
  image.src = url;
  return texture;
}
function solidTexture(rgb) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,1, 1, 0,gl.RGBA, gl.UNSIGNED_BYTE,new Uint8Array([...rgb, 255]));
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  return texture;
}


const pedestalTexture = solidTexture([55, 52, 63]);
const plaqueTexture = solidTexture([169, 130, 65]);

const haloTexture = loadTexture("textures/halo-color.jpg");
const haloNormal = loadTexture("textures/halo-normal.png");

const fangTexture = loadTexture("textures/fang-color.jpg");
const fangHeight = loadTexture("textures/fang-height.png");

//eye video texture for Orb

const eyeVideo = document.createElement("video");
eyeVideo.src = "textures/eye.mp4";
eyeVideo.loop = true;
eyeVideo.muted = true;
eyeVideo.playsInline = true;
eyeVideo.autoplay = true;

eyeVideo.addEventListener("canplay", () => {eyeVideo.play();});

canvas.addEventListener("click", () => {eyeVideo.play();});

// Create WebGL texture for the video
const eyeTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, eyeTexture);
gl.texImage2D(
  gl.TEXTURE_2D, 0, gl.RGBA,
  1, 1, 0,
  gl.RGBA, gl.UNSIGNED_BYTE,
  new Uint8Array([0, 0, 0, 255])
);

gl.texParameteri(
  gl.TEXTURE_2D,
  gl.TEXTURE_MIN_FILTER,
  gl.LINEAR
);

gl.texParameteri(
  gl.TEXTURE_2D,
  gl.TEXTURE_MAG_FILTER,
  gl.LINEAR
);

//Update the texture using video frames
function animateEye(t) {
  if (eyeVideo.readyState >= eyeVideo.HAVE_CURRENT_DATA) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, eyeTexture);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      eyeVideo
    );
  }
}

const exhibitX = [-2.3, 0, 2.3];

const lights = exhibitX.map((x, i) => ({
  position: [x, 3.3, 1.8],
  target: [x, 0, 0],

  color: [
    [1.4, 0.8, 1.6],   //Purple 
    [0.6, 1.2, 1.7],   //Blue
    [1.7, 1.15, 0.65]  // Amber
  ][i],

  enabled: true
}));

// spotlights
document.querySelectorAll(".light-toggle").forEach(input => {
  input.addEventListener("change", () => {
    lights[Number(input.dataset.light)].enabled = input.checked;
  });
});


gl.enable(gl.DEPTH_TEST);
gl.clearColor(0, 0, 0, 1);
const projection = perspective(Math.PI / 4, canvas.width / canvas.height, 0.1, 100);
let dragRotX = 0, dragRotY = -0.12;
let camX = 0, camY = 0.15, camZ = -6;

let sliderAngle = 0;
let spinning = false, spinAngle = 0;

let mouseDown = false, lastX, lastY;

canvas.addEventListener("mousedown", e => {
  mouseDown = true;
  lastX = e.clientX;
  lastY = e.clientY;
});

window.addEventListener("mouseup", () => mouseDown = false);

window.addEventListener("mousemove", e => {
  if (!mouseDown) return;

  dragRotY += (e.clientX - lastX) * 0.01;
  dragRotX += (e.clientY - lastY) * 0.01;

  lastX = e.clientX;
  lastY = e.clientY;
});

document.addEventListener("keydown", e => {
  if (e.target === vertEditor || e.target === fragEditor) return;

  const step = 0.2;

  switch (e.key) {
    case "ArrowUp": camY -= step; break;
    case "ArrowDown": camY += step; break;
    case "ArrowLeft": camX += step; break;
    case "ArrowRight": camX -= step; break;
    case "w": camZ += step; break;
    case "s": camZ -= step; break;
    default: return;
  }

  e.preventDefault();
});

const axisSelect = document.getElementById("axisSelect");

document.getElementById("slider").addEventListener("input", e => {sliderAngle = Number(e.target.value);document.getElementById("sliderValue").textContent = sliderAngle;});

document.getElementById("spinButton").addEventListener("click", () => {spinning = !spinning;});

const BUMP_MAPPING = 0;
const NORMAL_MAPPING = 1;
const COLOR_MAPPING = 2;

function draw(mesh, modelView, colorMap, detailMap, mapping) {
  gl.uniformMatrix4fv(uModelView, false, modelView);
  gl.uniform1i(uMapping, mapping);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, colorMap);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, detailMap || colorMap);

  gl.bindVertexArray(mesh.vao);

  gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
}
// Render loop
let lastTime = 0;

function render(time) {
  const t = time / 1000;
  if (spinning) spinAngle += t - lastTime;
  lastTime = t;
  animateEye(t);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(program);

  const view = multiply(translate(camX, camY, camZ),multiply(rotateY(dragRotY), rotateX(dragRotX)));

  gl.uniformMatrix4fv(uProjection, false, projection);

  
  const lightPositions = [];
  const lightDirections = [];
  const lightColors = [];

  for (const light of lights) {
    const p = transformPoint(view, light.position);
    const target = transformPoint(view, light.target);

    const delta = target.map((v, i) => v - p[i]);
    const length = Math.hypot(...delta);

    lightPositions.push(...p);
    lightDirections.push(...delta.map(v => v / length));

    lightColors.push(
      ...(light.enabled ? light.color : [0, 0, 0])
    );
  }

  gl.uniform3fv(uLightPos, lightPositions);
  gl.uniform3fv(uLightDir, lightDirections);
  gl.uniform3fv(uLightColor, lightColors);

  //Three pedestals with simple gold plaques.
  for (const x of exhibitX) {
    const base = multiply(translate(x, -1.02, 0),scale(0.70, 0.28, 0.65));

    draw(cubeMesh, multiply(view, base),pedestalTexture, pedestalTexture, COLOR_MAPPING);

    const plaque = multiply(translate(x, -1.0, 0.665),scale(0.32, 0.10, 0.02));

    draw(cubeMesh, multiply(view, plaque),plaqueTexture, plaqueTexture, COLOR_MAPPING);
  }

  // rotation slider/button controls the artifacts.
  const axisRotation = ROTATE[axisSelect.value](sliderAngle * Math.PI / 180 + spinAngle);

  const orb = multiply(translate(exhibitX[0],0.02 + 0.04 * Math.sin(t),0),multiply(axisRotation,scale(0.69, 0.69, 0.69)));
  draw(sphereMesh, multiply(view, orb),eyeTexture, eyeTexture, COLOR_MAPPING);

  const halo = multiply(translate(exhibitX[1],0.04 + 0.04 * Math.sin(t * 0.8),0),multiply(axisRotation,multiply(rotateY(t * 0.25),multiply(rotateX(Math.PI / 2),scale(0.76, 0.76, 0.76)))));
  draw(torusMesh, multiply(view, halo),haloTexture, haloNormal, NORMAL_MAPPING);
  
  const fang = multiply(translate(exhibitX[2], 0.15, 0),multiply(axisRotation,multiply(rotateZ(Math.PI), scale(0.65, 0.87, 0.65))));


  draw(coneMesh, multiply(view, fang),fangTexture, fangHeight, BUMP_MAPPING);
  requestAnimationFrame(render);
}

requestAnimationFrame(render);
