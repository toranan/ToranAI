import * as Notifications from 'expo-notifications';
import { Schedule } from '../types';

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
  // 일단 알림 기능을 비활성화하고 로그만 출력
  console.log(`알림 예약됨: ${schedule.title} - ${schedule.date.toLocaleString()}`);
  
  // TODO: 나중에 알림 기능 활성화
  /*
  const triggerDate = new Date(schedule.date);
  triggerDate.setMinutes(triggerDate.getMinutes() - 10);

  if (triggerDate.getTime() <= Date.now()) {
    console.log('일정이 과거 시간이므로 알림을 설정하지 않습니다.');
    return;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '일정 알림 📅',
        body: `10분 후에 "${schedule.title}"${schedule.location ? ` (${schedule.location})` : ''} 일정이 있습니다.`,
        data: { scheduleId: schedule.id },
      },
      trigger: { 
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.floor((triggerDate.getTime() - Date.now()) / 1000) 
      },
    });
    console.log(`알림이 설정되었습니다: ${schedule.title} - ${triggerDate.toLocaleString()}`);
  } catch (error) {
    console.error('알림 설정 오류:', error);
  }
  */
}
