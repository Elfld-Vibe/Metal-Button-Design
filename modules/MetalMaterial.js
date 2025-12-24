/**
 * MetalMaterial - 금속별 광학 특성 정의
 *
 * F0: Fresnel Reflectance at Normal Incidence
 * 빛이 표면에 수직으로 입사할 때의 반사율 (금속 고유색)
 */

export const COPPER = {
    name: 'Copper',
    nameKo: '구리',
    F0: [0.955, 0.638, 0.538],  // 적황색
    roughness: 0.1,
    // Fallback 그라데이션 (카메라 미사용 시)
    gradient: {
        highlight: '#FFD4A8',
        base: '#B87333',
        shadow: '#7A4A1D'
    }
};

export const ALUMINUM = {
    name: 'Aluminum',
    nameKo: '알루미늄',
    F0: [0.913, 0.922, 0.924],  // 은백색
    roughness: 0.15,
    gradient: {
        highlight: '#FFFFFF',
        base: '#D4D4D4',
        shadow: '#A0A0A0'
    }
};

export const STEEL = {
    name: 'Steel',
    nameKo: '스틸',
    F0: [0.562, 0.565, 0.578],  // 회백색
    roughness: 0.2,
    gradient: {
        highlight: '#F8F8F8',
        base: '#8F8F8F',
        shadow: '#4A4A4A'
    }
};

export const METALS = {
    copper: COPPER,
    aluminum: ALUMINUM,
    steel: STEEL
};

export default METALS;
