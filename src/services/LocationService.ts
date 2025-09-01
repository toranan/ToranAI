import * as Location from 'expo-location';
import { API_CONFIG, ENV_STATUS } from '../utils/config';
import { TransitRoute } from '../types';

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

export interface GeminiRouteResponse {
  startLocation: {
    name: string;
    latitude: number;
    longitude: number;
  };
  endLocation: {
    name: string;
    latitude: number;
    longitude: number;
  };
  distance: number;
  duration: number;
  steps: string[];
}

// 현재 위치 가져오기
export async function getCurrentLocation(): Promise<LocationCoords | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      console.warn('위치 권한이 거부됨');
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 10000,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('위치 정보 가져오기 실패:', error);
    return null;
  }
}

// Gemini 1.5 Flash를 사용하여 주소를 좌표로 변환 
export async function geocodeAddress(address: string): Promise<LocationCoords | null> {
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
              text: `한국의 장소명 "${address}"에 대한 정확한 WGS84 좌표를 찾아주세요. JSON 형식으로만 응답해주세요.

{
  "latitude": 위도_숫자,
  "longitude": 경도_숫자,
  "found": true/false
}

찾을 수 없으면 found를 false로 설정하세요.`
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

    const cleanResponse = aiResponse.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleanResponse);
    
    if (result.found && result.latitude && result.longitude) {
      return {
        latitude: result.latitude,
        longitude: result.longitude,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Gemini 지오코딩 오류:', error);
    return null;
  }
}


// Gemini 2.5 Flash를 사용하여 복잡한 경로 정보 제공
export async function getDirections(
  start: LocationCoords,
  end: LocationCoords,
  _mode: 'driving' | 'walking' | 'transit' = 'transit',
  startName?: string,
  endName?: string
): Promise<TransitRoute | null> {
  if (!ENV_STATUS.GEMINI_CONFIGURED) {
    console.error('Gemini API가 설정되지 않음');
    return null;
  }

  try {
    console.log('🤖 Gemini 2.5 Flash로 경로 정보 생성');
    
    const response = await fetch(
      `${API_CONFIG.GEMINI.BASE_URL}/${API_CONFIG.GEMINI.MODELS.ROUTING}:generateContent?key=${API_CONFIG.GEMINI.API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `당신은 한국 서울의 대중교통 전문가입니다. "${startName || '출발지'}"에서 "${endName || '도착지'}"까지 가는 **실제 최적 경로 3가지**를 제안해주세요.

출발지: ${startName} (좌표: ${start.latitude}, ${start.longitude})
도착지: ${endName} (좌표: ${end.latitude}, ${end.longitude})

다음 JSON 형식으로만 응답해주세요 (정확히 3개 경로):

{
  "routes": [
    {
      "title": "최단시간 경로",
      "totalTime": 소요시간_분,
      "totalCost": 요금_원,
      "mainTransport": "지하철" | "버스" | "지하철+버스",
      "steps": [
        {
          "type": "지하철" | "버스",
          "line": "2호선" | "472번",
          "from": "강남역",
          "to": "교대역", 
          "time": 소요시간_분,
          "stations": 정류장수 (지하철의경우)
        }
      ]
    }
  ]
}

**중요 요구사항:**
1. 실제로 **가장 효율적인 교통수단**을 선택해서 제안
2. 지하철이 빠르면 지하철만, 버스가 빠르면 버스만, 조합이 좋으면 지하철+버스
3. **불필요한 교통수단은 절대 포함하지 않음** 
4. 실제 서울 교통 상황을 반영
5. 각 경로의 mainTransport 필드로 주요 교통수단 명시

예시:
- 강남역→교대역: 지하철 2호선이 최적 → 지하철만 제안
- 충무로→교대역: 지하철 환승 vs 버스 직행 → 실제 빠른 것 제안
- 먼 거리: 지하철+버스 조합이 효율적이면 조합 제안`
            }]
          }]
        })
      }
    );

    console.log('📡 응답 상태:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API 오류 내용:', errorText);
      throw new Error(`Gemini API 호출 실패: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!aiResponse) {
      throw new Error('AI 응답이 없습니다');
    }

    const cleanResponse = aiResponse.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleanResponse);
    
    // 첫 번째 경로를 TransitRoute 형식으로 변환
    if (result.routes && result.routes.length > 0) {
      const route = result.routes[0];
      
      // mainTransport에 따라 정확한 카운트 계산
      const subwaySteps = route.steps.filter((s: any) => s.type === '지하철');
      const busSteps = route.steps.filter((s: any) => s.type === '버스');
      
      const transitRoute: TransitRoute = {
        pathType: 1,
        info: {
          mapObj: '',
          firstStartStation: startName || '출발지',
          lastEndStation: endName || '도착지',
          totalStationCount: route.steps.reduce((acc: number, s: any) => acc + (s.stations || 1), 0),
          busStationCount: busSteps.length,
          subwayStationCount: subwaySteps.length,
          totalWalk: 0, // 도보 제외
          totalTime: route.totalTime || 0,
          payment: route.totalCost || 1370,
          busCount: busSteps.length,
          subwayCount: subwaySteps.length,
        },
        subPath: route.steps.map((step: any, index: number) => ({
          trafficType: step.type === '지하철' ? 1 : step.type === '버스' ? 2 : 3,
          distance: step.type === '지하철' ? (step.stations || 1) * 1000 : (step.time || 0) * 500, // 지하철은 역수 기반, 버스는 시간 기반
          sectionTime: step.time || 0,
          stationCount: step.stations || (step.type === '버스' ? 0 : 1),
          startName: step.from || (index === 0 ? startName : ''),
          endName: step.to || (index === route.steps.length - 1 ? endName : ''),
          way: step.type === '지하철' ? `${step.line} 탑승` : `${step.line} 버스 탑승`,
          door: undefined,
          startX: index === 0 ? start.longitude : 0,
          startY: index === 0 ? start.latitude : 0,
          endX: index === route.steps.length - 1 ? end.longitude : 0,
          endY: index === route.steps.length - 1 ? end.latitude : 0,
          passStopList: undefined,
          lane: [{ name: step.line }],
        }))
      };
      
      console.log('✅ Gemini 대중교통 경로 변환 완료:', route.title, `(${route.mainTransport})`);
      return transitRoute;
    }
    
    return null;
  } catch (error) {
    console.error('Gemini 경로 검색 오류:', error);
    return null;
  }
}