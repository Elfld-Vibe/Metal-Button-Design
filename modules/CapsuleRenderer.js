/**
 * CapsuleRenderer - 캡슐 버튼 렌더링
 */

import { GLContext } from './GLContext.js';

export class CapsuleRenderer {
    constructor(canvas, material, shaders) {
        this.canvas = canvas;
        this.material = material;
        this.glContext = new GLContext(canvas);

        // 셰이더 프로그램 생성
        this.glContext.createProgram(shaders.vertex, shaders.fragment);

        // Quad 버퍼 생성
        this.quadBuffer = this.glContext.createQuadBuffer();

        // 카메라 텍스처
        this.cameraTexture = this.glContext.createTexture();
        this.hasCamera = false;
        this.maxMipLevel = 8;

        // 광원 위치 (트래킹 값)
        this.lightPos = { x: 0, y: 0 };

        // 블렌딩 활성화 (투명 배경 지원)
        const gl = this.glContext.gl;
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    /**
     * 광원 위치 업데이트 (트래킹 결과)
     */
    setLightPosition(x, y) {
        this.lightPos.x = x;
        this.lightPos.y = y;
    }

    /**
     * 카메라 텍스처 업데이트
     */
    updateCameraTexture(video) {
        if (video && video.readyState >= 2) {
            this.glContext.updateVideoTexture(this.cameraTexture, video);
            this.hasCamera = true;
        }
    }

    /**
     * 렌더링
     */
    render() {
        const gl = this.glContext.gl;

        this.glContext.setViewport();
        this.glContext.clear();
        this.glContext.useProgram();

        // 유니폼 설정
        const f0Loc = this.glContext.getUniformLocation('uF0');
        const roughnessLoc = this.glContext.getUniformLocation('uRoughness');
        const lightPosLoc = this.glContext.getUniformLocation('uLightPos');
        const maxMipLoc = this.glContext.getUniformLocation('uMaxMipLevel');
        const hasCameraLoc = this.glContext.getUniformLocation('uHasCamera');
        const aspectRatioLoc = this.glContext.getUniformLocation('uAspectRatio');
        const textureLoc = this.glContext.getUniformLocation('uCameraTexture');

        gl.uniform3fv(f0Loc, this.material.F0);
        gl.uniform1f(roughnessLoc, this.material.roughness);
        gl.uniform2f(lightPosLoc, this.lightPos.x, this.lightPos.y);
        gl.uniform1f(maxMipLoc, this.maxMipLevel);
        gl.uniform1i(hasCameraLoc, this.hasCamera ? 1 : 0);
        gl.uniform1f(aspectRatioLoc, this.canvas.width / this.canvas.height);

        // 텍스처 바인딩
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.cameraTexture);
        gl.uniform1i(textureLoc, 0);

        // 그리기
        this.glContext.drawQuad(this.quadBuffer);
    }
}

export default CapsuleRenderer;
