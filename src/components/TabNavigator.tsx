import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ChatScreen from '../screens/ChatScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import { Message } from '../types';

type TabType = 'chat' | 'schedule';

const MESSAGES_STORAGE_KEY = 'chat_messages';

export default function TabNavigator() {
  const [activeTab, setActiveTab] = useState<TabType>('chat');
  const [messages, setMessages] = useState<Message[]>([]);

  const loadMessages = async () => {
    try {
      const storedMessages = await AsyncStorage.getItem(MESSAGES_STORAGE_KEY);
      if (storedMessages) {
        const parsedMessages = JSON.parse(storedMessages).map((msg: Message) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        setMessages(parsedMessages);
      } else {
        const initialMessage: Message = {
          id: '1',
          text: '안녕하세요? 사용자님의 개인 AI비서 토란입니다! 원하시는 명령을 해주세요!',
          isUser: false,
          timestamp: new Date(),
        };
        setMessages([initialMessage]);
      }
    } catch (error) {
      console.error('메시지 로딩 오류:', error);
      const initialMessage: Message = {
        id: '1',
        text: '안녕하세요? 사용자님의 개인 AI비서 토란입니다! 원하시는 명령을 해주세요!',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages([initialMessage]);
    }
  };

  const saveMessages = async (newMessages: Message[]) => {
    try {
      const jsonValue = JSON.stringify(newMessages);
      await AsyncStorage.setItem(MESSAGES_STORAGE_KEY, jsonValue);
    } catch (error) {
      console.error('메시지 저장 오류:', error);
    }
  };

  const handleMessagesUpdate = (newMessages: Message[] | ((prev: Message[]) => Message[])) => {
    let messagesToSave: Message[];
    
    if (typeof newMessages === 'function') {
      setMessages(prev => {
        const result = newMessages(prev);
        messagesToSave = result;
        saveMessages(result);
        return result;
      });
    } else {
      messagesToSave = newMessages;
      setMessages(newMessages);
      saveMessages(newMessages);
    }
  };

  const resetChat = async () => {
    try {
      await AsyncStorage.removeItem(MESSAGES_STORAGE_KEY);
      const initialMessage: Message = {
        id: Date.now().toString(),
        text: '안녕하세요? 사용자님의 개인 AI비서 토란입니다! 원하시는 명령을 해주세요!',
        isUser: false,
        timestamp: new Date(),
      };
      const newMessages = [initialMessage];
      setMessages(newMessages);
      await saveMessages(newMessages);
    } catch (error) {
      console.error('채팅 리셋 오류:', error);
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const renderScreen = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatScreen messages={messages} setMessages={handleMessagesUpdate} resetChat={resetChat} />;
      case 'schedule':
        return <ScheduleScreen />;
      default:
        return <ChatScreen messages={messages} setMessages={handleMessagesUpdate} resetChat={resetChat} />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.screenContainer}>
        {renderScreen()}
      </View>
      
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'chat' && styles.activeTab]}
          onPress={() => setActiveTab('chat')}
        >
          <Text style={[styles.tabText, activeTab === 'chat' && styles.activeTabText]}>
            💬 AI 대화
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'schedule' && styles.activeTab]}
          onPress={() => setActiveTab('schedule')}
        >
          <Text style={[styles.tabText, activeTab === 'schedule' && styles.activeTabText]}>
            📅 내 일정
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTab: {
    backgroundColor: '#f0f8ff',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#4a90e2',
    fontWeight: 'bold',
  },
});
