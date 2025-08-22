import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { registerForPushNotificationsAsync } from './src/services/NotificationService';
import TabNavigator from './src/components/TabNavigator';

export default function App() {
  useEffect(() => {
    registerForPushNotificationsAsync();
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