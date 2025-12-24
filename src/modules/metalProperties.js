/**
 * 금속 광학 특성 정의
 * Metal Optical Properties Definition
 *
 * 참조: CRC Handbook of Chemistry and Physics
 * 복소 굴절률 (n, k) 및 Fresnel F0 값
 */

/**
 * 구리 (Copper) 광학 특성
 * 특징: 적황색 계열, 장파장(적색) 반사율 높음
 */
export const COPPER = {
    name: 'Copper',
    nameKo: '구리',

    // Fresnel F0 at normal incidence (sRGB)
    // 수직 입사 시 기본 반사색
    baseColor: [0.955, 0.638, 0.538],

    // 복소 굴절률 @ 550nm
    refractiveIndex: { n: 0.27, k: 2.58 },

    // 파장별 반사율 (가시광선 영역)
    spectralReflectance: {
        400: 0.35,  // 보라 - 흡수
        450: 0.38,  // 청색 - 흡수
        500: 0.42,  // 청록 - 흡수
        550: 0.50,  // 녹색 - 부분 흡수
        600: 0.85,  // 주황 - 반사 (구리색의 원인)
        650: 0.92,  // 적색 - 높은 반사
        700: 0.97   // 심적색 - 매우 높은 반사
    },

    // PBR 머티리얼 파라미터
    roughness: 0.1,      // 광택 표면
    metalness: 1.0,      // 완전 금속

    // CSS 그라데이션용 색상
    cssColors: {
        highlight: '#FFD4A8',    // 밝은 하이라이트
        lightArea: '#E8A862',    // 밝은 영역
        base: '#B87333',         // 기본 구리색
        midShadow: '#9A5D28',    // 중간 그림자
        shadow: '#7A4A1D',       // 어두운 영역
        deepShadow: '#5A3515'    // 깊은 그림자
    },

    // 환경광 색조 오프셋
    ambientTint: [1.0, 0.85, 0.75]
};

/**
 * 알루미늄 (Aluminum) 광학 특성
 * 특징: 은백색, 전 파장 균일한 높은 반사율
 */
export const ALUMINUM = {
    name: 'Aluminum',
    nameKo: '알루미늄',

    baseColor: [0.913, 0.922, 0.924],

    refractiveIndex: { n: 1.37, k: 7.62 },

    spectralReflectance: {
        400: 0.92,
        450: 0.92,
        500: 0.91,
        550: 0.91,
        600: 0.90,
        650: 0.89,
        700: 0.89
    },

    roughness: 0.15,
    metalness: 1.0,

    cssColors: {
        highlight: '#FFFFFF',
        lightArea: '#F0F0F0',
        base: '#D4D4D4',
        midShadow: '#B8B8B8',
        shadow: '#A0A0A0',
        deepShadow: '#787878'
    },

    ambientTint: [1.0, 1.0, 1.02]
};

/**
 * 스테인리스 스틸 (Stainless Steel) 광학 특성
 * 특징: 회백색, 중간 반사율, 약간의 황색 편향
 */
export const STEEL = {
    name: 'Stainless Steel',
    nameKo: '스테인리스 스틸',

    baseColor: [0.562, 0.565, 0.578],

    refractiveIndex: { n: 2.75, k: 3.79 },

    spectralReflectance: {
        400: 0.55,
        450: 0.56,
        500: 0.58,
        550: 0.58,
        600: 0.60,
        650: 0.61,
        700: 0.62
    },

    roughness: 0.2,
    metalness: 1.0,

    cssColors: {
        highlight: '#F8F8F8',
        lightArea: '#C8C8C8',
        base: '#8F8F8F',
        midShadow: '#6A6A6A',
        shadow: '#4A4A4A',
        deepShadow: '#2F2F2F'
    },

    ambientTint: [0.98, 0.98, 1.0]
};

/**
 * 금속 타입 맵
 */
export const METAL_TYPES = {
    copper: COPPER,
    aluminum: ALUMINUM,
    steel: STEEL
};

/**
 * Fresnel-Schlick 근사 계산
 * @param {number} cosTheta - 시야각의 코사인 값
 * @param {number[]} f0 - 수직 입사 시 반사율 (RGB)
 * @returns {number[]} - 해당 각도에서의 반사율 (RGB)
 */
export function fresnelSchlick(cosTheta, f0) {
    const oneMinusCos = 1.0 - cosTheta;
    const pow5 = oneMinusCos * oneMinusCos * oneMinusCos * oneMinusCos * oneMinusCos;

    return [
        f0[0] + (1.0 - f0[0]) * pow5,
        f0[1] + (1.0 - f0[1]) * pow5,
        f0[2] + (1.0 - f0[2]) * pow5
    ];
}

/**
 * GGX/Trowbridge-Reitz 법선 분포 함수
 * @param {number} NdotH - 법선과 하프벡터의 내적
 * @param {number} roughness - 표면 거칠기 (0-1)
 * @returns {number} - 미세면 분포 값
 */
export function distributionGGX(NdotH, roughness) {
    const a = roughness * roughness;
    const a2 = a * a;
    const NdotH2 = NdotH * NdotH;

    const nom = a2;
    let denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = Math.PI * denom * denom;

    return nom / denom;
}

/**
 * Schlick-GGX 지오메트리 함수
 * @param {number} NdotV - 법선과 시야 방향의 내적
 * @param {number} roughness - 표면 거칠기
 * @returns {number} - 지오메트리 감쇠 값
 */
export function geometrySchlickGGX(NdotV, roughness) {
    const r = roughness + 1.0;
    const k = (r * r) / 8.0;

    const nom = NdotV;
    const denom = NdotV * (1.0 - k) + k;

    return nom / denom;
}

/**
 * Smith's 지오메트리 함수 (양방향)
 * @param {number} NdotV - 법선과 시야 방향의 내적
 * @param {number} NdotL - 법선과 광원 방향의 내적
 * @param {number} roughness - 표면 거칠기
 * @returns {number} - 양방향 지오메트리 감쇠 값
 */
export function geometrySmith(NdotV, NdotL, roughness) {
    const ggx1 = geometrySchlickGGX(NdotL, roughness);
    const ggx2 = geometrySchlickGGX(NdotV, roughness);
    return ggx1 * ggx2;
}

export default METAL_TYPES;
