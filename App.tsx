import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { 
  registerForPushNotificationsAsync, 
  setupDailyWeatherNotification,
  rescheduleAllNotifications,
  registerBackgroundTasks
} from './src/services/NotificationService';
import TabNavigator from './src/components/TabNavigator';

export default function App() {
  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        // 알림 권한 요청
        await registerForPushNotificationsAsync();
        
        // 매일 아침 8시 날씨 알림 설정
        await setupDailyWeatherNotification();
        
        // 기존 일정 알림들 재설정
        await rescheduleAllNotifications();
        
        // 백그라운드 작업 등록
        await registerBackgroundTasks();
        
        console.log('✅ 알림 초기화 완료');
      } catch (error) {
        console.error('❌ 알림 초기화 오류:', error);
      }
    };

    initializeNotifications();
  }, []);

  return (
    <View style={styles.container}>
      <TabNavigator />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});