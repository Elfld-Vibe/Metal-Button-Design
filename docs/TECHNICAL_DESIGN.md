# 금속 반사 버튼 기술 설계서
## Metal Reflective Button Technical Design Document

---

## 1. 개요 (Overview)

본 문서는 웹캠 기반 실시간 금속 반사 효과를 구현하는 캡슐형 버튼의 기술적 설계를 다룹니다.
금속학(Metallurgy)과 광학(Optics) 원리를 기반으로 물리적으로 정확한(Physically Based) 렌더링을 목표로 합니다.

### 1.1 목표
- 구리(Copper), 스틸(Steel), 알루미늄(Aluminum)의 광학적 특성을 정확히 재현
- 웹캠 영상을 환경맵으로 활용한 실시간 반사 효과
- 얼굴 트래킹 기반 동적 조명 시뮬레이션

---

## 2. 금속학적 기초 (Metallurgical Foundation)

### 2.1 금속의 광학적 특성

금속의 색상과 반사 특성은 **복소 굴절률(Complex Refractive Index)**에 의해 결정됩니다:

```
ñ = n + ik
```

- **n (굴절률, Refractive Index)**: 빛의 속도 변화
- **k (소광계수, Extinction Coefficient)**: 빛의 흡수율

### 2.2 대상 금속의 광학 상수 (@ 550nm 가시광선)

| 금속 | n | k | 반사율(R) | 특성 색상 |
|------|-----|-----|-----------|-----------|
| **구리 (Copper)** | 0.27 | 2.58 | 0.95 | 적황색 (Red-Orange) |
| **알루미늄 (Aluminum)** | 1.37 | 7.62 | 0.91 | 은백색 (Silver-White) |
| **스테인리스 스틸 (Stainless Steel)** | 2.75 | 3.79 | 0.58 | 회백색 (Gray) |

### 2.3 분광 반사율 데이터 (Spectral Reflectance)

각 금속은 파장별로 다른 반사율을 가지며, 이것이 고유한 색상을 만듭니다:

```
구리 (Copper):
├── 400nm (보라): R = 0.35 (낮음 - 흡수)
├── 500nm (청록): R = 0.42 (낮음 - 흡수)
├── 600nm (주황): R = 0.85 (높음 - 반사) ← 구리색의 원인
└── 700nm (적색): R = 0.97 (매우 높음)

알루미늄 (Aluminum):
├── 400nm: R = 0.92
├── 500nm: R = 0.91
├── 600nm: R = 0.90
└── 700nm: R = 0.89
→ 전 파장 균일한 반사 = 은백색

스테인리스 스틸 (Stainless Steel):
├── 400nm: R = 0.55
├── 500nm: R = 0.58
├── 600nm: R = 0.60
└── 700nm: R = 0.62
→ 약간의 황색 편향, 전반적 회색
```

---

## 3. 광학적 모델링 (Optical Modeling)

### 3.1 BRDF (양방향 반사 분포 함수)

금속 표면의 빛 반사를 시뮬레이션하기 위해 **Cook-Torrance BRDF** 모델을 사용합니다:

```
f_r = (D * F * G) / (4 * (N·V) * (N·L))
```

구성 요소:
- **D (Normal Distribution Function)**: 미세면 분포 - GGX/Trowbridge-Reitz 사용
- **F (Fresnel Term)**: 시야각에 따른 반사율 변화
- **G (Geometry Function)**: 미세면 그림자/마스킹

### 3.2 Fresnel 방정식 (Schlick 근사)

```javascript
F(θ) = F₀ + (1 - F₀)(1 - cos(θ))⁵
```

- **F₀**: 수직 입사 시 반사율 (금속별 고유값)
- **θ**: 시야각 (View Angle)

| 금속 | F₀ (RGB) |
|------|----------|
| 구리 | (0.955, 0.638, 0.538) |
| 알루미늄 | (0.913, 0.922, 0.924) |
| 스틸 | (0.562, 0.565, 0.578) |

### 3.3 GGX 법선 분포 함수

```javascript
D(h) = α² / (π * ((N·H)² * (α² - 1) + 1)²)
```

- **α (Roughness)**: 표면 거칠기 (0 = 거울, 1 = 무광)
  - 광택 금속: α = 0.05 ~ 0.15
  - 브러시드 메탈: α = 0.3 ~ 0.5

---

## 4. 얼굴 트래킹 기반 조명 시뮬레이션

### 4.1 원리

사용자의 얼굴 위치를 **가상 광원**으로 해석합니다:

```
┌─────────────────────────────────────┐
│           웹캠 화면                 │
│                                     │
│      👤 ← 얼굴 = 광원 위치          │
│       ↓                             │
│    ┌─────────┐                      │
│    │ 버 튼  │ ← 반사면              │
│    └─────────┘                      │
│                                     │
└─────────────────────────────────────┘
```

### 4.2 광원 벡터 계산

```javascript
// 얼굴 중심 좌표를 광원 방향으로 변환
lightDirection = normalize(vec3(
    (faceX - 0.5) * 2.0,  // X: -1 ~ 1
    (faceY - 0.5) * 2.0,  // Y: -1 ~ 1
    -1.0                   // Z: 화면 앞쪽
));
```

### 4.3 하이라이트 위치 계산

```javascript
// 반사 법칙: 입사각 = 반사각
reflectDir = reflect(-lightDir, normal);
specularIntensity = pow(max(dot(reflectDir, viewDir), 0.0), shininess);
```

---

## 5. 환경맵 반사 (Environment Mapping)

### 5.1 웹캠을 환경맵으로 사용

웹캠 영상을 실시간 **큐브맵(Cubemap)** 또는 **등장방형 맵(Equirectangular Map)**으로 변환하여
금속 표면에 반사시킵니다.

```
┌──────────────────────────────────────────────┐
│                 웹캠 영상                     │
│    ┌────────────────────────────────┐        │
│    │  실제 환경 (사용자, 방, 조명)   │        │
│    └────────────────────────────────┘        │
│                    ↓                         │
│           UV 좌표 매핑                        │
│                    ↓                         │
│    ┌────────────────────────────────┐        │
│    │      금속 버튼 표면에 반사       │        │
│    └────────────────────────────────┘        │
└──────────────────────────────────────────────┘
```

### 5.2 반사 벡터 계산

```javascript
// 뷰 방향과 법선으로 반사 방향 계산
vec3 I = normalize(position - cameraPosition);
vec3 R = reflect(I, normal);

// 반사 벡터로 환경맵 샘플링
vec2 envUV = vec2(
    0.5 + atan(R.z, R.x) / (2.0 * PI),
    0.5 - asin(R.y) / PI
);
vec4 envColor = texture2D(webcamTexture, envUV);
```

---

## 6. 캡슐 형태 버튼 지오메트리

### 6.1 형태 정의

**스타디움(Stadium)** 또는 **디스코렉탱글(Discorectangle)** 형태:

```
    ╭──────────────────────╮
    │                      │
    ╰──────────────────────╯

    r = 높이/2
    w = 전체 너비
```

### 6.2 법선 벡터 분포

캡슐 형태의 표면 법선은 곡률에 따라 연속적으로 변화:

```
중앙 영역:     법선 = (0, 0, 1) → 정면 반사
좌측 곡면:     법선 = (-cos(θ), 0, sin(θ)) → 좌측 반사
우측 곡면:     법선 = (cos(θ), 0, sin(θ)) → 우측 반사
```

### 6.3 CSS 구현 시 그라데이션 매핑

```css
/* 캡슐 형태의 3D 곡면감 표현 */
.metal-button {
    border-radius: 9999px; /* 완전한 캡슐 */
    background: linear-gradient(
        180deg,
        /* 상단 하이라이트 */ var(--highlight) 0%,
        /* 기본 금속색 */ var(--base-color) 45%,
        /* 하단 그림자 */ var(--shadow) 100%
    );
}
```

---

## 7. 기술 스택 및 구현 방식

### 7.1 선택: WebGL + Three.js

| 기술 | 용도 | 선택 이유 |
|------|------|-----------|
| **Three.js** | 3D 렌더링 | PBR 머티리얼, 환경맵 지원 |
| **TensorFlow.js** | 얼굴 트래킹 | face-landmarks-detection 모델 |
| **WebRTC** | 웹캠 접근 | MediaDevices API |
| **GLSL** | 커스텀 셰이더 | 금속 반사 정밀 제어 |

### 7.2 대안: 순수 CSS + Canvas (경량화)

복잡한 3D 없이 2D로 금속 효과 근사:
- CSS Gradient로 기본 금속 광택
- Canvas로 동적 하이라이트 오버레이
- Face-api.js로 얼굴 트래킹

### 7.3 권장 방식

**하이브리드 접근**:
1. 버튼 외형: CSS (반응형, 접근성)
2. 금속 반사: Canvas 2D (성능)
3. 얼굴 트래킹: TensorFlow.js (정확도)

---

## 8. 구현 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        Application                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ WebcamModule│  │ FaceTracker  │  │ MetalRenderer     │  │
│  │             │  │              │  │                   │  │
│  │ - stream    │  │ - landmarks  │  │ - materialProps   │  │
│  │ - frame     │→ │ - position   │→ │ - lightPosition   │  │
│  │             │  │ - rotation   │  │ - envMap          │  │
│  └─────────────┘  └──────────────┘  └───────────────────┘  │
│         ↓                ↓                   ↓              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    ButtonView                         │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │              Canvas/WebGL Layer                 │  │  │
│  │  │  - Dynamic specular highlights                 │  │  │
│  │  │  - Environment reflection                      │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │              CSS Base Layer                     │  │  │
│  │  │  - Capsule shape                               │  │  │
│  │  │  - Base metal gradient                         │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. 금속별 셰이더 파라미터

### 9.1 구리 (Copper)

```javascript
const COPPER = {
    name: 'Copper',
    // Fresnel F0 (sRGB)
    baseColor: [0.955, 0.638, 0.538],
    // 분광 반사 가중치
    spectralWeights: {
        red: 1.0,
        green: 0.67,
        blue: 0.56
    },
    // 표면 특성
    roughness: 0.1,
    metalness: 1.0,
    // CSS 그라데이션 색상
    cssGradient: {
        highlight: '#FFD4A8',
        base: '#B87333',
        shadow: '#8B4513'
    }
};
```

### 9.2 알루미늄 (Aluminum)

```javascript
const ALUMINUM = {
    name: 'Aluminum',
    baseColor: [0.913, 0.922, 0.924],
    spectralWeights: {
        red: 0.99,
        green: 1.0,
        blue: 1.0
    },
    roughness: 0.15,
    metalness: 1.0,
    cssGradient: {
        highlight: '#FFFFFF',
        base: '#D4D4D4',
        shadow: '#A0A0A0'
    }
};
```

### 9.3 스테인리스 스틸 (Stainless Steel)

```javascript
const STEEL = {
    name: 'Stainless Steel',
    baseColor: [0.562, 0.565, 0.578],
    spectralWeights: {
        red: 0.97,
        green: 0.98,
        blue: 1.0
    },
    roughness: 0.2,
    metalness: 1.0,
    cssGradient: {
        highlight: '#F0F0F0',
        base: '#8F8F8F',
        shadow: '#4A4A4A'
    }
};
```

---

## 10. 성능 최적화 전략

### 10.1 프레임 레이트 목표
- 목표: 30 FPS 이상
- 얼굴 트래킹: 15 FPS (별도 Worker)
- 렌더링: 60 FPS

### 10.2 최적화 기법

| 기법 | 설명 |
|------|------|
| **Web Worker** | 얼굴 트래킹을 별도 스레드에서 실행 |
| **requestAnimationFrame** | 브라우저 렌더 주기와 동기화 |
| **Resolution Scaling** | 웹캠 해상도를 480p로 제한 |
| **Temporal Smoothing** | 얼굴 위치 변화를 보간하여 떨림 방지 |

---

## 11. 파일 구조

```
Metal-Button-Design/
├── docs/
│   └── TECHNICAL_DESIGN.md      # 본 문서
├── src/
│   ├── index.html               # 진입점
│   ├── styles/
│   │   └── metal-button.css     # 버튼 기본 스타일
│   ├── shaders/
│   │   ├── metal.vert           # 버텍스 셰이더
│   │   └── metal.frag           # 프래그먼트 셰이더
│   ├── modules/
│   │   ├── webcam.js            # 웹캠 제어
│   │   ├── faceTracker.js       # 얼굴 트래킹
│   │   ├── metalRenderer.js     # 금속 렌더링
│   │   └── metalProperties.js   # 금속 광학 상수
│   └── main.js                  # 앱 초기화
├── assets/
│   └── textures/                # 브러시드 메탈 텍스처 등
└── package.json
```

---

## 12. 구현 단계 계획

### Phase 1: 기초 구조
- [ ] 프로젝트 스캐폴딩
- [ ] 캡슐 버튼 CSS 기본 형태
- [ ] 정적 금속 그라데이션

### Phase 2: 웹캠 통합
- [ ] MediaDevices API 연동
- [ ] 카메라 권한 요청 UI
- [ ] 비디오 스트림 캡처

### Phase 3: 얼굴 트래킹
- [ ] TensorFlow.js 모델 로드
- [ ] 얼굴 위치 추출
- [ ] 광원 방향 계산

### Phase 4: 금속 반사 렌더링
- [ ] Canvas 오버레이 구현
- [ ] 동적 하이라이트 계산
- [ ] 환경맵 반사 효과

### Phase 5: 통합 및 최적화
- [ ] 모듈 통합
- [ ] 성능 튜닝
- [ ] 다중 금속 타입 지원

---

## 13. 참고 문헌

1. **Physically Based Rendering: From Theory to Implementation** - Pharr, Jakob, Humphreys
2. **Real-Time Rendering, 4th Edition** - Akenine-Möller et al.
3. **Optical Properties of Metals** - CRC Handbook of Chemistry and Physics
4. **An Inexpensive BRDF Model for Physically-based Rendering** - Schlick, 1994
5. **Microfacet Models for Refraction through Rough Surfaces** - Walter et al., 2007

---

*문서 버전: 1.0*
*작성일: 2024*
*작성자: Claude (AI Assistant)*
