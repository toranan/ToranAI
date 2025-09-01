export interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  transitRoutes?: TransitRoute[];
  places?: PlaceInfo[];
}

export interface PlaceInfo {
  id: string;
  place_name: string;
  category_name: string;
  category_group_code: string;
  category_group_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
  place_url: string;
  distance: string;
  rating?: number;
}

export interface Schedule {
  id: string;
  title: string;
  date: Date;
  location?: string;
}

export interface TransitRoute {
  pathType: number;
  info: {
    mapObj: string;
    firstStartStation: string;
    lastEndStation: string;
    totalStationCount: number;
    busStationCount: number;
    subwayStationCount: number;
    totalWalk: number;
    totalTime: number;
    payment: number;
    busCount: number;
    subwayCount: number;
  };
  subPath: Array<{
    trafficType: number;
    distance: number;
    sectionTime: number;
    stationCount?: number;
    startName: string;
    endName: string;
    way?: string;
    door?: string;
    startX?: number;
    startY?: number;
    endX?: number;
    endY?: number;
    passStopList?: {
      stations: Array<{
        x: number;
        y: number;
        stationName: string;
        index: number;
      }>;
    };
    lane?: Array<{
      name: string;
      busColor: string;
      type: number;
      busID: string;
    }>;
  }>;
}

export interface TransitSearchParams {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startName?: string;
  endName?: string;
}