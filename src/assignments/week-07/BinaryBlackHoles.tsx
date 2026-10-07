import { useEffect, useRef } from "react";

const vertexSource = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentSource = `
precision highp float;
uniform vec2 resolution;
uniform float phase;

vec4 hole(vec2 p, vec2 center, float size, vec3 color) {
  vec2 uv = (p - center) / size;
  float r = length(uv / vec2(1.0, 0.25));
  float angle = atan(uv.y / 0.25, uv.x + 0.00001);
  float disk = smoothstep(1.05, 1.17, r) * (1.0 - smoothstep(2.65, 3.1, r));
  disk *= exp(-max(r - 1.05, 0.0) * 1.1);
  float texture = 0.78 + 0.15 * sin(34.0 * r + 5.0 * angle - phase * 4.0);
  texture += 0.07 * sin(65.0 * r - 9.0 * angle + phase * 3.0);
  disk *= texture * (0.8 - 0.28 * uv.x / (1.0 + abs(uv.x)));
  float arcRadius = length(uv / vec2(1.12, 0.96));
  float arc = exp(-pow((arcRadius - 1.18) / 0.16, 2.0));
  arc *= smoothstep(-0.08, 0.08, uv.y);
  arc *= 0.8 + 0.18 * sin(48.0 * arcRadius - phase * 3.0);
  float distance = length(uv);
  float ring = exp(-pow((distance - 0.96) / 0.035, 2.0)) * 0.5;
  float intensity = disk * 2.1 + arc * 1.25 + ring;
  float silhouette = 1.0 - smoothstep(0.88, 0.94, distance);
  float front = exp(-pow((uv.y + 0.24) / 0.065, 2.0));
  front *= exp(-pow(abs(uv.x / 1.4), 6.0)) * 0.65;
  float halo = exp(-pow((r - 1.65) / 0.8, 2.0)) * 0.10;
  halo += exp(-pow((arcRadius - 1.18) / 0.38, 2.0))
    * smoothstep(-0.05, 0.2, uv.y) * 0.08;
  vec3 rgb = intensity * color + max(intensity - 1.0, 0.0) * 0.35;
  rgb = (rgb + color * halo) * (1.0 - silhouette) + front * color;
  float alpha = max(silhouette, 1.0 - exp(-(intensity + front + halo) * 3.5));
  vec3 mapped = 1.0 - exp(-rgb * 1.7);
  return vec4(mapped * alpha, alpha);
}

void main() {
  vec2 p = (gl_FragCoord.xy - resolution * 0.5) / resolution.y * 360.0;
  vec2 orbit = vec2(cos(phase) * 139.0, sin(phase) * 22.0);
  vec2 orangeCenter = -orbit * 0.7;
  vec2 blueCenter = orbit;
  vec3 orange = vec3(1.0, 0.28, 0.055);
  vec3 blue = vec3(0.06, 0.48, 1.0);
  bool blueInFront = sin(phase) > 0.0;
  vec2 frontCenter = blueInFront ? blueCenter : orangeCenter;
  vec2 rearCenter = blueInFront ? orangeCenter : blueCenter;
  float frontSize = blueInFront ? 21.0 : 28.0;
  float rearSize = blueInFront ? 28.0 : 21.0;
  vec3 frontColor = blueInFront ? blue : orange;
  vec3 rearColor = blueInFront ? orange : blue;
  vec2 delta = p - frontCenter;
  float r2 = dot(delta, delta);
  float lens = pow(frontSize * 1.65, 2.0) / (r2 + pow(frontSize * 0.35, 2.0));
  lens *= exp(-r2 / pow(frontSize * 6.0, 2.0));
  vec4 rear = hole(p - delta * lens, rearCenter, rearSize, rearColor);
  vec4 front = hole(p, frontCenter, frontSize, frontColor);
  vec3 scene = vec3(1.0) * (1.0 - rear.a) + rear.rgb;
  scene = scene * (1.0 - front.a) + front.rgb;
  gl_FragColor = vec4(scene, 1.0);
}
`;

export default function BinaryBlackHoles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false });
    if (!gl) return;

    let frameId = 0;
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let shaders: WebGLShader[] = [];
    let lastTime = 0;
    let phase = 0.3;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.round(bounds.width * ratio));
      canvas.height = Math.max(1, Math.round(bounds.height * ratio));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const release = () => {
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      shaders.forEach(shader => gl.deleteShader(shader));
      shaders = [];
      buffer = null;
      program = null;
    };
    const start = () => {
      cancelAnimationFrame(frameId);
      release();
      try {
        const compile = (type: number, source: string) => {
          const shader = gl.createShader(type);
          if (!shader) throw new Error("Unable to create shader");
          shaders.push(shader);
          gl.shaderSource(shader, source);
          gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader) || "Shader compilation failed");
          }
          return shader;
        };
        program = gl.createProgram();
        if (!program) throw new Error("Unable to create renderer");
        gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          throw new Error(gl.getProgramInfoLog(program) || "Renderer linking failed");
        }
        gl.useProgram(program);
        buffer = gl.createBuffer();
        if (!buffer) throw new Error("Unable to create buffer");
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, "position");
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        const resolutionLocation = gl.getUniformLocation(program, "resolution");
        const phaseLocation = gl.getUniformLocation(program, "phase");
        resize();
        lastTime = 0;
        const draw = (time: number) => {
          const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
          lastTime = time;
          if (!motion.matches && !document.hidden) phase += delta * 0.55;
          gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
          gl.uniform1f(phaseLocation, phase);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          frameId = requestAnimationFrame(draw);
        };
        frameId = requestAnimationFrame(draw);
      } catch (error) {
        console.error(error);
        release();
        gl.clearColor(1, 1, 1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    };
    const onLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(frameId);
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", start);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    start();

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", start);
      release();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Two animated black holes on a white background"
      style={{ display: "block", width: "100%", aspectRatio: "16 / 9", background: "#fff" }}
    />
  );
}
