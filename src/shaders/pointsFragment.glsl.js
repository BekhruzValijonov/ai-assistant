// Неоновый glow для точек в стиле шейдера с Shadertoy
export const pointsFragmentShader = /* glsl */ `
  uniform float u_red;
  uniform float u_green;
  uniform float u_blue;
  uniform float u_time;
  uniform float u_depthFade; // коэффициент влияния глубины на прозрачность

  varying float v_viewZ;
  varying float v_facing;

  #define M_PI 3.1415926535897932384626433832795
  #define M_TWO_PI (2.0 * M_PI)

  float rand(vec2 n) {
    return fract(sin(dot(n, vec2(12.9898, 12.1414))) * 83758.5453);
  }

  float noise(vec2 n) {
    const vec2 d = vec2(0.0, 1.0);
    vec2 b = floor(n);
    vec2 f = smoothstep(vec2(0.0), vec2(1.0), fract(n));
    return mix(
      mix(rand(b), rand(b + d.yx), f.x),
      mix(rand(b + d.xy), rand(b + d.yy), f.x),
      f.y
    );
  }

  vec3 ramp(float t) {
    return t <= 0.5
      ? vec3(1.0 - t * 1.4, 0.2, 1.05) / max(t, 0.001)
      : vec3(0.3 * (1.0 - t) * 2.0, 0.2, 1.05) / max(t, 0.001);
  }

  vec2 polarMap(vec2 uv, float shift, float inner) {
    uv = vec2(0.5) - uv;
    float px = 1.0 - fract(atan(uv.y, uv.x) / 6.28 + 0.25) + shift;
    float py = (sqrt(uv.x * uv.x + uv.y * uv.y) * (1.0 + inner * 2.0) - inner) * 2.0;
    return vec2(px, py);
  }

  float fire(vec2 n) {
    return noise(n) + noise(n * 2.1) * 0.6 + noise(n * 5.4) * 0.42;
  }

  float shade(vec2 uv, float t) {
    uv.x += uv.y < 0.5 ? 23.0 + t * 0.035 : -11.0 + t * 0.03;
    uv.y = abs(uv.y - 0.5);
    uv.x *= 35.0;

    float q = fire(uv - t * 0.013) / 2.0;
    vec2 r = vec2(
      fire(uv + q / 2.0 + t - uv.x - uv.y),
      fire(uv + q - t)
    );

    return pow((r.y + r.y) * max(0.0, uv.y) + 0.1, 4.0);
  }

  vec3 colorRamp(float grad) {
    grad = sqrt(grad);
    vec3 color = vec3(1.0 / (pow(vec3(0.5, 0.0, 0.1) + 2.61, vec3(2.0))));
    vec3 color2 = color;
    color = ramp(grad);
    float m2 = 1.15;
    color /= (m2 + max(vec3(0.0), color));
    return color;
  }

  void main() {
    // Плавное затухание у границы сферы: нет резкого вкл/выкл → нет мерцания на силуэте
    // При v_facing ≈ 0 точка на границе; smoothstep даёт мягкий переход вместо discard
    float facingAlpha = smoothstep(-0.12, 0.2, v_facing);
    if (facingAlpha <= 0.0) discard;

    // Мягкая маска круга — чуть более размытый край для снижения резкости
    float dist = length(gl_PointCoord - 0.5) * 2.0;
    float edgeSoft = 1.0 - smoothstep(0.45, 1.12, dist);
    if (edgeSoft <= 0.0) discard;

    // Используем fire/shade из оригинального шейдера как источник яркости,
    // но сам glow делаем простым и очень заметным по радиусу.
    vec2 fragCoord = gl_PointCoord;
    float t = u_time;

    // "Плоские" координаты для fire-шумов
    vec2 uvFire = fragCoord * 4.0;
    float fireVal = fire(uvFire + t * 0.25);
    fireVal = clamp(fireVal, 0.0, 1.0);

    // Радиальный профиль: мягкое ядро + плавный ореол (чуть мягче)
    float r = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.0, 0.55, 0.5 - r);
    float halo = exp(-2.4 * r * r);

    // Мягкая яркость — комфортно для глаз
    float intensity = (core * 1.75 + halo * 1.85) * (0.5 + fireVal * 1.25);
    intensity = min(intensity, 1.0);

    vec3 baseColor = vec3(u_red, u_green, u_blue);
    vec3 col = baseColor * intensity;

    // Глубинное затухание: дальние точки становятся более прозрачными
    float depthFactor = clamp(v_viewZ * 0.25, 0.0, 1.0);
    float depthFade = mix(1.0, 1.0 - u_depthFade, depthFactor);

    float alpha = clamp(core * 0.85 + halo * 0.6, 0.7, 1.0);
    alpha *= depthFade * edgeSoft * facingAlpha;

    gl_FragColor = vec4(col, alpha);
  }
`
