# ToranAI - AI 어시스턴트 & 일정 관리 앱

## 📱 프로젝트 소개

ToranAI는 Gemini AI를 활용한 지능형 어시스턴트와 일정 관리 기능을 제공하는 React Native 앱입니다.

### ✨ 주요 기능

- **🤖 AI 대화**: Gemini 2.5 Flash/Pro를 활용한 자연어 대화
- **📅 일정 관리**: 자연어로 일정 추가 및 관리
- **🔔 푸시 알림**: 일정 시간에 맞춘 알림 서비스
- **🗺️ 지도 서비스**: Kakao Map API 연동
- **📱 크로스 플랫폼**: iOS, Android, Web 지원

## 🏗️ 앱 구조

```
src/
├── components/          # 재사용 가능한 컴포넌트
│   └── TabNavigator.tsx # 탭 네비게이션
├── screens/            # 화면 컴포넌트
│   ├── ChatScreen.tsx  # AI 대화 화면
│   └── ScheduleScreen.tsx # 일정 관리 화면
├── services/           # 비즈니스 로직
│   ├── AIService.ts    # Gemini AI 연동
│   └── NotificationService.ts # 푸시 알림
├── types/              # TypeScript 타입 정의
└── utils/              # 유틸리티 함수
    └── config.ts       # API 설정
```

## 🚀 설치 및 실행

### 1. 저장소 클론
```bash
git clone https://github.com/toranan/ToranAI.git
cd ToranAI
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경변수 설정
`.env.example` 파일을 `.env`로 복사하고 필요한 API 키를 입력하세요:

```bash
cp .env.example .env
```

필요한 API 키:
- **Gemini API**: Google AI Studio에서 발급
- **Kakao Map API**: Kakao Developers에서 발급

### 4. 앱 실행

#### 웹 브라우저
```bash
npx expo start --web
```

#### iOS 시뮬레이터
```bash
npx expo run:ios
```

#### Android 에뮬레이터
```bash
npx expo run:android
```

## 💡 사용법

### AI 대화
- 자연어로 일정을 추가할 수 있습니다
- 예: "내일 오후 3시에 팀 회의", "다음 주 금요일 저녁 7시에 친구와 저녁식사"

### 일정 관리
- 추가된 일정을 한눈에 확인
- 일정별 상태 표시 (오늘, 내일, 미래)
- 길게 누르면 일정 삭제

## 🔧 기술 스택

- **Frontend**: React Native, Expo
- **AI**: Google Gemini 2.5 Flash/Pro
- **지도**: Kakao Map API
- **알림**: Expo Notifications
- **저장소**: AsyncStorage
- **언어**: TypeScript

## 📱 지원 플랫폼

- ✅ iOS
- ✅ Android  
- ✅ Web

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 📞 문의

프로젝트에 대한 문의사항이 있으시면 이슈를 생성해 주세요.

---

**ToranAI** - AI로 더 스마트한 일정 관리 🚀
