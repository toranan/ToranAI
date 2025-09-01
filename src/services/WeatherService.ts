import { KMA_API_KEY, KMA_MID_API_KEY } from '@env';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { API_CONFIG, ENV_STATUS } from '../utils/config';

// 기상청 격자 좌표 변환 함수 (WGS84 → 기상청 격자)
function dfsXyConv(code: string, v1: number, v2: number) {
  const RE = 6371.00877; // 지구 반경(km)
  const GRID = 5.0; // 격자 간격(km)
  const SLAT1 = 30.0; // 투영 위도1(degree)
  const SLAT2 = 60.0; // 투영 위도2(degree)
  const OLON = 126.0; // 기준점 경도(degree)
  const OLAT = 38.0; // 기준점 위도(degree)
  const XO = 43; // 기준점 X좌표(GRID)
  const YO = 136; // 기준점 Y좌표(GRID)

  const DEGRAD = Math.PI / 180.0;
  const RADDEG = 180.0 / Math.PI;

  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = re * sf / Math.pow(ro, sn);
  const rs: any = {};

  if (code === "toXY") {
    rs.lat = v1;
    rs.lng = v2;
    let ra = Math.tan(Math.PI * 0.25 + (v1) * DEGRAD * 0.5);
    ra = re * sf / Math.pow(ra, sn);
    let theta = v2 * DEGRAD - olon;
    if (theta > Math.PI) theta -= 2.0 * Math.PI;
    if (theta < -Math.PI) theta += 2.0 * Math.PI;
    theta *= sn;
    rs.x = Math.floor(ra * Math.sin(theta) + XO + 0.5);
    rs.y = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);
  }

  return rs;
}

// 날씨 상태 인터페이스
export interface WeatherInfo {
  location: string;
  currentTemp: number;
  description: string;
  humidity: number;
  precipitation: number;
  precipitationType: string; // 강수형태 (없음, 비, 비/눈, 눈, 소나기)
  precipitationProbability: number; // 강수확률
  hourlyForecast: HourlyWeather[];
  weatherAlert?: WeatherAlert;
}

export interface HourlyWeather {
  time: string;
  temp: number;
  precipitation: number;
  precipitationType: string;
  precipitationProbability: number;
}

export interface WeatherAlert {
  type: 'rain' | 'snow' | 'storm' | 'typhoon' | 'extreme_weather';
  message: string;
  startTime: string;
  endTime: string;
  severity: 'low' | 'medium' | 'high';
}

// 중기예보 정보 인터페이스
export interface MidTermForecast {
  location: string;
  targetDate: string;
  minTemp: number;
  maxTemp: number;
  weatherCondition: string;
  precipitationProbability: number;
  reliability: string; // A(높음), B(보통), C(낮음)
  days: MidTermDayForecast[];
}

export interface MidTermDayForecast {
  date: string;
  minTemp: number;
  maxTemp: number;
  amWeather: string;
  pmWeather: string;
  amRainProb: number;
  pmRainProb: number;
}

// 기상청 단기예보 API 응답 타입
interface KmaApiResponse {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: {
      items: {
        item: Array<{
          baseDate: string;
          baseTime: string;
          category: string;
          fcstDate: string;
          fcstTime: string;
          fcstValue: string;
          nx: number;
          ny: number;
        }>;
      };
      totalCount: number;
    };
  };
}

// 기상청 중기예보 API 응답 타입 (텍스트 형태의 종합 설명)
interface KmaMidTermResponse {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: {
      items: {
        item: Array<{
          wfSv: string; // 중기예보 종합 설명
        }>;
      };
      totalCount: number;
    };
  };
}

// 중기기온예보 API 응답 타입  
interface KmaMidTempResponse {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: {
      items: {
        item: Array<{
          regId: string;
          // 5일 후부터 10일 후까지의 온도 데이터
          taMin5?: number; taMax5?: number;
          taMin6?: number; taMax6?: number;
          taMin7?: number; taMax7?: number;
          taMin8?: number; taMax8?: number;
          taMin9?: number; taMax9?: number;
          taMin10?: number; taMax10?: number;
          // 상하한 범위 (일부 지점만 제공)
          taMin5Low?: number; taMin5High?: number;
          taMax5Low?: number; taMax5High?: number;
          taMin6Low?: number; taMin6High?: number;
          taMax6Low?: number; taMax6High?: number;
          taMin7Low?: number; taMin7High?: number;
          taMax7Low?: number; taMax7High?: number;
          taMin8Low?: number; taMin8High?: number;
          taMax8Low?: number; taMax8High?: number;
          taMin9Low?: number; taMin9High?: number;
          taMax9Low?: number; taMax9High?: number;
          taMin10Low?: number; taMin10High?: number;
          taMax10Low?: number; taMax10High?: number;
        }>;
      };
      totalCount: number;
    };
  };
}

// 현재 위치의 날씨 정보 가져오기
export async function getCurrentWeather(): Promise<WeatherInfo | null> {
  try {
    // 위치 권한 확인
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('위치 권한이 거부됨');
      return null;
    }

    // 현재 위치 가져오기
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const { latitude, longitude } = location.coords;

    // WGS84 좌표를 기상청 격자 좌표로 변환
    const gridCoords = dfsXyConv("toXY", latitude, longitude);
    
    return await getWeatherByGrid(gridCoords.x, gridCoords.y, '서울');

  } catch (error) {
    console.error('날씨 정보 가져오기 실패:', error);
    return null;
  }
}

// 격자 좌표로 날씨 정보 가져오기
async function getWeatherByGrid(nx: number, ny: number, locationName: string): Promise<WeatherInfo | null> {
  try {
    // 현재 날짜와 시간
    const now = new Date();
    const baseDate = now.getFullYear() + 
                    String(now.getMonth() + 1).padStart(2, '0') + 
                    String(now.getDate()).padStart(2, '0');
    
    // 기상청 API는 3시간 간격으로 업데이트 (02, 05, 08, 11, 14, 17, 20, 23시)
    const baseTimeList = ['0200', '0500', '0800', '1100', '1400', '1700', '2000', '2300'];
    const currentHour = now.getHours();
    let baseTime = '0200';
    
    for (let i = baseTimeList.length - 1; i >= 0; i--) {
      const time = parseInt(baseTimeList[i].substring(0, 2));
      if (currentHour >= time) {
        baseTime = baseTimeList[i];
        break;
      }
    }

    const apiUrl = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst`;
    const params = new URLSearchParams({
      serviceKey: decodeURIComponent(KMA_API_KEY),
      pageNo: '1',
      numOfRows: '1000',
      dataType: 'JSON',
      base_date: baseDate,
      base_time: baseTime,
      nx: nx.toString(),
      ny: ny.toString()
    });

    console.log('🌤️ 기상청 API 호출:', `${apiUrl}?${params}`);

    const response = await fetch(`${apiUrl}?${params}`);
    const data: KmaApiResponse = await response.json();

    if (data.response.header.resultCode !== '00') {
      throw new Error(`기상청 API 오류: ${data.response.header.resultMsg}`);
    }

    const items = data.response.body.items.item;
    if (!items || items.length === 0) {
      throw new Error('날씨 데이터가 없습니다');
    }

    // 현재 시간의 날씨 데이터 추출
    const currentForecast = parseWeatherData(items);
    
    return currentForecast;

  } catch (error) {
    console.error('기상청 API 호출 실패:', error);
    return null;
  }
}

// 기상청 데이터 파싱
function parseWeatherData(items: any[]): WeatherInfo {
  const now = new Date();
  const currentDate = now.getFullYear() + 
                     String(now.getMonth() + 1).padStart(2, '0') + 
                     String(now.getDate()).padStart(2, '0');
  const currentHour = String(now.getHours()).padStart(2, '0') + '00';

  // 현재 시간 데이터 찾기
  const currentData: any = {};
  const hourlyData: HourlyWeather[] = [];

  items.forEach(item => {
    const key = `${item.fcstDate}_${item.fcstTime}`;
    
    if (!currentData[key]) {
      currentData[key] = {};
    }
    
    currentData[key][item.category] = item.fcstValue;
  });

  // 현재 및 향후 12시간 데이터 처리
  const sortedTimes = Object.keys(currentData).sort();
  let currentInfo: any = null;

  for (const timeKey of sortedTimes.slice(0, 12)) {
    const data = currentData[timeKey];
    const [date, time] = timeKey.split('_');
    
    const hourly: HourlyWeather = {
      time: `${time.substring(0, 2)}:00`,
      temp: parseFloat(data.TMP || '0'),
      precipitation: parseFloat(data.PCP === '강수없음' ? '0' : data.PCP?.replace('mm', '') || '0'),
      precipitationType: getPrecipitationType(data.PTY),
      precipitationProbability: parseInt(data.POP || '0')
    };

    hourlyData.push(hourly);

    // 첫 번째 데이터를 현재 정보로 사용
    if (!currentInfo) {
      currentInfo = data;
    }
  }

  // 날씨 경보 생성
  const weatherAlert = generateWeatherAlert(hourlyData);

  const weatherInfo: WeatherInfo = {
    location: '현재 위치',
    currentTemp: parseFloat(currentInfo.TMP || '0'),
    description: getWeatherDescription(currentInfo.SKY, currentInfo.PTY),
    humidity: parseInt(currentInfo.REH || '0'),
    precipitation: parseFloat(currentInfo.PCP === '강수없음' ? '0' : currentInfo.PCP?.replace('mm', '') || '0'),
    precipitationType: getPrecipitationType(currentInfo.PTY),
    precipitationProbability: parseInt(currentInfo.POP || '0'),
    hourlyForecast: hourlyData,
    weatherAlert
  };

  return weatherInfo;
}

// 강수형태 변환
function getPrecipitationType(pty: string): string {
  switch (pty) {
    case '0': return '없음';
    case '1': return '비';
    case '2': return '비/눈';
    case '3': return '눈';
    case '4': return '소나기';
    default: return '없음';
  }
}

// 날씨 설명 생성
function getWeatherDescription(sky: string, pty: string): string {
  if (pty && pty !== '0') {
    return getPrecipitationType(pty);
  }

  switch (sky) {
    case '1': return '맑음';
    case '3': return '구름많음';
    case '4': return '흐림';
    default: return '알 수 없음';
  }
}

// 날씨 경보 생성
function generateWeatherAlert(hourlyData: HourlyWeather[]): WeatherAlert | undefined {
  // 향후 6시간 내 강수 예보 확인
  const rainHours = hourlyData.slice(0, 6).filter(h => 
    h.precipitation > 0 || h.precipitationProbability >= 70
  );

  if (rainHours.length > 0) {
    const startTime = rainHours[0].time;
    const endTime = rainHours[rainHours.length - 1].time;
    const maxPrecip = Math.max(...rainHours.map(h => h.precipitation));
    
    let severity: 'low' | 'medium' | 'high' = 'low';
    let type: 'rain' | 'snow' | 'storm' | 'typhoon' | 'extreme_weather' = 'rain';

    if (maxPrecip >= 20) {
      severity = 'high';
      type = 'storm';
    } else if (maxPrecip >= 5) {
      severity = 'medium';
    }

    // 눈 확인
    if (rainHours.some(h => h.precipitationType.includes('눈'))) {
      type = 'snow';
    }

    return {
      type,
      message: `${startTime}부터 ${endTime}까지 ${type === 'snow' ? '눈' : '비'}이 예상됩니다. ${type === 'snow' ? '따뜻하게 입고' : '우산을'} 챙겨주세요! ☂️`,
      startTime,
      endTime,
      severity
    };
  }

  return undefined;
}

// 중기예보 정보 가져오기 (3일 후~10일 후)
export async function getMidTermForecast(targetDate?: string): Promise<MidTermForecast | null> {
  try {
    console.log('📅 중기예보 조회 시작');

    // 중기예보 발표 시간 계산 (매일 06시, 18시 발표)
    const now = new Date();
    let tmFcDate = new Date(now);
    let tmFcTime = '0600';
    
    // 현재 시각이 오전 6시 이전이면 전날 18시 발표 사용
    if (now.getHours() < 6) {
      tmFcDate.setDate(tmFcDate.getDate() - 1);
      tmFcTime = '1800';
    } else if (now.getHours() < 18) {
      tmFcTime = '0600';
    } else {
      tmFcTime = '1800';
    }
    
    const tmFc = tmFcDate.getFullYear() + 
                String(tmFcDate.getMonth() + 1).padStart(2, '0') + 
                String(tmFcDate.getDate()).padStart(2, '0') + 
                tmFcTime;
    
    console.log('📅 발표시간 계산:', `현재시각: ${now.toLocaleString()}, 사용할 발표시간: ${tmFc}`);

    // 서울 지역 코드
    const stnId = '108'; // 중기예보용 (전국)
    const regId = '11A00101'; // 중기기온예보용 (서울)

    // 중기예보 (날씨) API 호출
    const weatherUrl = `https://apis.data.go.kr/1360000/MidFcstInfoService/getMidFcst`;
    const weatherParams = new URLSearchParams({
      serviceKey: decodeURIComponent(KMA_MID_API_KEY),
      dataType: 'JSON',
      pageNo: '1',
      numOfRows: '10',
      stnId: stnId,
      tmFc: tmFc
    });

    // 중기기온예보 API 호출
    const tempUrl = `https://apis.data.go.kr/1360000/MidFcstInfoService/getMidTa`;
    const tempParams = new URLSearchParams({
      serviceKey: decodeURIComponent(KMA_MID_API_KEY),
      dataType: 'JSON',
      pageNo: '1',
      numOfRows: '10',
      regId: regId,
      tmFc: tmFc
    });

    console.log('🔑 사용된 API 키:', KMA_MID_API_KEY.substring(0, 10) + '...');
    console.log('🌤️ 중기예보 API 호출:', `${weatherUrl}?${weatherParams}`);
    console.log('🌡️ 중기기온 API 호출:', `${tempUrl}?${tempParams}`);

    // 두 API 병렬 호출
    const [weatherResponse, tempResponse] = await Promise.all([
      fetch(`${weatherUrl}?${weatherParams}`),
      fetch(`${tempUrl}?${tempParams}`)
    ]);

    console.log('🌤️ 중기예보 API 응답 상태:', weatherResponse.status);
    console.log('🌡️ 중기기온 API 응답 상태:', tempResponse.status);

    if (!weatherResponse.ok) {
      throw new Error(`중기예보 API 호출 실패: ${weatherResponse.status}`);
    }

    if (!tempResponse.ok) {
      throw new Error(`중기기온 API 호출 실패: ${tempResponse.status}`);
    }

    const weatherData: KmaMidTermResponse = await weatherResponse.json();
    const tempData: KmaMidTempResponse = await tempResponse.json();

    console.log('🌤️ 중기예보 데이터:', JSON.stringify(weatherData, null, 2));
    console.log('🌡️ 중기기온 데이터:', JSON.stringify(tempData, null, 2));

    if (weatherData.response.header.resultCode !== '00') {
      throw new Error(`중기예보 API 오류: ${weatherData.response.header.resultMsg}`);
    }

    if (tempData.response.header.resultCode !== '00') {
      throw new Error(`중기기온 API 오류: ${tempData.response.header.resultMsg}`);
    }

    const weatherItem = weatherData.response.body.items.item[0];
    const tempItem = tempData.response.body.items.item[0];

    if (!weatherItem || !tempItem) {
      throw new Error('중기예보 데이터가 없습니다');
    }

    // 중기예보 데이터 파싱
    const forecast = parseMidTermForecast(weatherItem, tempItem, targetDate);
    
    console.log('✅ 중기예보 조회 완료');
    return forecast;

  } catch (error) {
    console.error('중기예보 API 호출 실패:', error);
    console.error('중기예보 에러 상세:', JSON.stringify(error, null, 2));
    if (error instanceof Error) {
      console.error('에러 메시지:', error.message);
      console.error('에러 스택:', error.stack);
    }
    return null;
  }
}

// 중기예보 데이터 파싱
function parseMidTermForecast(weatherItem: any, tempItem: any, targetDate?: string): MidTermForecast {
  const baseDate = new Date();
  
  // 5일 후부터 10일 후까지의 예보 데이터 (중기기온예보 기준)
  const days: MidTermDayForecast[] = [];
  
  for (let i = 5; i <= 10; i++) {
    const forecastDate = new Date(baseDate);
    forecastDate.setDate(baseDate.getDate() + i);
    const dateStr = forecastDate.toISOString().split('T')[0];
    
    const dayData: MidTermDayForecast = {
      date: dateStr,
      minTemp: tempItem[`taMin${i}`] || 0,
      maxTemp: tempItem[`taMax${i}`] || 0,
      // 중기예보는 텍스트 설명만 제공하므로 간단한 날씨 표현 사용
      amWeather: '구름많음',
      pmWeather: '구름많음',
      amRainProb: 30, // 기본값 설정
      pmRainProb: 30,
    };
    
    days.push(dayData);
  }

  // 특정 날짜가 요청된 경우 해당 날짜 데이터 찾기
  let targetDayData = days[0]; // 기본값: 5일 후
  if (targetDate) {
    const found = days.find(day => day.date === targetDate);
    if (found) targetDayData = found;
  }

  // 중기예보 종합 설명 추출
  const weatherSummary = weatherItem.wfSv || '중기예보 정보가 없습니다.';

  const forecast: MidTermForecast = {
    location: '서울',
    targetDate: targetDayData.date,
    minTemp: targetDayData.minTemp,
    maxTemp: targetDayData.maxTemp,
    weatherCondition: `${weatherSummary.substring(0, 100)}${weatherSummary.length > 100 ? '...' : ''}`,
    precipitationProbability: Math.max(targetDayData.amRainProb, targetDayData.pmRainProb),
    reliability: 'B', // 중기예보는 보통 신뢰도
    days
  };

  return forecast;
}

// AI 기반 스마트 날씨 질문 분석 (단기 + 중기예보 지원)
export async function analyzeWeatherQuery(userQuery: string, weatherInfo?: WeatherInfo, midTermForecast?: MidTermForecast): Promise<string> {
  try {
    if (!ENV_STATUS.GEMINI_CONFIGURED) {
      return generateBasicWeatherResponse(weatherInfo);
    }

    // 날씨 데이터를 텍스트로 변환
    let weatherData = '';
    
    if (weatherInfo) {
      weatherData += `현재 날씨: ${weatherInfo.currentTemp}°C, ${weatherInfo.description}, 습도 ${weatherInfo.humidity}%, 강수확률 ${weatherInfo.precipitationProbability}%

시간별 예보 (향후 12시간):
${weatherInfo.hourlyForecast.map(h => 
  `${h.time}: ${h.temp}°C, ${h.precipitationType !== '없음' ? h.precipitationType : '맑음'}, 강수확률 ${h.precipitationProbability}%`
).join('\n')}`;
    }
    
    if (midTermForecast) {
      weatherData += `\n\n중기예보 (${midTermForecast.targetDate}):
${midTermForecast.weatherCondition}
최저/최고 기온: ${midTermForecast.minTemp}°C / ${midTermForecast.maxTemp}°C
강수확률: ${midTermForecast.precipitationProbability}%

향후 일주일 예보:
${midTermForecast.days.slice(0, 7).map(day => 
  `${day.date}: ${day.minTemp}°C~${day.maxTemp}°C, 오전 ${day.amRainProb}% / 오후 ${day.pmRainProb}%`
).join('\n')}`;
    }

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
              text: `당신은 친절한 날씨 전문가입니다. 사용자의 날씨 질문에 정확하고 도움이 되는 답변을 해주세요.

사용자 질문: "${userQuery}"

현재 날씨 데이터:
${weatherData}

답변 지침:
1. 사용자가 구체적으로 묻는 것에 정확히 답변 (예: "내일 비오니?" → 내일 강수 여부 중점)
2. 관련된 실용적인 조언 포함 (우산, 옷차림 등)
3. 친근하고 자연스러운 톤으로 답변
4. 이모지 적절히 사용
5. 300자 이내로 간결하게

예시:
- "내일 비오니?" → "내일 오후 2시부터 5시까지 비가 올 예정이에요! ☔ 우산 챙기는 것 잊지 마세요."
- "우산 필요해?" → "네, 향후 3시간 내에 소나기 가능성이 높아요! 🌧️ 우산 챙겨주세요."
- "추워?" → "현재 26°C로 적당히 따뜻해요 😊 얇은 긴팔 정도면 딱 좋을 것 같네요."

답변:`
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

    return aiResponse || generateBasicWeatherResponse(weatherInfo);

  } catch (error) {
    console.error('AI 날씨 분석 오류:', error);
    return generateBasicWeatherResponse(weatherInfo);
  }
}

// 통합 날씨 분석: 날짜에 따라 단기/중기예보 자동 선택
export async function getSmartWeatherResponse(userQuery: string): Promise<string> {
  try {
    console.log('🤖 날씨 질문 분석 중:', userQuery);
    
    // 1단계: Gemini AI로 날짜 및 질문 의도 분석
    const dateAnalysis = await analyzeDateFromQuery(userQuery);
    
    if (dateAnalysis.needsMidTerm) {
      console.log('📅 중기예보 데이터 조회');
      // 3일 이후 질문 → 중기예보 사용
      const midTermForecast = await getMidTermForecast(dateAnalysis.targetDate);
      
      if (midTermForecast) {
        return await analyzeWeatherQuery(userQuery, undefined, midTermForecast);
      } else {
        return '죄송합니다. 해당 날짜의 중기예보 정보를 가져올 수 없습니다. 😅';
      }
    } else {
      console.log('🌤️ 단기예보 데이터 조회');
      // 현재~3일 이내 질문 → 단기예보 사용
      const weatherInfo = await getCurrentWeather();
      
      if (weatherInfo) {
        return await analyzeWeatherQuery(userQuery, weatherInfo);
      } else {
        return '죄송합니다. 현재 날씨 정보를 가져올 수 없습니다. 😅';
      }
    }
  } catch (error) {
    console.error('통합 날씨 분석 오류:', error);
    return '날씨 정보 조회 중 오류가 발생했습니다. 다시 시도해주세요. 😅';
  }
}

// 사용자 질문에서 날짜 분석
async function analyzeDateFromQuery(userQuery: string): Promise<{
  needsMidTerm: boolean;
  targetDate?: string;
  daysFromNow: number;
}> {
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
              text: `사용자의 날씨 질문에서 날짜 정보를 분석해주세요. 오늘 날짜: ${new Date().toISOString().split('T')[0]}

사용자 질문: "${userQuery}"

다음 JSON 형식으로만 응답해주세요:

{
  "needsMidTerm": true/false,
  "targetDate": "YYYY-MM-DD" 또는 null,
  "daysFromNow": 숫자,
  "analysis": "분석 설명"
}

분석 기준:
- "오늘", "내일", "모레": needsMidTerm = false (단기예보)
- "9월6일", "다음주", "5일 후": 3일 이후면 needsMidTerm = true (중기예보)
- 구체적 날짜가 없으면: needsMidTerm = false, daysFromNow = 0

예시:
- "오늘 날씨" → needsMidTerm: false, daysFromNow: 0
- "내일 비와?" → needsMidTerm: false, daysFromNow: 1  
- "9월6일 날씨" → needsMidTerm: true, targetDate: "2025-09-06", daysFromNow: 7
- "다음주 날씨" → needsMidTerm: true, daysFromNow: 7`
            }]
          }]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`날짜 분석 API 실패: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (aiResponse) {
      const cleanResponse = aiResponse.replace(/```json|```/g, '').trim();
      const result = JSON.parse(cleanResponse);
      
      console.log('📅 날짜 분석 결과:', result);
      
      return {
        needsMidTerm: result.needsMidTerm || false,
        targetDate: result.targetDate || undefined,
        daysFromNow: result.daysFromNow || 0
      };
    }

    // AI 실패 시 fallback
    return { needsMidTerm: false, daysFromNow: 0 };

  } catch (error) {
    console.error('날짜 분석 오류:', error);
    // 오류 시 단기예보로 기본 처리
    return { needsMidTerm: false, daysFromNow: 0 };
  }
}

// 기본 날씨 응답 생성 (AI 실패 시 fallback)
function generateBasicWeatherResponse(weatherInfo?: WeatherInfo): string {
  if (!weatherInfo) {
    return '날씨 정보를 가져올 수 없습니다. 😅';
  }
  
  const { currentTemp, description, precipitationProbability, weatherAlert } = weatherInfo;
  
  let response = `🌤️ 현재 ${currentTemp}°C, ${description}입니다.\n`;
  response += `☔ 강수확률은 ${precipitationProbability}%에요.\n\n`;
  
  if (weatherAlert) {
    response += `⚠️ ${weatherAlert.message}`;
  } else if (precipitationProbability >= 70) {
    response += `🌧️ 비가 올 가능성이 높으니 우산을 챙기세요!`;
  } else {
    response += `😊 날씨가 괜찮네요!`;
  }
  
  return response;
}

// 날씨 알림 전송
export async function sendWeatherNotification(weatherAlert: WeatherAlert) {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    
    if (status !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus !== 'granted') {
        console.warn('알림 권한이 거부됨');
        return;
      }
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🌦️ 날씨 알림',
        body: weatherAlert.message,
        data: { weatherAlert },
      },
      trigger: null, // 즉시 알림
    });

    console.log('✅ 날씨 알림 전송:', weatherAlert.message);

  } catch (error) {
    console.error('날씨 알림 전송 실패:', error);
  }
}