# 금속 반사 버튼 기술 설계서 v2.0
## Metal Reflective Button Technical Design Document

---

## 1. 개요 (Overview)

웹캠 기반 실시간 금속 반사 효과를 구현하는 캡슐형 버튼의 기술 설계서입니다.
사용자의 위치에 따라 금속 표면의 반사가 동적으로 변화하는 효과를 구현합니다.

### 1.1 목표
- 구리(Copper), 알루미늄(Aluminum), 스틸(Steel) 3가지 금속 버튼 구현
- 웹캠 영상을 환경맵으로 활용한 실시간 Screen-space Reflection
- 사용자 위치 트래킹 기반 동적 하이라이트 이동
- 400px 고정 크기 캡슐 버튼

### 1.2 기술 스택 (확정)

| 항목 | 선택 | 비고 |
|------|------|------|
| 렌더링 | **WebGL2** | Vanilla JS, 프레임워크 없음 |
| 카메라 | **getUserMedia** | 640x480, 30FPS |
| 셰이더 | **GLSL** | vertex + fragment |
| 트래킹 | **FaceDetector API** | 브라우저 내장 (Chrome) |
| 조명 모델 | **Fresnel Only** | Cook-Torrance 미사용 |

---

## 2. 금속학적 기초 (Metallurgical Foundation)

### 2.1 금속의 광학적 특성

금속의 색상은 **복소 굴절률**에 의해 결정됩니다:

```
ñ = n + ik
```
- **n**: 굴절률 (빛의 속도 변화)
- **k**: 소광계수 (빛의 흡수율)

### 2.2 대상 금속의 광학 상수

| 금속 | n | k | F₀ (RGB) | 특성 색상 |
|------|---|---|----------|-----------|
| **구리** | 0.27 | 2.58 | (0.955, 0.638, 0.538) | 적황색 |
| **알루미늄** | 1.37 | 7.62 | (0.913, 0.922, 0.924) | 은백색 |
| **스틸** | 2.75 | 3.79 | (0.562, 0.565, 0.578) | 회백색 |

### 2.3 F₀ 값의 의미

**F₀ (Fresnel Reflectance at Normal Incidence)**:
- 빛이 표면에 수직으로 입사할 때의 반사율
- 금속의 고유한 색상을 결정하는 핵심 값
- RGB 채널별로 다른 값 → 금속 고유색 발현

```
구리: R 높음, G/B 낮음 → 붉은 빛
알루미늄: R≈G≈B (높음) → 은백색
스틸: R≈G≈B (중간) → 회색
```

---

## 3. 광학 모델 (Fresnel Only)

### 3.1 설계 결정

전체 Cook-Torrance BRDF 대신 **Fresnel 항만 사용**:

| 요소 | 사용 여부 | 이유 |
|------|-----------|------|
| **F (Fresnel)** | ✅ 사용 | 금속 반사의 핵심. 시야각별 반사율 변화 |
| D (Distribution) | ❌ 미사용 | 광택 금속(roughness<0.2)에서 영향 미미 |
| G (Geometry) | ❌ 미사용 | 위와 동일 |

### 3.2 Fresnel-Schlick 근사

```glsl
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}
```

### 3.3 시야각에 따른 반사율 변화

```
시야각 θ     반사율 변화
─────────────────────────
  0° (정면)   F₀ (금속 고유색)
 45°         F₀ + 약간 밝아짐
 75°         거의 흰색에 가까움
 90° (측면)   1.0 (완전 반사)
```

이 효과로 캡슐 버튼의 **가장자리가 더 밝게** 보입니다.

---

## 4. 위치 트래킹 시스템

### 4.1 목적

사용자의 위치(얼굴/물체)를 추적하여 **하이라이트 위치를 동적으로 이동**:

```
    사용자 위치
        👤 ←─ 왼쪽으로 이동
       ╱
      ╱
┌────────────────┐
│ ╭────────────╮ │
│ │    ●───→   │ │  ← 하이라이트가 오른쪽으로 이동
│ ╰────────────╯ │
└────────────────┘
```

### 4.2 FaceDetector API (1순위)

```javascript
// Chrome 내장 API - 별도 라이브러리 불필요
const detector = new FaceDetector({ fastMode: true });

async function detectPosition(videoFrame) {
    try {
        const faces = await detector.detect(videoFrame);
        if (faces.length > 0) {
            const box = faces[0].boundingBox;
            return {
                x: (box.x + box.width / 2) / videoFrame.width,   // 0~1
                y: (box.y + box.height / 2) / videoFrame.height  // 0~1
            };
        }
    } catch (e) {
        // API 미지원 시 fallback
    }
    return { x: 0.5, y: 0.5 }; // 기본값: 중앙
}
```

### 4.3 Fallback 전략

| 우선순위 | 방법 | 조건 |
|----------|------|------|
| 1 | FaceDetector API | Chrome 지원 |
| 2 | 화면 중앙 고정 | API 미지원 시 |

### 4.4 위치 → 광원 방향 변환

```javascript
// 트래킹 위치를 광원 방향 벡터로 변환
function positionToLightDir(pos) {
    return {
        x: (pos.x - 0.5) * 2.0,  // -1 ~ 1
        y: (pos.y - 0.5) * 2.0,  // -1 ~ 1
        z: -1.0                   // 화면 앞쪽
    };
}
```

---

## 5. Screen-Space Reflection

### 5.1 원리

웹캠 영상을 **2D 텍스처로 직접 샘플링** (Cubemap 미사용):

```
반사 벡터 R = reflect(-V, N)
    ↓
R.xy를 UV 좌표로 변환
    ↓
웹캠 텍스처에서 샘플링
```

### 5.2 GLSL 구현

```glsl
// 반사 벡터 계산
vec3 V = vec3(0.0, 0.0, 1.0);  // 시야 방향 (화면 정면)
vec3 R = reflect(-V, N);       // 반사 방향

// 반사 벡터 → UV 좌표
vec2 envUV = R.xy * 0.5 + 0.5;

// 화면 밖 처리
envUV = clamp(envUV, 0.0, 1.0);

// 텍스처 샘플링 (mipmap으로 roughness 표현)
float mipLevel = roughness * float(maxMipLevels);
vec3 envColor = textureLod(cameraTexture, envUV, mipLevel).rgb;
```

### 5.3 Roughness와 Mipmap

```
roughness = 0.0  →  mip 0 (선명한 반사)
roughness = 0.5  →  mip 4 (흐릿한 반사)
roughness = 1.0  →  mip 8 (완전 블러)
```

---

## 6. SDF 기반 캡슐 지오메트리

### 6.1 Signed Distance Function

Fragment shader에서 **분석적으로(analytically)** 캡슐 형태와 법선을 계산:

```glsl
// 캡슐 SDF (Signed Distance Function)
float sdCapsule(vec2 p, float r, float h) {
    p.x = abs(p.x) - h;  // 중앙 직선 영역 제외
    return length(max(p, 0.0)) + min(max(p.x, p.y), 0.0) - r;
}
```

### 6.2 법선 벡터 계산

```glsl
// SDF 그래디언트로 법선 계산
vec3 calcNormal(vec2 p, float r, float h) {
    vec2 e = vec2(0.001, 0.0);
    float d = sdCapsule(p, r, h);
    vec2 grad = vec2(
        sdCapsule(p + e.xy, r, h) - sdCapsule(p - e.xy, r, h),
        sdCapsule(p + e.yx, r, h) - sdCapsule(p - e.yx, r, h)
    );
    // 3D 법선으로 확장 (z = 곡면 깊이감)
    return normalize(vec3(grad, 0.5));
}
```

### 6.3 캡슐 영역 판정

```glsl
float sdf = sdCapsule(localPos, radius, halfWidth);
if (sdf > 0.0) {
    discard;  // 캡슐 외부는 그리지 않음
}
```

---

## 7. 시스템 아키텍처

```
┌──────────────────────────────────────────────────────────────┐
│                         main.js                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐      ┌──────────────────┐              │
│  │  CameraService  │      │  PositionTracker │              │
│  │                 │      │                  │              │
│  │  - stream       │─────→│  - FaceDetector  │              │
│  │  - videoElement │      │  - position {x,y}│              │
│  └────────┬────────┘      └────────┬─────────┘              │
│           │                        │                         │
│           ▼                        ▼                         │
│  ┌─────────────────────────────────────────────┐            │
│  │              GLContext                       │            │
│  │                                              │            │
│  │  - WebGL2 context                           │            │
│  │  - Shader compilation                       │            │
│  │  - Texture management                       │            │
│  └────────────────────┬────────────────────────┘            │
│                       │                                      │
│                       ▼                                      │
│  ┌─────────────────────────────────────────────┐            │
│  │           CapsuleRenderer (×3)              │            │
│  │                                              │            │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐       │            │
│  │  │ COPPER  │ │ALUMINUM │ │  STEEL  │       │            │
│  │  │         │ │         │ │         │       │            │
│  │  │ F₀=RGB  │ │ F₀=RGB  │ │ F₀=RGB  │       │            │
│  │  └─────────┘ └─────────┘ └─────────┘       │            │
│  └─────────────────────────────────────────────┘            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. 파일 구조

```
Metal-Button-Design/
├── index.html                 # 진입점, 3개 버튼 배치
├── main.js                    # 앱 초기화 및 루프
├── modules/
│   ├── CameraService.js       # 웹캠 스트림 관리
│   ├── PositionTracker.js     # FaceDetector 기반 위치 추적
│   ├── GLContext.js           # WebGL2 컨텍스트 관리
│   ├── CapsuleRenderer.js     # 캡슐 버튼 렌더링
│   └── MetalMaterial.js       # 금속별 F₀, roughness 정의
├── shaders/
│   ├── capsule.vert           # 버텍스 셰이더
│   └── capsule.frag           # 프래그먼트 셰이더
└── docs/
    └── TECHNICAL_DESIGN.md    # 본 문서
```

---

## 9. 금속 머티리얼 정의

### 9.1 구리 (Copper)

```javascript
export const COPPER = {
    name: 'Copper',
    F0: [0.955, 0.638, 0.538],  // 적황색 반사
    roughness: 0.1,
    // fallback gradient
    gradient: {
        highlight: '#FFD4A8',
        base: '#B87333',
        shadow: '#7A4A1D'
    }
};
```

### 9.2 알루미늄 (Aluminum)

```javascript
export const ALUMINUM = {
    name: 'Aluminum',
    F0: [0.913, 0.922, 0.924],  // 은백색 반사
    roughness: 0.15,
    gradient: {
        highlight: '#FFFFFF',
        base: '#D4D4D4',
        shadow: '#A0A0A0'
    }
};
```

### 9.3 스틸 (Steel)

```javascript
export const STEEL = {
    name: 'Steel',
    F0: [0.562, 0.565, 0.578],  // 회백색 반사
    roughness: 0.2,
    gradient: {
        highlight: '#F8F8F8',
        base: '#8F8F8F',
        shadow: '#4A4A4A'
    }
};
```

---

## 10. 셰이더 설계

### 10.1 Vertex Shader (capsule.vert)

```glsl
#version 300 es
in vec2 aPosition;
out vec2 vLocalPos;

void main() {
    vLocalPos = aPosition;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
```

### 10.2 Fragment Shader (capsule.frag) - 핵심 로직

```glsl
#version 300 es
precision highp float;

in vec2 vLocalPos;
out vec4 fragColor;

uniform sampler2D uCameraTexture;
uniform vec3 uF0;              // 금속별 Fresnel F0
uniform float uRoughness;
uniform vec2 uLightPos;        // 트래킹된 위치 (-1~1)
uniform float uMaxMipLevel;

// Fresnel-Schlick
vec3 fresnel(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

// 캡슐 SDF
float sdCapsule(vec2 p, float r, float h) {
    p.x = abs(p.x) - h;
    return length(max(p, 0.0)) + min(max(p.x, p.y), 0.0) - r;
}

void main() {
    // 1. 캡슐 영역 체크
    float sdf = sdCapsule(vLocalPos, 0.15, 0.35);
    if (sdf > 0.0) discard;

    // 2. 법선 계산
    vec3 N = calcNormal(vLocalPos);

    // 3. 시야/광원 방향
    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 L = normalize(vec3(uLightPos, -1.0));

    // 4. 반사 벡터 & 환경맵 샘플링
    vec3 R = reflect(-V, N);
    vec2 envUV = clamp(R.xy * 0.5 + 0.5, 0.0, 1.0);
    float mip = uRoughness * uMaxMipLevel;
    vec3 envColor = textureLod(uCameraTexture, envUV, mip).rgb;

    // 5. Fresnel 적용
    float NdotV = max(dot(N, V), 0.0);
    vec3 F = fresnel(NdotV, uF0);

    // 6. 최종 색상
    vec3 color = envColor * F;

    // 7. 하이라이트 추가 (광원 위치 기반)
    vec3 H = normalize(V + L);
    float spec = pow(max(dot(N, H), 0.0), 64.0);
    color += spec * F;

    fragColor = vec4(color, 1.0);
}
```

---

## 11. 성능 제약

| 항목 | 제한 |
|------|------|
| Draw calls | ≤ 3 (버튼당 1) |
| 카메라 텍스처 업로드 | 1회/프레임 |
| 목표 FPS | 30 |
| 카메라 해상도 | 640×480 |
| 트래킹 주기 | 100ms (10 FPS) |

---

## 12. 권한 및 Fallback

### 12.1 카메라 권한 요청

```javascript
async function requestCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
        });
        return stream;
    } catch (e) {
        return null;  // fallback 모드
    }
}
```

### 12.2 Fallback 동작

카메라 권한 거부 시:
- 웹캠 텍스처 대신 **정적 그라데이션** 사용
- 트래킹 없이 **고정 하이라이트**
- 동일한 셰이더, 입력만 변경

### 12.3 프라이버시 안내

```
"이 버튼은 시각 효과를 위해 카메라를 사용합니다.
 영상은 저장되거나 전송되지 않습니다."
```

---

## 13. 구현 단계

| 단계 | 내용 | 산출물 |
|------|------|--------|
| **1** | WebGL2 컨텍스트 + quad 렌더링 | GLContext.js |
| **2** | SDF 캡슐 셰이더 (정적 색상) | shaders/, CapsuleRenderer.js |
| **3** | 웹캠 연결 + 텍스처 업로드 | CameraService.js |
| **4** | Screen-space reflection | capsule.frag 업데이트 |
| **5** | FaceDetector 트래킹 | PositionTracker.js |
| **6** | 3개 금속 타입 | MetalMaterial.js, index.html |
| **7** | Fallback 처리 | 권한 거부 시 정적 모드 |

---

## 14. 참고 문헌

1. **Physically Based Rendering** - Pharr, Jakob, Humphreys
2. **Real-Time Rendering, 4th Ed** - Akenine-Möller et al.
3. **An Inexpensive BRDF Model for Physically-based Rendering** - Schlick, 1994
4. **Optical Properties of Metals** - CRC Handbook

---

*문서 버전: 2.0*
*최종 수정: 2024*
*확정 스펙 기반 전면 개정*
