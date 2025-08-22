import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseScheduleFromText, chatWithAI } from '../services/AIService';
import { schedulePushNotification } from '../services/NotificationService';
import { Schedule } from '../types';
import { ENV_STATUS } from '../utils/config';

const SCHEDULE_STORAGE_KEY = 'schedules';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: '안녕하세요? 사용자님의 개인 AI비서 토란입니다! 원하시는 명령을 해주세요!',
      isUser: false,
      timestamp: new Date(),
    },
  ]);
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

  const addMessage = (text: string, isUser: boolean) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      isUser,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    addMessage(inputText, true);
    const userInput = inputText;
    setInputText('');

    try {
      const parsedSchedule = await parseScheduleFromText(userInput);

      if (parsedSchedule.date) {
        const currentSchedules = await loadSchedules();
        const newSchedule: Schedule = {
          id: Date.now().toString(),
          title: parsedSchedule.title || '새로운 일정',
          date: parsedSchedule.date,
          location: parsedSchedule.location,
        };

        const updatedSchedules = [...currentSchedules, newSchedule];
        await saveSchedules(updatedSchedules);
        await schedulePushNotification(newSchedule);

        addMessage(
          `일정이 추가되었습니다! 📅\n\n• ${newSchedule.title}\n⏰ ${newSchedule.date.toLocaleString()}\n${newSchedule.location ? `📍 ${newSchedule.location}` : ''}`,
          false
        );
      } else {
        const aiResponse = await chatWithAI(userInput);
        addMessage(aiResponse, false);
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
        <Text style={styles.headerTitle}>AI 어시스턴트</Text>
        <Text style={styles.headerSubtitle}>일정을 자연어로 추가해보세요</Text>
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4a90e2',
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
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    padding: 16,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#4a90e2',
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#4a90e2',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
