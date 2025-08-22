import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Schedule } from '../types';

const SCHEDULE_STORAGE_KEY = 'schedules';

export default function ScheduleScreen() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSchedules = async () => {
    try {
      setLoading(true);
      const storedSchedules = await AsyncStorage.getItem(SCHEDULE_STORAGE_KEY);
      if (storedSchedules) {
        const parsedSchedules = JSON.parse(storedSchedules).map((s: Schedule) => ({
          ...s,
          date: new Date(s.date),
        }));
        setSchedules(parsedSchedules);
      } else {
        setSchedules([]);
      }
    } catch (e) {
      console.error("Failed to load schedules.", e);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  const saveSchedules = async (newSchedules: Schedule[]) => {
    try {
      const jsonValue = JSON.stringify(newSchedules);
      await AsyncStorage.setItem(SCHEDULE_STORAGE_KEY, jsonValue);
      setSchedules(newSchedules);
    } catch (e) {
      console.error("Failed to save schedules.", e);
    }
  };

  const deleteSchedule = (scheduleId: string) => {
    Alert.alert(
      "일정 삭제",
      "이 일정을 삭제하시겠습니까?",
      [
        { text: "취소", style: "cancel" },
        { 
          text: "삭제", 
          style: "destructive",
          onPress: () => {
            const updatedSchedules = schedules.filter(s => s.id !== scheduleId);
            saveSchedules(updatedSchedules);
          }
        }
      ]
    );
  };

  // 컴포넌트가 마운트될 때 일정 로드
  useEffect(() => {
    loadSchedules();
  }, []);

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `오늘 ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `내일 ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === -1) {
      return `어제 ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays > 0) {
      return `${diffDays}일 후 ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return `${Math.abs(diffDays)}일 전 ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  };

  const getStatusColor = (date: Date) => {
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    
    if (diffTime < 0) {
      return '#999'; // 지난 일정 - 회색
    } else if (diffTime < 24 * 60 * 60 * 1000) {
      return '#ff6b6b'; // 오늘 일정 - 빨간색
    } else if (diffTime < 7 * 24 * 60 * 60 * 1000) {
      return '#ffa726'; // 일주일 내 - 주황색
    } else {
      return '#66bb6a'; // 미래 일정 - 초록색
    }
  };

  const renderScheduleItem = ({ item }: { item: Schedule }) => (
    <TouchableOpacity 
      style={[styles.scheduleItem, { borderLeftColor: getStatusColor(item.date) }]}
      onLongPress={() => deleteSchedule(item.id)}
    >
      <View style={styles.scheduleContent}>
        <Text style={styles.scheduleTitle}>{item.title}</Text>
        <Text style={styles.scheduleDate}>{formatDate(item.date)}</Text>
        {item.location && (
          <Text style={styles.scheduleLocation}>📍 {item.location}</Text>
        )}
      </View>
      <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(item.date) }]} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>내 일정</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>일정을 불러오는 중...</Text>
        </View>
      </View>
    );
  }

  const sortedSchedules = schedules.sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>내 일정</Text>
        <Text style={styles.headerSubtitle}>총 {schedules.length}개의 일정</Text>
      </View>

      {schedules.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyTitle}>등록된 일정이 없습니다</Text>
          <Text style={styles.emptySubtitle}>AI 대화창에서 일정을 추가해보세요!</Text>
        </View>
      ) : (
        <FlatList
          data={sortedSchedules}
          renderItem={renderScheduleItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#6c5ce7',
    padding: 20,
    paddingTop: 50,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  listContainer: {
    padding: 16,
  },
  scheduleItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderLeftWidth: 4,
  },
  scheduleContent: {
    flex: 1,
  },
  scheduleTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  scheduleDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  scheduleLocation: {
    fontSize: 14,
    color: '#888',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 12,
  },
});
