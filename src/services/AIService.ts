import { Schedule } from '../types';
import { API_CONFIG } from '../utils/config';

// AI API를 사용한 자연어 처리 및 일정 파싱
export async function parseScheduleFromText(text: string): Promise<Partial<Schedule>> {
  try {
    // Gemini API 호출
    const response = await fetch(
      `${API_CONFIG.GEMINI.BASE_URL}/gemini-pro:generateContent?key=${API_CONFIG.GEMINI.API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `다음 텍스트에서 일정 정보를 추출해주세요. JSON 형태로만 응답해주세요.

텍스트: "${text}"

응답 형식:
{
  "title": "일정 제목",
  "date": "YYYY-MM-DD HH:MM:SS 형태의 날짜",
  "location": "장소 (선택사항)"
}

현재 날짜: ${new Date().toISOString()}
만약 상대적 날짜(내일, 모레 등)가 포함되어 있다면 절대 날짜로 변환해주세요.
시간이 명시되지 않았다면 적절한 시간을 추정해주세요.
일정과 관련없는 내용이라면 null을 반환해주세요.`
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

      if (parsedResult === null || !parsedResult.title) {
        return { title: text }; // 일정으로 인식되지 않은 경우
      }

      return {
        title: parsedResult.title,
        date: parsedResult.date ? new Date(parsedResult.date) : undefined,
        location: parsedResult.location,
      };
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      return fallbackParsing(text);
    }

  } catch (error) {
    console.error('AI API 오류:', error);
    // API 실패 시 fallback 함수 사용
    return fallbackParsing(text);
  }
}

// AI API 실패 시 사용할 기본 파싱 함수
function fallbackParsing(text: string): Partial<Schedule> {
  const now = new Date();
  const lowerCaseText = text.toLowerCase();

  let date = new Date(now);
  let hours = -1;
  let minutes = 0;

  // 기본 날짜 파싱
  if (lowerCaseText.includes('내일')) {
    date.setDate(now.getDate() + 1);
  } else if (lowerCaseText.includes('모레')) {
    date.setDate(now.getDate() + 2);
  }

  // 기본 시간 파싱 (예: "오후 3시 30분", "15시")
  const timeRegex = /(\d{1,2})시(?:\s*(\d{1,2})분)?/;
  const timeMatch = lowerCaseText.match(timeRegex);

  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;

    if (lowerCaseText.includes('오후') && hours < 12) {
      hours += 12;
    }
  }

  if (hours !== -1) {
    date.setHours(hours, minutes, 0, 0);
  } else {
    // 시간이 명시되지 않으면 적절한 기본 시간 설정
    date.setHours(9, 0, 0, 0); // 오전 9시 기본
  }

  return {
    title: text,
    date: date,
  };
}

// AI와의 일반적인 대화를 위한 함수
export async function chatWithAI(message: string): Promise<string> {
  try {
    const response = await fetch(
      `${API_CONFIG.GEMINI.BASE_URL}/gemini-pro:generateContent?key=${API_CONFIG.GEMINI.API_KEY}`,
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