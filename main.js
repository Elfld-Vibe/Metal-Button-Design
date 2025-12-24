/**
 * Metal Button Design - Main Entry
 * 셰이더 인라인 포함 버전
 */

import { CapsuleRenderer } from './modules/CapsuleRenderer.js';
import { COPPER, ALUMINUM, STEEL } from './modules/MetalMaterial.js';

// ============================================
// 인라인 셰이더 소스
// ============================================

const VERTEX_SHADER = `#version 300 es

in vec2 aPosition;
out vec2 vLocalPos;

void main() {
    vLocalPos = aPosition;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
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
const float CAPSULE_RADIUS = 0.4;
const float CAPSULE_HALF_WIDTH = 0.5;

/**
 * 캡슐 SDF (Signed Distance Function)
 */
float sdCapsule(vec2 p, float r, float h) {
    p.x = abs(p.x) - h;
    return length(max(p, 0.0)) + min(max(p.x, p.y), 0.0) - r;
}

/**
 * SDF 그래디언트로 3D 법선 계산
 */
vec3 calcNormal(vec2 p, float r, float h) {
    vec2 e = vec2(0.001, 0.0);
    vec2 grad = vec2(
        sdCapsule(p + e.xy, r, h) - sdCapsule(p - e.xy, r, h),
        sdCapsule(p + e.yx, r, h) - sdCapsule(p - e.yx, r, h)
    );

    float sdf = sdCapsule(p, r, h);
    float depth = sqrt(max(0.0, r * r - sdf * sdf)) / r;

    return normalize(vec3(-grad * 2.0, depth + 0.3));
}

/**
 * Fresnel-Schlick 근사
 */
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

void main() {
    vec2 p = vLocalPos;
    p.x *= uAspectRatio;

    float sdf = sdCapsule(p, CAPSULE_RADIUS, CAPSULE_HALF_WIDTH * uAspectRatio);

    if (sdf > 0.0) {
        discard;
    }

    float edgeSoftness = fwidth(sdf) * 1.5;
    float alpha = smoothstep(0.0, -edgeSoftness, sdf);

    vec3 N = calcNormal(p, CAPSULE_RADIUS, CAPSULE_HALF_WIDTH * uAspectRatio);
    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 L = normalize(vec3(-uLightPos, 1.0));
    vec3 R = reflect(-V, N);

    float NdotV = max(dot(N, V), 0.0);
    vec3 F = fresnelSchlick(NdotV, uF0);

    vec3 color;

    if (uHasCamera) {
        vec2 envUV = R.xy * 0.5 + 0.5;
        envUV = clamp(envUV, 0.0, 1.0);
        float mip = uRoughness * uMaxMipLevel;
        vec3 envColor = textureLod(uCameraTexture, envUV, mip).rgb;
        color = envColor * F;
    } else {
        float gradient = N.y * 0.5 + 0.5;
        vec3 baseColor = uF0;
        color = mix(baseColor * 0.4, baseColor * 1.2, gradient);
        color *= F;
    }

    vec3 H = normalize(V + L);
    float NdotH = max(dot(N, H), 0.0);
    float spec = pow(NdotH, 64.0);
    color += spec * F * 0.5;

    float rim = 1.0 - NdotV;
    rim = pow(rim, 3.0);
    color += rim * F * 0.2;

    color = pow(color, vec3(1.0 / 2.2));

    fragColor = vec4(color, alpha);
}
`;

// ============================================
// 앱 상태
// ============================================

const state = {
    renderers: [],
    videoElement: null,
    cameraStream: null,
    isRunning: false,
    lightPos: { x: 0, y: 0 },
    targetLightPos: { x: 0, y: 0 },
    faceDetector: null
};

/**
 * 카메라 초기화
 */
async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            }
        });

        state.videoElement = document.createElement('video');
        state.videoElement.srcObject = stream;
        state.videoElement.playsInline = true;
        state.videoElement.muted = true;
        await state.videoElement.play();

        state.cameraStream = stream;
        console.log('카메라 초기화 성공');
        return true;
    } catch (e) {
        console.warn('카메라 접근 실패:', e.message);
        return false;
    }
}

/**
 * FaceDetector 초기화 (Chrome 전용)
 */
async function initFaceDetector() {
    if (!('FaceDetector' in window)) {
        console.warn('FaceDetector API를 지원하지 않는 브라우저입니다.');
        return false;
    }

    try {
        state.faceDetector = new FaceDetector({ fastMode: true });
        console.log('FaceDetector 초기화 성공');
        return true;
    } catch (e) {
        console.warn('FaceDetector 초기화 실패:', e.message);
        return false;
    }
}

/**
 * 얼굴 위치 감지
 */
async function detectFacePosition() {
    if (!state.faceDetector || !state.videoElement) return;

    try {
        const faces = await state.faceDetector.detect(state.videoElement);
        if (faces.length > 0) {
            const box = faces[0].boundingBox;
            const videoWidth = state.videoElement.videoWidth;
            const videoHeight = state.videoElement.videoHeight;

            state.targetLightPos.x = -((box.x + box.width / 2) / videoWidth - 0.5) * 2;
            state.targetLightPos.y = ((box.y + box.height / 2) / videoHeight - 0.5) * 2;
        }
    } catch (e) {
        // 감지 실패 시 무시
    }
}

/**
 * 부드러운 보간으로 광원 위치 업데이트
 */
function updateLightPosition() {
    const smoothing = 0.1;
    state.lightPos.x += (state.targetLightPos.x - state.lightPos.x) * smoothing;
    state.lightPos.y += (state.targetLightPos.y - state.lightPos.y) * smoothing;
}

/**
 * 렌더 루프
 */
function renderLoop() {
    if (!state.isRunning) return;

    updateLightPosition();

    for (const renderer of state.renderers) {
        renderer.setLightPosition(state.lightPos.x, state.lightPos.y);

        if (state.videoElement) {
            renderer.updateCameraTexture(state.videoElement);
        }

        renderer.render();
    }

    requestAnimationFrame(renderLoop);
}

/**
 * 얼굴 감지 루프 (별도 주기)
 */
function faceDetectionLoop() {
    if (!state.isRunning) return;

    detectFacePosition();
    setTimeout(faceDetectionLoop, 100);
}

/**
 * 앱 초기화
 */
async function init() {
    console.log('Metal Button Design 초기화 중...');

    const shaders = {
        vertex: VERTEX_SHADER,
        fragment: FRAGMENT_SHADER
    };

    // 렌더러 생성
    const canvasConfigs = [
        { id: 'copper-button', material: COPPER },
        { id: 'aluminum-button', material: ALUMINUM },
        { id: 'steel-button', material: STEEL }
    ];

    for (const { id, material } of canvasConfigs) {
        const canvas = document.getElementById(id);
        if (canvas) {
            try {
                const renderer = new CapsuleRenderer(canvas, material, shaders);
                state.renderers.push(renderer);
                console.log(`${material.name} 렌더러 생성 완료`);
            } catch (e) {
                console.error(`${material.name} 렌더러 생성 실패:`, e);
            }
        } else {
            console.warn(`캔버스를 찾을 수 없음: ${id}`);
        }
    }

    if (state.renderers.length === 0) {
        console.error('렌더러가 하나도 생성되지 않았습니다.');
        return;
    }

    // 렌더 루프 시작
    state.isRunning = true;
    renderLoop();

    // 권한 프롬프트 설정
    const prompt = document.getElementById('permission-prompt');
    const enableBtn = document.getElementById('enable-camera');

    if (prompt && enableBtn) {
        prompt.classList.add('visible');

        enableBtn.addEventListener('click', async () => {
            prompt.classList.remove('visible');

            const cameraOk = await initCamera();
            if (cameraOk) {
                const faceOk = await initFaceDetector();
                if (faceOk) {
                    faceDetectionLoop();
                }
            }
        });
    }

    console.log('초기화 완료 - 렌더러:', state.renderers.length);
}

// 시작
init().catch(e => {
    console.error('초기화 오류:', e);
});
