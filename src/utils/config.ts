// API 설정 파일
import { GEMINI_API_KEY } from '@env';

export const API_CONFIG = {
  // AI API (Gemini)
  GEMINI: {
    API_KEY: GEMINI_API_KEY || 'your_gemini_api_key',
    BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models',
    // 다양한 모델 버전 지원
    MODELS: {
      CHAT: 'gemini-1.5-flash',        // 일반 채팅, 텍스트 파싱
      ROUTING: 'gemini-2.5-flash',     // 복잡한 경로 검색 (최신 고성능)
      GEOCODING: 'gemini-1.5-flash'    // 장소명 → 좌표 변환
    }
  },
};

console.log('🔧 환경 변수 디버깅:');
console.log('GEMINI_API_KEY:', GEMINI_API_KEY ? '설정됨' : '미설정');

export const ENV_STATUS = {
  GEMINI_CONFIGURED: Boolean(GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key'),
};

export const APP_CONFIG = {
  DEFAULT_LOCATION: {
    latitude: 37.5665,
    longitude: 126.9780, // 서울 기본 좌표
  },
}; 