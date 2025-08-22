// API 설정 파일
import { GEMINI_API_KEY,KAKAO_MAP_JS_KEY } from '@env';

export const API_CONFIG = {
  // AI API (Gemini)
  GEMINI: {
    API_KEY: GEMINI_API_KEY || 'your_gemini_api_key',
    BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models',
  },
  KAKAO_MAP: {
    JS_KEY: KAKAO_MAP_JS_KEY || 'your_kakao_map_js_key',
  },
};

export const ENV_STATUS = {
  GEMINI_CONFIGURED: Boolean(GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key'),
};

export const APP_CONFIG = {
  DEFAULT_LOCATION: {
    latitude: 37.5665,
    longitude: 126.9780, // 서울 기본 좌표
  },
}; 