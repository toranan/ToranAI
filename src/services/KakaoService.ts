import { KAKAO_REST_API_KEY } from '@env';
import * as Location from 'expo-location';

// 카카오 로컬 API 기본 설정
const KAKAO_API_BASE_URL = 'https://dapi.kakao.com/v2/local';

// 장소 정보 인터페이스
export interface PlaceInfo {
  id: string;
  place_name: string;
  category_name: string;
  category_group_code: string;
  category_group_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string; // 경도
  y: string; // 위도
  place_url: string;
  distance: string;
  rating?: number;
}

// 검색 결과 인터페이스
export interface SearchResult {
  documents: PlaceInfo[];
  meta: {
    total_count: number;
    pageable_count: number;
    is_end: boolean;
    same_name: {
      region: string[];
      keyword: string;
      selected_region: string;
    };
  };
}

// 현재 위치 기반 주변 정보 검색
export async function searchNearbyPlaces(
  keyword: string,
  category?: string,
  radius: number = 1000
): Promise<PlaceInfo[]> {
  try {
    // 위치 권한 확인
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('위치 권한이 필요합니다.');
    }

    // 현재 위치 가져오기
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const { latitude, longitude } = location.coords;

    // 카카오 로컬 API - 키워드로 장소 검색
    const url = `${KAKAO_API_BASE_URL}/search/keyword.json`;
    const params = new URLSearchParams({
      query: keyword,
      x: longitude.toString(),
      y: latitude.toString(),
      radius: radius.toString(),
      sort: 'distance', // 거리순 정렬
      size: '15', // 최대 15개 결과
    });

    if (category) {
      params.append('category_group_code', category);
    }

    const response = await fetch(`${url}?${params}`, {
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`카카오 API 오류: ${response.status}`);
    }

    const data: SearchResult = await response.json();
    console.log('🔍 주변 장소 검색 결과:', data.documents.length, '개');

    return data.documents;

  } catch (error) {
    console.error('주변 장소 검색 오류:', error);
    throw error;
  }
}

// 카테고리별 주변 정보 검색 (편의점, 음식점, 카페 등)
export async function searchByCategory(
  categoryCode: string,
  radius: number = 1000
): Promise<PlaceInfo[]> {
  try {
    // 위치 권한 확인
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('위치 권한이 필요합니다.');
    }

    // 현재 위치 가져오기
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const { latitude, longitude } = location.coords;

    // 카카오 로컬 API - 카테고리로 장소 검색
    const url = `${KAKAO_API_BASE_URL}/search/category.json`;
    const params = new URLSearchParams({
      category_group_code: categoryCode,
      x: longitude.toString(),
      y: latitude.toString(),
      radius: radius.toString(),
      sort: 'distance',
      size: '15',
    });

    const response = await fetch(`${url}?${params}`, {
      headers: {
        'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`카카오 API 오류: ${response.status}`);
    }

    const data: SearchResult = await response.json();
    console.log(`🏪 ${categoryCode} 카테고리 검색 결과:`, data.documents.length, '개');

    return data.documents;

  } catch (error) {
    console.error('카테고리 검색 오류:', error);
    throw error;
  }
}

// 주요 카테고리 코드들
export const CATEGORY_CODES = {
  CONVENIENCE: 'CS2', // 편의점
  FOOD: 'FD6', // 음식점
  CAFE: 'CE7', // 카페
  HOSPITAL: 'HP8', // 병원
  PHARMACY: 'PM9', // 약국
  GAS_STATION: 'OL7', // 주유소
  SUBWAY: 'SW8', // 지하철역
  BANK: 'BK9', // 은행
  CULTURE: 'CT1', // 문화시설
  TOURISM: 'AT4', // 관광명소
  ACCOMMODATION: 'AD5', // 숙박
  MART: 'MT1', // 대형마트
  SCHOOL: 'SC4', // 학교
  ACADEMY: 'AC5', // 학원
  PARKING: 'PK6', // 주차장
};

// 카테고리 코드를 한글명으로 변환
export function getCategoryName(code: string): string {
  const categoryNames: { [key: string]: string } = {
    'CS2': '편의점',
    'FD6': '음식점',
    'CE7': '카페',
    'HP8': '병원',
    'PM9': '약국',
    'OL7': '주유소',
    'SW8': '지하철역',
    'BK9': '은행',
    'CT1': '문화시설',
    'AT4': '관광명소',
    'AD5': '숙박',
    'MT1': '대형마트',
    'SC4': '학교',
    'AC5': '학원',
    'PK6': '주차장',
  };
  
  return categoryNames[code] || '기타';
}

// 스마트 주변 정보 검색 (AI가 적절한 키워드나 카테고리 선택)
export async function smartNearbySearch(query: string): Promise<PlaceInfo[]> {
  try {
    console.log('🤖 스마트 주변 정보 검색:', query);

    // 키워드 기반 검색 먼저 시도
    let results = await searchNearbyPlaces(query);
    
    // 결과가 적으면 관련 카테고리로 추가 검색
    if (results.length < 5) {
      const categoryMapping: { [key: string]: string } = {
        '편의점': CATEGORY_CODES.CONVENIENCE,
        '마트': CATEGORY_CODES.MART,
        '음식점': CATEGORY_CODES.FOOD,
        '카페': CATEGORY_CODES.CAFE,
        '병원': CATEGORY_CODES.HOSPITAL,
        '약국': CATEGORY_CODES.PHARMACY,
        '주유소': CATEGORY_CODES.GAS_STATION,
        '지하철': CATEGORY_CODES.SUBWAY,
        '은행': CATEGORY_CODES.BANK,
      };

      // 쿼리에서 카테고리 추출해서 추가 검색
      for (const [keyword, categoryCode] of Object.entries(categoryMapping)) {
        if (query.includes(keyword)) {
          const categoryResults = await searchByCategory(categoryCode);
          // 중복 제거하며 결과 합치기
          const existingIds = new Set(results.map(r => r.id));
          const newResults = categoryResults.filter(r => !existingIds.has(r.id));
          results = [...results, ...newResults];
          break;
        }
      }
    }

    return results.slice(0, 10); // 최대 10개 결과만 반환

  } catch (error) {
    console.error('스마트 주변 검색 오류:', error);
    return [];
  }
}

// 거리 포맷팅 (미터 단위를 적절한 형태로 변환)
export function formatDistance(distance: string): string {
  const dist = parseInt(distance);
  if (dist < 1000) {
    return `${dist}m`;
  } else {
    return `${(dist / 1000).toFixed(1)}km`;
  }
}

// 장소까지의 예상 도보 시간 계산 (대략적)
export function estimateWalkingTime(distance: string): string {
  const dist = parseInt(distance);
  const walkingSpeedMPerMin = 80; // 평균 도보 속도 80m/분
  const minutes = Math.ceil(dist / walkingSpeedMPerMin);
  
  if (minutes < 60) {
    return `도보 ${minutes}분`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `도보 ${hours}시간 ${remainingMinutes}분`;
  }
}