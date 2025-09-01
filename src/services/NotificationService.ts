import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { Schedule } from '../types';
import { getCurrentWeather, WeatherInfo } from './WeatherService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DAILY_WEATHER_NOTIFICATION = 'daily-weather-notification';
const BACKGROUND_WEATHER_TASK = 'background-weather-task';
const SCHEDULE_STORAGE_KEY = 'schedules';

// 백그라운드 작업 정의
TaskManager.defineTask(BACKGROUND_WEATHER_TASK, async () => {
  try {
    console.log('🔄 백그라운드 날씨 알림 작업 실행');
    
    const now = new Date();
    const currentHour = now.getHours();
    
    // 오전 8시에만 날씨 알림 전송
    if (currentHour === 8) {
      await sendMorningWeatherNotification();
      console.log('✅ 백그라운드에서 아침 날씨 알림 전송 완료');
    }
    
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('❌ 백그라운드 날씨 작업 오류:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  let token;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    alert('Failed to get push token for push notification!');
    return;
  }
  token = (await Notifications.getExpoPushTokenAsync()).data;
  console.log(token);

  return token;
}

export async function schedulePushNotification(schedule: Schedule) {
  const triggerDate = new Date(schedule.date);
  triggerDate.setHours(triggerDate.getHours() - 1);

  if (triggerDate.getTime() <= Date.now()) {
    console.log('일정이 과거 시간이므로 알림을 설정하지 않습니다.');
    return;
  }

  try {
    const secondsUntilTrigger = Math.floor((triggerDate.getTime() - Date.now()) / 1000);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '일정 알림 📅',
        body: `1시간 후에 "${schedule.title}"${schedule.location ? ` (${schedule.location})` : ''} 일정이 예정되어있습니다. 잊지 않으셨나요?`,
        data: { scheduleId: schedule.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntilTrigger,
      },
    });
    console.log(`알림이 설정되었습니다: ${schedule.title} - ${triggerDate.toLocaleString()}`);
  } catch (error) {
    console.error('알림 설정 오류:', error);
  }
}

// 날씨 정보를 포맷팅하는 함수
function formatWeatherMessage(weatherInfo: WeatherInfo): string {
  let message = `안녕하세요! 좋은 아침입니다 ☀️\n\n오늘 날씨에 대한 정보를 알려드리겠습니다.\n\n`;
  
  message += `🌡️ 현재 기온: ${weatherInfo.currentTemp}°C\n`;
  message += `☁️ 날씨: ${weatherInfo.description}\n`;
  message += `💧 습도: ${weatherInfo.humidity}%\n`;
  message += `☔ 강수확률: ${weatherInfo.precipitationProbability}%\n`;
  
  if (weatherInfo.precipitation > 0) {
    message += `🌧️ 예상 강수량: ${weatherInfo.precipitation}mm\n`;
  }
  
  // 우천 정보 추가
  if (weatherInfo.precipitationProbability >= 70 || weatherInfo.precipitation > 0) {
    message += `\n⚠️ 비가 올 예정이니 우산을 꼭 챙기세요! ☂️`;
  } else if (weatherInfo.precipitationProbability >= 30) {
    message += `\n☁️ 구름이 많으니 혹시 모르니 우산을 준비해주세요.`;
  } else {
    message += `\n😊 맑은 하루가 될 것 같아요! 좋은 하루 되세요!`;
  }
  
  // 날씨 경보가 있는 경우 추가
  if (weatherInfo.weatherAlert) {
    message += `\n\n🚨 ${weatherInfo.weatherAlert.message}`;
  }
  
  return message;
}

// 매일 아침 8시 날씨 알림 설정
export async function setupDailyWeatherNotification() {
  try {
    // 기존 일일 알림 취소
    await Notifications.cancelScheduledNotificationAsync(DAILY_WEATHER_NOTIFICATION);
    
    const now = new Date();
    const next8AM = new Date();
    next8AM.setHours(8, 0, 0, 0);
    
    // 이미 오늘 8시가 지났다면 내일 8시로 설정
    if (now.getTime() >= next8AM.getTime()) {
      next8AM.setDate(next8AM.getDate() + 1);
    }
    
    const secondsUntilTrigger = Math.floor((next8AM.getTime() - now.getTime()) / 1000);
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '좋은 아침입니다! 🌅',
        body: '오늘의 날씨 정보를 확인해보세요',
        data: { type: 'daily_weather' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntilTrigger,
        repeats: true,
      },
      identifier: DAILY_WEATHER_NOTIFICATION,
    });
    
    console.log(`일일 날씨 알림이 설정되었습니다: 매일 오전 8시`);
  } catch (error) {
    console.error('일일 날씨 알림 설정 오류:', error);
  }
}

// 즉시 아침 날씨 알림 전송 (테스트용)
export async function sendMorningWeatherNotification() {
  try {
    const weatherInfo = await getCurrentWeather();
    
    if (weatherInfo) {
      const message = formatWeatherMessage(weatherInfo);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '오늘의 날씨 정보 🌤️',
          body: message,
          data: { type: 'weather_info' },
        },
        trigger: null, // 즉시 알림
      });
      
      console.log('아침 날씨 알림이 전송되었습니다.');
    } else {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '날씨 알림 ⚠️',
          body: '안녕하세요! 좋은 아침입니다.\n\n죄송합니다. 현재 날씨 정보를 가져올 수 없습니다.',
          data: { type: 'weather_error' },
        },
        trigger: null,
      });
    }
  } catch (error) {
    console.error('아침 날씨 알림 전송 오류:', error);
  }
}

// 모든 예정된 일정에 대한 알림 재설정
export async function rescheduleAllNotifications() {
  try {
    // 기존 모든 알림 취소 (일일 날씨 알림 제외)
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    for (const notification of scheduledNotifications) {
      if (notification.identifier !== DAILY_WEATHER_NOTIFICATION) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
    
    // 저장된 일정들을 다시 불러와서 알림 재설정
    const storedSchedules = await AsyncStorage.getItem(SCHEDULE_STORAGE_KEY);
    if (storedSchedules) {
      const schedules: Schedule[] = JSON.parse(storedSchedules).map((s: Schedule) => ({
        ...s,
        date: new Date(s.date),
      }));
      
      // 각 일정에 대해 알림 재설정
      for (const schedule of schedules) {
        await schedulePushNotification(schedule);
      }
      
      console.log(`${schedules.length}개 일정의 알림이 재설정되었습니다.`);
    }
  } catch (error) {
    console.error('일정 알림 재설정 오류:', error);
  }
}

// 백그라운드 작업 등록
export async function registerBackgroundTasks() {
  try {
    // 백그라운드 페치 상태 확인
    const status = await BackgroundFetch.getStatusAsync();
    
    if (status === BackgroundFetch.BackgroundFetchStatus.Restricted || 
        status === BackgroundFetch.BackgroundFetchStatus.Denied) {
      console.warn('백그라운드 작업 권한이 제한됨');
      return;
    }

    // 백그라운드 작업 등록
    await BackgroundFetch.registerTaskAsync(BACKGROUND_WEATHER_TASK, {
      minimumInterval: 60 * 60 * 1000, // 1시간마다 실행
      stopOnTerminate: false,
      startOnBoot: true,
    });
    
    console.log('✅ 백그라운드 날씨 작업이 등록되었습니다.');
  } catch (error) {
    console.error('❌ 백그라운드 작업 등록 오류:', error);
  }
}
