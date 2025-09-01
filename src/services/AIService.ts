import { Schedule, TransitSearchParams, TransitRoute } from '../types';
import { API_CONFIG, ENV_STATUS } from '../utils/config';
import { getCurrentLocation, LocationCoords, getDirections } from './LocationService';

// 액션 타입 정의
export type ActionType = 'add' | 'remove' | 'list' | 'update' | 'clear' | 'transit' | 'weather' | 'notification_test' | 'nearby' | 'none';

// AI 응답 타입 정의
export interface AIResponse {
  action: ActionType;
  isSchedule: boolean;
  isTransit: boolean;
  isWeather: boolean;
  isNearby: boolean;
  schedule?: Partial<Schedule>;
  transit?: TransitSearchParams;
  nearby?: {
    keyword: string;
    category?: string;
  };
  query?: string; // 조회/삭제 시 검색어
  message?: string; // 사용자에게 보여줄 메시지
}

// AI API를 사용한 자연어 처리 및 명령 분석
export async function parseScheduleFromText(text: string): Promise<AIResponse> {
  try {
    // Gemini 1.5 Flash API 호출 (텍스트 파싱용)
    const response = await fetch(
      `${API_CONFIG.GEMINI.BASE_URL}/${API_CONFIG.GEMINI.MODELS.CHAT}:generateContent?key=${API_CONFIG.GEMINI.API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `사용자의 메시지를 분석하여 일정 관련 명령인지, 교통 정보 요청인지 판단하고 적절한 액션을 분류해주세요. JSON 형태로만 응답해주세요.

텍스트: "${text}"

가능한 액션 타입:
1. "add" - 일정 추가 (예: "내일 오후 3시에 회의", "회의 일정 추가해줘")
2. "remove" - 일정 삭제 (예: "회의 일정 삭제해줘", "내일 일정 지워줘", "일정 제거")
3. "list" - 일정 조회 (예: "일정 보여줘", "내 스케줄 확인", "오늘 뭐 있어?")
4. "update" - 일정 수정 (예: "회의 시간 변경해줘", "일정 수정")
5. "transit" - 교통 정보 요청 (예: "강남역에서 홍대입구역까지 가는 법", "지하철 경로 알려줘", "버스로 어떻게 가?")
6. "weather" - 날씨 정보 요청 (예: "날씨 어때?", "오늘 날씨", "비 올까?", "우산 필요해?")
7. "notification_test" - 알림 테스트 (예: "알림 테스트", "날씨 알림 확인", "푸시 알림 테스트")
8. "nearby" - 주변 정보 검색 (예: "근처 편의점", "주변 카페", "근처 음식점", "주변에 뭐 있어?")
9. "none" - 관련 없는 대화 (예: "안녕하세요", "고마워")

응답 형식:
{
  "action": "add|remove|list|update|transit|weather|notification_test|nearby|none",
  "isSchedule": true 또는 false,
  "isTransit": true 또는 false,
  "isWeather": true 또는 false,
  "isNearby": true 또는 false,
  "schedule": {
    "title": "일정 제목 (action이 add일 때만)",
    "date": "YYYY-MM-DD HH:MM:SS 형태의 날짜 (action이 add일 때만)",
    "location": "장소 (선택사항)"
  },
  "transit": {
    "startName": "출발지 이름 (action이 transit일 때만)",
    "endName": "도착지 이름 (action이 transit일 때만)"
  },
  "nearby": {
    "keyword": "검색할 장소 키워드 (action이 nearby일 때만)",
    "category": "카테고리 (선택사항)"
  },
  "query": "검색어 (remove, list, update 액션일 때 검색할 키워드)",
  "message": "사용자에게 보여줄 메시지"
}

현재 날짜와 시간: ${new Date().toISOString()}
- 상대적 날짜(내일, 모레 등)는 절대 날짜로 변환
- 시간이 명시되지 않았다면 적절한 시간을 추정 (예: 오전 9시)
- 일정과 관련 없고 교통정보와도 관련 없는 일반 대화라면 action을 "none"으로 설정
- 교통정보 요청시 출발지와 도착지를 추출해서 startName, endName으로 설정

예시:
- "내일 오후 3시에 회의" → action: "add", isSchedule: true, isTransit: false, isWeather: false, isNearby: false
- "회의 일정 삭제해줘" → action: "remove", isSchedule: true, isTransit: false, isWeather: false, isNearby: false, query: "회의"
- "내 일정 보여줘" → action: "list", isSchedule: true, isTransit: false, isWeather: false, isNearby: false
- "강남역에서 홍대입구역까지 가는 법" → action: "transit", isSchedule: false, isTransit: true, isWeather: false, isNearby: false, transit: {"startName": "강남역", "endName": "홍대입구역"}
- "오늘 날씨 어때?" → action: "weather", isSchedule: false, isTransit: false, isWeather: true, isNearby: false
- "근처 편의점" → action: "nearby", isSchedule: false, isTransit: false, isWeather: false, isNearby: true, nearby: {"keyword": "편의점"}
- "안녕하세요" → action: "none", isSchedule: false, isTransit: false, isWeather: false, isNearby: false`
            }]
          }]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiResponse) {
      throw new Error('AI 응답이 없습니다');
    }

    // JSON 파싱 시도
    try {
      const cleanResponse = aiResponse.replace(/```json|```/g, '').trim();
      const parsedResult = JSON.parse(cleanResponse);

      const response: AIResponse = {
        action: parsedResult.action || 'none',
        isSchedule: parsedResult.isSchedule || false,
        isTransit: parsedResult.isTransit || false,
        isWeather: parsedResult.isWeather || false,
        isNearby: parsedResult.isNearby || false,
        query: parsedResult.query,
        message: parsedResult.message,
      };

      if (parsedResult.action === 'add' && parsedResult.schedule) {
        response.schedule = {
          title: parsedResult.schedule.title,
          date: parsedResult.schedule.date ? new Date(parsedResult.schedule.date) : undefined,
          location: parsedResult.schedule.location,
        };
      }

      if (parsedResult.action === 'transit' && parsedResult.transit) {
        response.transit = {
          startX: 0,
          startY: 0,
          endX: 0,
          endY: 0,
          startName: parsedResult.transit.startName,
          endName: parsedResult.transit.endName,
        };
      }

      if (parsedResult.action === 'nearby' && parsedResult.nearby) {
        response.nearby = {
          keyword: parsedResult.nearby.keyword,
          category: parsedResult.nearby.category,
        };
      }

      return response;
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      return fallbackScheduleParsing(text);
    }

  } catch (error) {
    console.error('AI API 오류:', error);
    // API 실패 시 fallback 함수 사용
    return fallbackScheduleParsing(text);
  }
}

// AI API 실패 시 사용할 기본 명령 파싱 함수
function fallbackScheduleParsing(text: string): AIResponse {
  const lowerCaseText = text.toLowerCase();
  
  // 날씨 키워드 체크
  const weatherKeywords = [
    '날씨', '기온', '온도', '비', '눈', '바람', '구름', '맑', '흐림',
    '우산', '우천', '강수', '태풍', '폭염', '한파', '습도'
  ];
  
  const hasWeatherKeyword = weatherKeywords.some(keyword => lowerCaseText.includes(keyword));
  
  if (hasWeatherKeyword) {
    return {
      action: 'weather',
      isSchedule: false,
      isTransit: false,
      isWeather: true,
      isNearby: false,
      message: '날씨 정보를 조회합니다.'
    };
  }
  
  // 주변 정보 키워드 체크
  const nearbyKeywords = [
    '근처', '주변', '가까운', '인근', '옆', '편의점', '카페', '음식점', '병원',
    '약국', '마트', '은행', '주유소', '지하철역', '뭐', '뭐가', '어디'
  ];
  
  const hasNearbyKeyword = nearbyKeywords.some(keyword => lowerCaseText.includes(keyword));
  
  if (hasNearbyKeyword) {
    // 키워드 추출
    const keyword = nearbyKeywords.find(kw => lowerCaseText.includes(kw)) || '편의점';
    
    return {
      action: 'nearby',
      isSchedule: false,
      isTransit: false,
      isWeather: false,
      isNearby: true,
      nearby: {
        keyword: keyword,
      },
      message: `${keyword} 정보를 검색합니다.`
    };
  }
  
  // 교통 정보 키워드 체크
  const transitKeywords = [
    '가는', '가는법', '경로', '길찾기', '지하철', '버스', '교통', '대중교통',
    '에서', '까지', '역', '정류장', '환승', '노선', '길'
  ];
  
  const hasTransitKeyword = transitKeywords.some(keyword => lowerCaseText.includes(keyword));
  
  if (hasTransitKeyword) {
    // 간단한 출발지/도착지 추출 (fallback)
    const fromToMatch = text.match(/(.+?)에서\s*(.+?)까지|(.+?)에서\s*(.+?)로|(.+?)부터\s*(.+?)까지/);
    let startName = '', endName = '';
    
    if (fromToMatch) {
      startName = (fromToMatch[1] || fromToMatch[3] || fromToMatch[5] || '').trim();
      endName = (fromToMatch[2] || fromToMatch[4] || fromToMatch[6] || '').trim();
    }
    
    return {
      action: 'transit',
      isSchedule: false,
      isTransit: true,
      isWeather: false,
      isNearby: false,
      transit: {
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0,
        startName,
        endName
      },
      message: '교통 정보를 조회합니다.'
    };
  }
  
  // 액션 타입 판단
  if (lowerCaseText.includes('모든') && (lowerCaseText.includes('삭제') || lowerCaseText.includes('지워') || lowerCaseText.includes('초기화'))) {
    return {
      action: 'clear',
      isSchedule: true,
      isTransit: false,
      isWeather: false,
      isNearby: false,
      message: '모든 일정을 삭제합니다.'
    };
  }
  
  if (lowerCaseText.includes('삭제') || lowerCaseText.includes('지워') || lowerCaseText.includes('제거')) {
    return {
      action: 'remove',
      isSchedule: true,
      isTransit: false,
      isWeather: false,
      isNearby: false,
      query: text.replace(/삭제|지워|제거|해줘|하기|일정/g, '').trim(),
      message: '일정을 삭제합니다.'
    };
  }
  
  if (lowerCaseText.includes('보여') || lowerCaseText.includes('조회') || lowerCaseText.includes('확인') || 
      lowerCaseText.includes('스케줄') || lowerCaseText.includes('뭐 있')) {
    return {
      action: 'list',
      isSchedule: true,
      isTransit: false,
      isWeather: false,
      isNearby: false,
      query: text,
      message: '일정을 조회합니다.'
    };
  }
  
  if (lowerCaseText.includes('수정') || lowerCaseText.includes('변경')) {
    return {
      action: 'update',
      isSchedule: true,
      isTransit: false,
      isWeather: false,
      isNearby: false,
      query: text,
      message: '일정을 수정합니다.'
    };
  }
  
  // 일정 추가 키워드 체크
  const scheduleKeywords = [
    '내일', '모레', '다음주', '오늘', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일',
    '오전', '오후', '시', '분', '회의', '약속', '미팅', '만나기', '가기', '예약', '일정', '스케줄',
    '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'
  ];

  const hasScheduleKeyword = scheduleKeywords.some(keyword => lowerCaseText.includes(keyword));
  
  if (!hasScheduleKeyword) {
    return { 
      action: 'none',
      isSchedule: false,
      isTransit: false,
      isWeather: false,
      isNearby: false
    };
  }

  const now = new Date();
  let date = new Date(now);
  let hours = 9; // 기본 시간
  let minutes = 0;

  // 날짜 파싱
  if (lowerCaseText.includes('내일')) {
    date.setDate(now.getDate() + 1);
  } else if (lowerCaseText.includes('모레')) {
    date.setDate(now.getDate() + 2);
  } else if (lowerCaseText.includes('오늘')) {
    // 오늘 그대로
  }

  // 시간 파싱
  const timeRegex = /(\d{1,2})시(?:\s*(\d{1,2})분)?/;
  const timeMatch = lowerCaseText.match(timeRegex);

  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;

    if (lowerCaseText.includes('오후') && hours < 12) {
      hours += 12;
    }
  }

  date.setHours(hours, minutes, 0, 0);

  return {
    action: 'add',
    isSchedule: true,
    isTransit: false,
    isWeather: false,
      isNearby: false,
    schedule: {
      title: text,
      date: date,
    }
  };
}

// AI와의 일반적인 대화를 위한 함수 (1.5 Flash 사용)
export async function chatWithAI(message: string): Promise<string> {
  try {
    const response = await fetch(
      `${API_CONFIG.GEMINI.BASE_URL}/${API_CONFIG.GEMINI.MODELS.CHAT}:generateContent?key=${API_CONFIG.GEMINI.API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `당신은 친근하고 도움이 되는 AI 어시스턴트입니다. 사용자와 자연스럽게 대화하고, 일정 관리에 도움을 주세요.

사용자 메시지: "${message}"

친근하게 응답해주세요.`
            }]
          }]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`API 호출 실패: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

    return aiResponse || '죄송합니다. 응답을 생성할 수 없습니다.';

  } catch (error) {
    console.error('AI 채팅 오류:', error);
    return '죄송합니다. 현재 AI 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
  }
}

// AI를 사용해 장소명을 좌표로 변환하는 함수
async function getCoordinatesFromPlaceName(placeName: string): Promise<{x: number, y: number} | null> {
  if (!ENV_STATUS.GEMINI_CONFIGURED) {
    console.error('Gemini API가 설정되지 않음');
    return null;
  }

  try {
    const response = await fetch(
      `${API_CONFIG.GEMINI.BASE_URL}/${API_CONFIG.GEMINI.MODELS.GEOCODING}:generateContent?key=${API_CONFIG.GEMINI.API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `당신은 한국 지리에 매우 밝은 지오코딩(Geocoding) 전문가입니다. 사용자가 입력한 장소명을 분석하여 가장 가능성이 높은 실제 장소의 좌표를 찾아내는 임무를 수행합니다.

장소명: "${placeName}"

지침:
1.  **정확성 최우선**: 입력된 장소명을 바탕으로 한국 내에서 가장 가능성이 높은 실제 장소의 공식 명칭과 정확한 WGS84 좌표(위도, 경도)를 찾으세요.
2.  **모호성 해결**: '강남 신세계' 처럼 축약되거나 모호한 명칭은 '신세계백화점 강남점'과 같이 가장 대표적인 공식 명칭으로 변환하여 검색하세요.
3.  **JSON 형식 준수**: 반드시 아래의 JSON 형식으로만 응답해야 합니다. 다른 설명이나 대답, 마크다운 표기는 절대 포함하지 마세요.
4.  **실패 처리**: 장소를 찾을 수 없거나, '우리집' 처럼 실제 검색 불가능한 장소일 경우, 모든 필드 값을 null로 채운 JSON 객체를 반환하세요.

응답 JSON 형식:
{
  "placeName": "검색된 공식 장소명" | null,
  "latitude": 위도_숫자 | null,
  "longitude": 경도_숫자 | null,
  "address": "정확한 주소" | null
}

좋은 예시:
- 입력: "강남역" → 출력: {"placeName": "강남역 2호선", "latitude": 37.498095, "longitude": 127.027926, "address": "서울 강남구 강남대로 396"}
- 입력: "강남신세계" → 출력: {"placeName": "신세계백화점 강남점", "latitude": 37.504296, "longitude": 127.004357, "address": "서울 서초구 신반포로 176"}
- 입력: "경복궁" → 출력: {"placeName": "경복궁", "latitude": 37.579617, "longitude": 126.977041, "address": "서울 종로구 사직로 161"}
- 입력: "N서울타워" → 출력: {"placeName": "N서울타워", "latitude": 37.551169, "longitude": 126.988227, "address": "서울 용산구 남산공원길 105"}

나쁜 예시 (실패 처리):
- 입력: "우리집" → 출력: {"placeName": null, "latitude": null, "longitude": null, "address": null}
- 입력: "아무데나" → 출력: {"placeName": null, "latitude": null, "longitude": null, "address": null}`
            }]
          }]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API 호출 실패: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiResponse) {
      throw new Error('AI 응답이 없습니다');
    }

    // JSON 파싱 시도
    try {
      const cleanResponse = aiResponse.replace(/```json|```/g, '').trim();
      const result = JSON.parse(cleanResponse);
      
      if (result && result.latitude && result.longitude) {
        console.log(`AI 좌표 변환 성공: "${placeName}" → "${result.placeName}" (${result.latitude}, ${result.longitude})`);
        return {
          x: result.longitude,
          y: result.latitude
        };
      }
			
			console.warn(`AI가 좌표를 찾지 못함: "${placeName}"`);
      return null;
    } catch (parseError) {
      console.error('AI 좌표 응답 파싱 오류:', parseError, 'Response:', aiResponse);
      return null;
    }

  } catch (error) {
    console.error('AI 좌표 변환 오류:', error);
    return null;
  }
}

// 스마트한 일정 삭제를 위한 AI 분석 함수
export async function findSchedulesToDelete(userMessage: string, schedules: any[]): Promise<{
  shouldDelete: boolean;
  matchedSchedules: any[];
  reason: string;
}> {
  try {
    if (schedules.length === 0) {
      return {
        shouldDelete: false,
        matchedSchedules: [],
        reason: '등록된 일정이 없습니다.'
      };
    }

    // 현재 일정 목록을 텍스트로 변환
    const scheduleList = schedules.map((s, index) => 
      `${index + 1}. "${s.title}" - ${s.date.toLocaleString()} ${s.location ? `(${s.location})` : ''}`
    ).join('\n');

    const response = await fetch(
      `${API_CONFIG.GEMINI.BASE_URL}/${API_CONFIG.GEMINI.MODELS.CHAT}:generateContent?key=${API_CONFIG.GEMINI.API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `당신은 일정 관리 전문 AI입니다. 사용자의 메시지를 분석하여 어떤 일정을 삭제하려는지 정확히 파악해주세요.

사용자 메시지: "${userMessage}"

현재 등록된 일정들:
${scheduleList}

다음 JSON 형식으로만 응답해주세요:

{
  "shouldDelete": true/false,
  "matchedScheduleNumbers": [삭제할 일정의 번호들],
  "reason": "삭제 이유 또는 삭제하지 않는 이유",
  "confidence": 0.0~1.0
}

분석 기준:
1. 삭제 의도가 명확한지 확인 (삭제, 취소, 지워, 없애 등의 키워드)
2. 특정 일정을 가리키는지 파악 (제목, 날짜, 장소 등으로)
3. 애매한 경우 confidence를 낮게 설정
4. 잘못 삭제할 위험이 있으면 shouldDelete를 false로

예시:
- "회의 일정 삭제해줘" → 회의가 포함된 일정 찾기
- "내일 일정 취소" → 내일 날짜의 일정 찾기  
- "모든 일정 지워줘" → 전체 삭제
- "일정 어떤게 있어?" → 조회 목적이므로 삭제 안함`
            }]
          }]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`AI API 호출 실패: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiResponse) {
      throw new Error('AI 응답이 없습니다');
    }

    const cleanResponse = aiResponse.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleanResponse);

    // AI가 삭제하라고 했고 confidence가 높은 경우에만 진행
    if (result.shouldDelete && result.confidence >= 0.7) {
      const matchedSchedules = result.matchedScheduleNumbers
        .filter((num: number) => num >= 1 && num <= schedules.length)
        .map((num: number) => schedules[num - 1]);

      return {
        shouldDelete: true,
        matchedSchedules,
        reason: result.reason
      };
    } else {
      return {
        shouldDelete: false,
        matchedSchedules: [],
        reason: result.reason || '삭제 의도가 불분명하거나 대상 일정을 찾을 수 없습니다.'
      };
    }

  } catch (error) {
    console.error('스마트 일정 삭제 분석 오류:', error);
    return {
      shouldDelete: false,
      matchedSchedules: [],
      reason: 'AI 분석 중 오류가 발생했습니다. 정확한 일정명을 입력해주세요.'
    };
  }
}

// 경로 검색: Gemini AI만 사용
export async function searchTransitRoute(params: TransitSearchParams): Promise<TransitRoute[] | null> {
  console.log('🔍 경로 검색 시작');
  console.log('📍 출발:', params.startName, '→ 도착:', params.endName);

  try {
    // Gemini AI 사용
    if (!ENV_STATUS.GEMINI_CONFIGURED) {
      console.error('❌ Gemini API가 설정되지 않음');
      return null;
    }

    let startX = params.startX;
    let startY = params.startY;
    let endX = params.endX;
    let endY = params.endY;

    console.log('🎯 Gemini AI로 장소명 → 좌표 변환');
    
    // 출발지 좌표 변환
    if ((startX === 0 && startY === 0) && params.startName) {
      if (params.startName.includes('현재') || params.startName.includes('여기')) {
        console.log('📱 현재 위치 요청 중...');
        const currentLocation = await getCurrentLocation();
        if (currentLocation) {
          startX = currentLocation.longitude;
          startY = currentLocation.latitude;
          console.log('✅ 현재 위치:', startY, startX);
        } else {
          console.error('❌ 현재 위치를 가져올 수 없음');
          return null;
        }
      } else {
        console.log(`🤖 AI로 출발지 분석: "${params.startName}"`);
        const startCoords = await getCoordinatesFromPlaceName(params.startName);
        if (!startCoords) {
          console.error(`❌ 출발지 좌표를 찾을 수 없음: ${params.startName}`);
          return null;
        }
        startX = startCoords.x;
        startY = startCoords.y;
        console.log(`✅ 출발지 좌표: ${startY}, ${startX}`);
      }
    }

    // 도착지 좌표 변환
    if ((endX === 0 && endY === 0) && params.endName) {
      if (params.endName.includes('현재') || params.endName.includes('여기')) {
        console.log('📱 현재 위치 요청 중...');
        const currentLocation = await getCurrentLocation();
        if (currentLocation) {
          endX = currentLocation.longitude;
          endY = currentLocation.latitude;
          console.log('✅ 현재 위치:', endY, endX);
        } else {
          console.error('❌ 현재 위치를 가져올 수 없음');
          return null;
        }
      } else {
        console.log(`🤖 AI로 도착지 분석: "${params.endName}"`);
        const endCoords = await getCoordinatesFromPlaceName(params.endName);
        if (!endCoords) {
          console.error(`❌ 도착지 좌표를 찾을 수 없음: ${params.endName}`);
          return null;
        }
        endX = endCoords.x;
        endY = endCoords.y;
        console.log(`✅ 도착지 좌표: ${endY}, ${endX}`);
      }
    }

    console.log('🚗 Gemini AI로 경로 정보 생성');
    const directionResult = await getDirections(
      { latitude: startY, longitude: startX },
      { latitude: endY, longitude: endX },
      'driving',
      params.startName,
      params.endName
    );
    
    if (directionResult) {
      console.log('✅ Gemini 경로 검색 성공!');
      return [directionResult];
    } else {
      console.log('❌ 모든 경로 검색 방법 실패');
      return null;
    }
  } catch (error) {
    console.error('경로 검색 오류:', error);
    return null;
  }
}