#version 300 es
precision highp float;

in vec2 vLocalPos;
out vec4 fragColor;

// 유니폼
uniform sampler2D uCameraTexture;
uniform vec3 uF0;                // 금속별 Fresnel F0
uniform float uRoughness;        // 표면 거칠기
uniform vec2 uLightPos;          // 트래킹된 광원 위치 (-1 ~ 1)
uniform float uMaxMipLevel;      // 최대 mipmap 레벨
uniform bool uHasCamera;         // 카메라 활성화 여부
uniform float uAspectRatio;      // 캔버스 종횡비 (width/height)

// 캡슐 SDF 파라미터
const float CAPSULE_RADIUS = 0.4;    // 캡슐 반원 반지름 (높이의 절반에 해당)
const float CAPSULE_HALF_WIDTH = 0.5; // 중앙 직선 영역의 절반 너비

/**
 * 캡슐 SDF (Signed Distance Function)
 * 수평 캡슐: 양 끝이 반원인 알약 형태
 */
float sdCapsule(vec2 p, float r, float h) {
    p.x = abs(p.x) - h;
    return length(max(p, 0.0)) + min(max(p.x, p.y), 0.0) - r;
}

/**
 * SDF 그래디언트로 3D 법선 계산
 * 캡슐 표면을 3D 돔처럼 취급
 */
vec3 calcNormal(vec2 p, float r, float h) {
    // 2D 그래디언트 계산
    vec2 e = vec2(0.001, 0.0);
    vec2 grad = vec2(
        sdCapsule(p + e.xy, r, h) - sdCapsule(p - e.xy, r, h),
        sdCapsule(p + e.yx, r, h) - sdCapsule(p - e.yx, r, h)
    );

    // SDF 값으로 깊이감 계산 (표면 안쪽으로 갈수록 z가 커짐)
    float sdf = sdCapsule(p, r, h);
    float depth = sqrt(max(0.0, r * r - sdf * sdf)) / r;

    // 3D 법선으로 확장
    return normalize(vec3(-grad * 2.0, depth + 0.3));
}

/**
 * Fresnel-Schlick 근사
 */
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

void main() {
    // 종횡비 보정된 좌표
    vec2 p = vLocalPos;
    p.x *= uAspectRatio;

    // 캡슐 SDF 계산
    float sdf = sdCapsule(p, CAPSULE_RADIUS, CAPSULE_HALF_WIDTH * uAspectRatio);

    // 캡슐 외부는 투명 처리
    if (sdf > 0.0) {
        discard;
    }

    // 부드러운 엣지를 위한 안티앨리어싱
    float edgeSoftness = fwidth(sdf) * 1.5;
    float alpha = smoothstep(0.0, -edgeSoftness, sdf);

    // 법선 계산
    vec3 N = calcNormal(p, CAPSULE_RADIUS, CAPSULE_HALF_WIDTH * uAspectRatio);

    // 시야 방향 (화면 정면)
    vec3 V = vec3(0.0, 0.0, 1.0);

    // 광원 방향 (트래킹 위치 기반)
    vec3 L = normalize(vec3(-uLightPos, 1.0));

    // 반사 벡터
    vec3 R = reflect(-V, N);

    // Fresnel 계산
    float NdotV = max(dot(N, V), 0.0);
    vec3 F = fresnelSchlick(NdotV, uF0);

    vec3 color;

    if (uHasCamera) {
        // 환경맵 UV 좌표 (반사 벡터 기반)
        vec2 envUV = R.xy * 0.5 + 0.5;
        envUV = clamp(envUV, 0.0, 1.0);

        // mipmap 레벨로 roughness 표현
        float mip = uRoughness * uMaxMipLevel;
        vec3 envColor = textureLod(uCameraTexture, envUV, mip).rgb;

        // 환경 반사에 Fresnel 적용
        color = envColor * F;
    } else {
        // Fallback: 정적 금속 색상
        // 법선 기반 그라데이션
        float gradient = N.y * 0.5 + 0.5;
        vec3 baseColor = uF0;

        // 상단 밝게, 하단 어둡게
        color = mix(baseColor * 0.4, baseColor * 1.2, gradient);
        color *= F;
    }

    // 스페큘러 하이라이트 (광원 위치 기반)
    vec3 H = normalize(V + L);
    float NdotH = max(dot(N, H), 0.0);
    float spec = pow(NdotH, 64.0);
    color += spec * F * 0.5;

    // 림 라이트 (가장자리 밝게)
    float rim = 1.0 - NdotV;
    rim = pow(rim, 3.0);
    color += rim * F * 0.2;

    // 감마 보정
    color = pow(color, vec3(1.0 / 2.2));

    fragColor = vec4(color, alpha);
}
