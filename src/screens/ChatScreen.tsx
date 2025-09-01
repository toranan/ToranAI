import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseScheduleFromText, chatWithAI, AIResponse, searchTransitRoute, findSchedulesToDelete } from '../services/AIService';
import { getSmartWeatherResponse } from '../services/WeatherService';
import { schedulePushNotification, sendMorningWeatherNotification } from '../services/NotificationService';
import { smartNearbySearch } from '../services/KakaoService';
import PlaceCard from '../components/PlaceCard';
import TransitRouteCard from '../components/TransitRouteCard';
import { Schedule, Message, TransitRoute, PlaceInfo } from '../types';
import { ENV_STATUS } from '../utils/config';

const SCHEDULE_STORAGE_KEY = 'schedules';

export default function ChatScreen({ 
  messages, 
  setMessages, 
  resetChat 
}: { 
  messages: Message[], 
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  resetChat?: () => void
}) {
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    if (!ENV_STATUS.GEMINI_CONFIGURED) {
      addMessage('환경설정 안내: .env 파일에 GEMINI_API_KEY를 설정하시면 AI 대화가 활성화됩니다.', false);
    }
  }, []);

  const loadSchedules = async (): Promise<Schedule[]> => {
    try {
      const storedSchedules = await AsyncStorage.getItem(SCHEDULE_STORAGE_KEY);
      if (storedSchedules) {
        return JSON.parse(storedSchedules).map((s: Schedule) => ({
          ...s,
          date: new Date(s.date),
        }));
      }
      return [];
    } catch (e) {
      console.error("Failed to load schedules.", e);
      return [];
    }
  };

  const saveSchedules = async (schedules: Schedule[]) => {
    try {
      const jsonValue = JSON.stringify(schedules);
      await AsyncStorage.setItem(SCHEDULE_STORAGE_KEY, jsonValue);
    } catch (e) {
      console.error("Failed to save schedules.", e);
    }
  };

  const addMessage = (text: string, isUser: boolean, transitRoutes?: TransitRoute[], places?: PlaceInfo[]) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      isUser,
      timestamp: new Date(),
      transitRoutes,
      places,
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const clearAllSchedules = async () => {
    try {
      await AsyncStorage.removeItem(SCHEDULE_STORAGE_KEY);
      addMessage('모든 일정이 삭제되었습니다. 🗑️✨', false);
    } catch (error) {
      console.error('일정 삭제 오류:', error);
      addMessage('일정 삭제 중 오류가 발생했습니다.', false);
    }
  };

  const handleScheduleAction = async (aiResponse: AIResponse, originalText: string) => {
    const currentSchedules = await loadSchedules();

    switch (aiResponse.action) {
      case 'add':
        if (aiResponse.schedule && aiResponse.schedule.date) {
          const newSchedule: Schedule = {
            id: Date.now().toString(),
            title: aiResponse.schedule.title || '새로운 일정',
            date: aiResponse.schedule.date,
            location: aiResponse.schedule.location,
          };

          const updatedSchedules = [...currentSchedules, newSchedule];
          await saveSchedules(updatedSchedules);
          await schedulePushNotification(newSchedule);

          addMessage(
            `일정이 추가되었습니다! 📅\n\n• ${newSchedule.title}\n⏰ ${newSchedule.date.toLocaleString()}\n${newSchedule.location ? `📍 ${newSchedule.location}` : ''}`,
            false
          );
        }
        break;

      case 'remove':
        // 스마트한 일정 삭제 분석
        const deleteAnalysis = await findSchedulesToDelete(originalText, currentSchedules);
        
        if (deleteAnalysis.shouldDelete && deleteAnalysis.matchedSchedules.length > 0) {
          // 삭제할 일정들의 ID 추출
          const schedulesToDeleteIds = deleteAnalysis.matchedSchedules.map(s => s.id);
          
          // 삭제 실행
          const remainingSchedules = currentSchedules.filter(schedule => 
            !schedulesToDeleteIds.includes(schedule.id)
          );
          
          await saveSchedules(remainingSchedules);
          
          const deletedTitles = deleteAnalysis.matchedSchedules.map(s => `"${s.title}"`).join(', ');
          addMessage(`✅ ${deleteAnalysis.matchedSchedules.length}개의 일정이 삭제되었습니다.\n삭제된 일정: ${deletedTitles} 🗑️`, false);
        } else {
          // 삭제하지 않는 경우 이유 설명
          addMessage(`❌ 일정을 삭제하지 않았습니다.\n이유: ${deleteAnalysis.reason}`, false);
        }
        break;

      case 'list':
        if (currentSchedules.length === 0) {
          addMessage('등록된 일정이 없습니다. 📭', false);
        } else {
          const scheduleList = currentSchedules.map(schedule => 
            `• ${schedule.title}\n  ⏰ ${schedule.date.toLocaleString()}\n  ${schedule.location ? `📍 ${schedule.location}` : ''}`
          ).join('\n\n');
          
          addMessage(`📅 등록된 일정 목록:\n\n${scheduleList}`, false);
        }
        break;

      case 'update':
        addMessage('일정 수정 기능은 곧 추가될 예정입니다. 🔧', false);
        break;

      case 'clear':
        await clearAllSchedules();
        break;

      case 'transit':
        if (aiResponse.transit) {
          const routes = await searchTransitRoute(aiResponse.transit);
          if (routes && routes.length > 0) {
            addMessage(
              `🚇 ${aiResponse.transit.startName || '출발지'}에서 ${aiResponse.transit.endName || '목적지'}까지의 경로를 찾았습니다.`,
              false,
              routes
            );
          } else {
            addMessage('죄송합니다. 경로를 찾을 수 없습니다. 다른 장소명을 시도해보세요.', false);
          }
        } else {
          addMessage('출발지와 도착지를 정확히 입력해주세요. (예: "강남역에서 홍대입구역까지")', false);
        }
        break;

      case 'weather':
        try {
          addMessage('날씨 정보를 조회하고 있습니다... 🌤️', false);
          
          // 스마트 날씨 분석: 날짜 자동 감지하여 단기/중기예보 선택
          const smartWeatherResponse = await getSmartWeatherResponse(originalText);
          addMessage(smartWeatherResponse, false);
          
          // TODO: 날씨 경보 알림은 추후 개선 예정
        } catch (error) {
          console.error('날씨 조회 오류:', error);
          addMessage('날씨 정보 조회 중 오류가 발생했습니다. 😅', false);
        }
        break;

      case 'notification_test':
        try {
          addMessage('아침 날씨 알림을 테스트합니다... 🔔', false);
          await sendMorningWeatherNotification();
          addMessage('테스트 알림이 전송되었습니다! 알림을 확인해보세요. 📱', false);
        } catch (error) {
          console.error('알림 테스트 오류:', error);
          addMessage('알림 테스트 중 오류가 발생했습니다. 😅', false);
        }
        break;

      case 'nearby':
        try {
          const keyword = aiResponse.nearby?.keyword || '편의점';
          addMessage(`${keyword} 주변 정보를 검색하고 있습니다... 📍`, false);
          
          const places = await smartNearbySearch(keyword);
          if (places && places.length > 0) {
            addMessage(
              `📍 근처 ${keyword} ${places.length}개를 찾았습니다.`,
              false,
              undefined,
              places
            );
          } else {
            addMessage(`죄송합니다. 근처에서 ${keyword}을(를) 찾을 수 없습니다. 😅`, false);
          }
        } catch (error) {
          console.error('주변 정보 검색 오류:', error);
          addMessage('주변 정보 검색 중 오류가 발생했습니다. 😅', false);
        }
        break;

      default:
        const chatResponse = await chatWithAI(aiResponse.message || '알 수 없는 명령입니다.');
        addMessage(chatResponse, false);
    }
  };


  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    addMessage(inputText, true);
    const userInput = inputText;
    setInputText('');

    try {
      const aiResponse: AIResponse = await parseScheduleFromText(userInput);

      if (aiResponse.isSchedule || aiResponse.isTransit || aiResponse.isWeather || aiResponse.isNearby) {
        await handleScheduleAction(aiResponse, userInput);
      } else {
        const chatResponse = await chatWithAI(userInput);
        addMessage(chatResponse, false);
      }
    } catch (error) {
      console.error('메시지 처리 오류:', error);
      addMessage(
        '죄송합니다. 메시지 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
        false
      );
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[
      styles.messageContainer,
      item.isUser ? styles.userMessage : styles.aiMessage
    ]}>
      <Text style={[
        styles.messageText,
        item.isUser ? styles.userMessageText : styles.aiMessageText
      ]}>
        {item.text}
      </Text>
      
      {/* 교통 정보 카드 렌더링 */}
      {item.transitRoutes && item.transitRoutes.length > 0 && (
        <View style={styles.transitContainer}>
          {item.transitRoutes.map((route, index) => (
            <TransitRouteCard 
              key={index}
              route={route}
              startName={route.info.firstStartStation}
              endName={route.info.lastEndStation}
            />
          ))}
        </View>
      )}

      {/* 주변 장소 정보 카드 렌더링 */}
      {item.places && item.places.length > 0 && (
        <View style={styles.placesContainer}>
          {item.places.map((place, index) => (
            <PlaceCard 
              key={place.id || index}
              place={place}
            />
          ))}
        </View>
      )}
      
      <Text style={styles.timestamp}>
        {item.timestamp.toLocaleTimeString()}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>AI 어시스턴트</Text>
            <Text style={styles.headerSubtitle}>일정 관리 • 교통 정보 검색</Text>
          </View>
          {resetChat && (
            <TouchableOpacity style={styles.resetButton} onPress={resetChat}>
              <Text style={styles.resetButtonText}>🔄</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContainer}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="메시지를 입력하세요..."
          multiline
          maxLength={500}
        />
        <TouchableOpacity 
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!inputText.trim()}
        >
          <Text style={styles.sendButtonText}>전송</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#667eea',
    padding: 20,
    paddingTop: 50,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextContainer: {
    flex: 1,
    alignItems: 'center',
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
  resetButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 22,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  resetButtonText: {
    fontSize: 18,
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    padding: 16,
  },
  messageContainer: {
    maxWidth: '85%',
    padding: 16,
    borderRadius: 20,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#667eea',
    borderBottomRightRadius: 6,
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderBottomLeftRadius: 6,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  userMessageText: {
    color: 'white',
  },
  aiMessageText: {
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  transitContainer: {
    marginTop: 12,
    marginHorizontal: -4,
  },
  placesContainer: {
    marginTop: 12,
    marginHorizontal: -4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginRight: 12,
    maxHeight: 120,
    fontSize: 16,
    backgroundColor: '#f8fafc',
    color: '#2d3748',
  },
  sendButton: {
    backgroundColor: '#667eea',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
    shadowColor: '#667eea',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#a0aec0',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
