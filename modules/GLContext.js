/**
 * GLContext - WebGL2 컨텍스트 관리
 */

export class GLContext {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2', {
            alpha: true,
            antialias: true,
            premultipliedAlpha: false
        });

        if (!this.gl) {
            throw new Error('WebGL2를 지원하지 않는 브라우저입니다.');
        }

        this.program = null;
        this.uniforms = {};
        this.attributes = {};
    }

    /**
     * 셰이더 컴파일
     */
    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`셰이더 컴파일 오류: ${error}`);
        }

        return shader;
    }

    /**
     * 프로그램 생성 및 링크
     */
    createProgram(vertexSource, fragmentSource) {
        const gl = this.gl;

        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const error = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error(`프로그램 링크 오류: ${error}`);
        }

        // 셰이더는 프로그램에 링크된 후 삭제 가능
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);

        this.program = program;
        return program;
    }

    /**
     * 유니폼 위치 캐싱
     */
    getUniformLocation(name) {
        if (!this.uniforms[name]) {
            this.uniforms[name] = this.gl.getUniformLocation(this.program, name);
        }
        return this.uniforms[name];
    }

    /**
     * 어트리뷰트 위치 캐싱
     */
    getAttribLocation(name) {
        if (this.attributes[name] === undefined) {
            this.attributes[name] = this.gl.getAttribLocation(this.program, name);
        }
        return this.attributes[name];
    }

    /**
     * Quad 버퍼 생성 (풀스크린 삼각형 2개)
     */
    createQuadBuffer() {
        const gl = this.gl;

        // 클립 공간 좌표 (-1 ~ 1)
        const vertices = new Float32Array([
            -1.0, -1.0,
             1.0, -1.0,
            -1.0,  1.0,
            -1.0,  1.0,
             1.0, -1.0,
             1.0,  1.0
        ]);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        return buffer;
    }

    /**
     * 텍스처 생성
     */
    createTexture() {
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // 기본 설정
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        return texture;
    }

    /**
     * 비디오 텍스처 업데이트
     */
    updateVideoTexture(texture, video) {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        gl.generateMipmap(gl.TEXTURE_2D);
    }

    /**
     * 프로그램 사용
     */
    useProgram() {
        this.gl.useProgram(this.program);
    }

    /**
     * 뷰포트 설정
     */
    setViewport() {
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * 화면 클리어
     */
    clear() {
        const gl = this.gl;
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    /**
     * Quad 그리기
     */
    drawQuad(buffer) {
        const gl = this.gl;
        const posLoc = this.getAttribLocation('aPosition');

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}

export default GLContext;
