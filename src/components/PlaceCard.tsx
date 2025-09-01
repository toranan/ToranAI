import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Linking } from 'react-native';
import { PlaceInfo, formatDistance, estimateWalkingTime, getCategoryName } from '../services/KakaoService';

interface PlaceCardProps {
  place: PlaceInfo;
  onPress?: () => void;
}

export default function PlaceCard({ place, onPress }: PlaceCardProps) {
  const handleCall = () => {
    if (place.phone) {
      Linking.openURL(`tel:${place.phone}`);
    }
  };

  const handleOpenMap = () => {
    if (place.place_url) {
      Linking.openURL(place.place_url);
    } else {
      // 카카오맵 좌표로 링크 생성
      const mapUrl = `https://map.kakao.com/link/map/${place.place_name},${place.y},${place.x}`;
      Linking.openURL(mapUrl);
    }
  };

  const getCategoryIcon = (categoryCode: string): string => {
    const icons: { [key: string]: string } = {
      'CS2': '🏪', // 편의점
      'FD6': '🍽️', // 음식점
      'CE7': '☕', // 카페
      'HP8': '🏥', // 병원
      'PM9': '💊', // 약국
      'OL7': '⛽', // 주유소
      'SW8': '🚇', // 지하철역
      'BK9': '🏦', // 은행
      'CT1': '🎭', // 문화시설
      'AT4': '🗽', // 관광명소
      'AD5': '🏨', // 숙박
      'MT1': '🛒', // 대형마트
      'SC4': '🏫', // 학교
      'AC5': '📚', // 학원
      'PK6': '🅿️', // 주차장
    };
    
    return icons[categoryCode] || '📍';
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.icon}>
            {getCategoryIcon(place.category_group_code)}
          </Text>
          <View style={styles.titleContainer}>
            <Text style={styles.placeName} numberOfLines={1}>
              {place.place_name}
            </Text>
            <Text style={styles.category}>
              {getCategoryName(place.category_group_code)}
            </Text>
          </View>
        </View>
        
        <View style={styles.distanceContainer}>
          <Text style={styles.distance}>
            {formatDistance(place.distance)}
          </Text>
          <Text style={styles.walkTime}>
            {estimateWalkingTime(place.distance)}
          </Text>
        </View>
      </View>

      <View style={styles.addressContainer}>
        <Text style={styles.address} numberOfLines={1}>
          📍 {place.road_address_name || place.address_name}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        {place.phone && (
          <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
            <Text style={styles.actionButtonText}>📞 전화</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.mapButton]} 
          onPress={handleOpenMap}
        >
          <Text style={[styles.actionButtonText, styles.mapButtonText]}>
            🗺️ 지도
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f2f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    fontSize: 20,
    marginRight: 8,
  },
  titleContainer: {
    flex: 1,
  },
  placeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 2,
  },
  category: {
    fontSize: 12,
    color: '#718096',
    backgroundColor: '#f7fafc',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  distanceContainer: {
    alignItems: 'flex-end',
  },
  distance: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 2,
  },
  walkTime: {
    fontSize: 11,
    color: '#a0aec0',
  },
  addressContainer: {
    marginBottom: 12,
  },
  address: {
    fontSize: 13,
    color: '#4a5568',
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#f7fafc',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mapButton: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4a5568',
  },
  mapButtonText: {
    color: '#ffffff',
  },
});