/**
 * Metal Button Design - Main Entry
 */

import { CapsuleRenderer } from './modules/CapsuleRenderer.js';
import { COPPER, ALUMINUM, STEEL } from './modules/MetalMaterial.js';

// 셰이더 소스 로드
async function loadShaders() {
    const [vertexResponse, fragmentResponse] = await Promise.all([
        fetch('./shaders/capsule.vert'),
        fetch('./shaders/capsule.frag')
    ]);

    return {
        vertex: await vertexResponse.text(),
        fragment: await fragmentResponse.text()
    };
}

// 앱 상태
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

            // 0~1 범위로 정규화 후 -1~1로 변환
            // 좌우 반전 (거울 모드)
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

    // 광원 위치 부드럽게 업데이트
    updateLightPosition();

    // 각 렌더러 업데이트
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

    // 100ms 간격으로 감지 (10 FPS)
    setTimeout(faceDetectionLoop, 100);
}

/**
 * 앱 초기화
 */
async function init() {
    console.log('Metal Button Design 초기화 중...');

    // 셰이더 로드
    const shaders = await loadShaders();

    // 렌더러 생성
    const canvasIds = [
        { id: 'copper-button', material: COPPER },
        { id: 'aluminum-button', material: ALUMINUM },
        { id: 'steel-button', material: STEEL }
    ];

    for (const { id, material } of canvasIds) {
        const canvas = document.getElementById(id);
        if (canvas) {
            const renderer = new CapsuleRenderer(canvas, material, shaders);
            state.renderers.push(renderer);
        }
    }

    // 렌더 루프 시작 (카메라 없이도 동작)
    state.isRunning = true;
    renderLoop();

    // 권한 프롬프트 설정
    const prompt = document.getElementById('permission-prompt');
    const enableBtn = document.getElementById('enable-camera');

    // 초기에는 프롬프트 표시
    prompt.classList.add('visible');

    enableBtn.addEventListener('click', async () => {
        prompt.classList.remove('visible');

        const cameraOk = await initCamera();
        if (cameraOk) {
            const faceOk = await initFaceDetector();
            if (faceOk) {
                faceDetectionLoop();
            }
            console.log('카메라 활성화 완료');
        } else {
            console.log('카메라 없이 정적 모드로 실행');
        }
    });

    console.log('초기화 완료');
}

// 시작
init().catch(console.error);
