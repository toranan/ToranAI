import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { TransitRoute } from '../types';

interface TransitRouteCardProps {
  route: TransitRoute;
  startName?: string;
  endName?: string;
}

const TransitRouteCard: React.FC<TransitRouteCardProps> = ({ route, startName, endName }) => {
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`;
  };

  const formatCost = (cost: number) => {
    return `${cost.toLocaleString()}원`;
  };

  const getTrafficTypeIcon = (type: number) => {
    switch (type) {
      case 1: return '🚇'; // 지하철
      case 2: return '🚌'; // 버스
      case 3: return '🚶'; // 도보
      default: return '🚶';
    }
  };

  const getTrafficTypeName = (type: number) => {
    switch (type) {
      case 1: return '지하철';
      case 2: return '버스';
      case 3: return '도보';
      default: return '이동';
    }
  };

  const getBusTypeColor = (type?: number) => {
    switch (type) {
      case 1: return '#3498db'; // 간선버스 (파랑)
      case 2: return '#2ecc71'; // 지선버스 (초록)
      case 3: return '#e74c3c'; // 광역버스 (빨강)
      case 4: return '#f39c12'; // 순환버스 (노랑)
      case 5: return '#9b59b6'; // 마을버스 (보라)
      case 6: return '#1abc9c'; // 공항버스 (청록)
      default: return '#34495e';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.routeInfo}>
          <Text style={styles.routeTitle}>
            {startName || '출발'} → {endName || '도착'}
          </Text>
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryText}>
              ⏱️ {formatTime(route.info.totalTime)}
            </Text>
            <Text style={styles.summaryText}>
              💰 {formatCost(route.info.payment)}
            </Text>
            <Text style={styles.summaryText}>
              🚶 {route.info.totalWalk}m
            </Text>
          </View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pathContainer}>
        <View style={styles.pathItems}>
          {route.subPath.map((path, index) => (
            <React.Fragment key={index}>
              <View style={styles.pathItem}>
                <View style={styles.pathIcon}>
                  <Text style={styles.pathIconText}>
                    {getTrafficTypeIcon(path.trafficType)}
                  </Text>
                </View>
                
                <View style={styles.pathContent}>
                  <Text style={styles.pathType}>
                    {getTrafficTypeName(path.trafficType)}
                  </Text>
                  
                  {path.trafficType === 3 ? (
                    // 도보
                    <Text style={styles.pathDetail}>
                      {path.distance}m ({path.sectionTime}분)
                    </Text>
                  ) : path.trafficType === 1 ? (
                    // 지하철
                    <View>
                      <Text style={styles.pathDetail}>
                        {path.startName} → {path.endName}
                      </Text>
                      <Text style={styles.pathTime}>
                        {path.sectionTime}분 ({path.stationCount || 0}개 역)
                      </Text>
                      {path.way && (
                        <Text style={styles.pathWay}>{path.way}행</Text>
                      )}
                    </View>
                  ) : (
                    // 버스
                    <View>
                      <Text style={styles.pathDetail}>
                        {path.startName} → {path.endName}
                      </Text>
                      <Text style={styles.pathTime}>
                        {path.sectionTime}분 ({path.stationCount || 0}개 정류장)
                      </Text>
                      {path.lane && path.lane.length > 0 && (
                        <View style={styles.busLanes}>
                          {path.lane.map((lane, laneIndex) => (
                            <View 
                              key={laneIndex} 
                              style={[
                                styles.busLane,
                                { backgroundColor: getBusTypeColor(lane.type) }
                              ]}
                            >
                              <Text style={styles.busLaneText}>{lane.name}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
              
              {index < route.subPath.length - 1 && (
                <View style={styles.pathArrow}>
                  <Text style={styles.pathArrowText}>→</Text>
                </View>
              )}
            </React.Fragment>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          🚇 {route.info.subwayCount}회 🚌 {route.info.busCount}회 환승
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    marginBottom: 16,
  },
  routeInfo: {
    flexDirection: 'column',
  },
  routeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  summaryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryText: {
    fontSize: 14,
    color: '#7f8c8d',
    backgroundColor: '#ecf0f1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pathContainer: {
    marginBottom: 16,
  },
  pathItems: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pathItem: {
    alignItems: 'center',
    minWidth: 100,
    paddingHorizontal: 8,
  },
  pathIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  pathIconText: {
    fontSize: 20,
  },
  pathContent: {
    alignItems: 'center',
  },
  pathType: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  pathDetail: {
    fontSize: 11,
    color: '#34495e',
    textAlign: 'center',
    marginBottom: 2,
  },
  pathTime: {
    fontSize: 10,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  pathWay: {
    fontSize: 10,
    color: '#e74c3c',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  busLanes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 4,
  },
  busLane: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    margin: 2,
  },
  busLaneText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  pathArrow: {
    marginHorizontal: 8,
  },
  pathArrowText: {
    fontSize: 16,
    color: '#bdc3c7',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
    paddingTop: 12,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#95a5a6',
  },
});

export default TransitRouteCard;