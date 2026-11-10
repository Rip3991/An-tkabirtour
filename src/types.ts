export type InteractionType = 'like' | 'comment' | 'gift' | 'follow';

export type GiftTier = 0 | 1 | 2 | 3;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type HairStyle = 'short' | 'long' | 'bun' | 'cap' | 'kalpak';

export interface Visitor {
  id: string;
  username: string;
  interactionType: InteractionType;
  message?: string;
  giftName?: string;
  giftTier: GiftTier;
  outfitColor: string;
  hairColor: string;
  hairStyle?: HairStyle;
  skinTone: string;
  spawnRoute: 'aslanli' | 'plaza';
  targetSlot: Vec3;
  flowerSpot: Vec3;
  joinedAt: number;
  likeCount: number;
}

export interface FeedEntry {
  id: string;
  visitorId: string;
  username: string;
  interactionType: InteractionType;
  text: string;
  giftTier: GiftTier;
  timestamp: number;
}

export interface SceneStats {
  totalVisitors: number;
  totalLikes: number;
  totalComments: number;
  totalGifts: number;
  totalFlowers: number;
  activeCount: number;
}

export interface TikTokStatus {
  connected: boolean;
  connecting: boolean;
  username: string | null;
  error: string | null;
  viewerCount: number;
}

export type CameraPreset =
  | 'overview'
  | 'mozole'
  | 'aslanli'
  | 'plaza'
  | 'follow';

export type TimeOfDay = 'morning' | 'golden' | 'night';

export type ServerMessage =
  | {
      type: 'state:init';
      visitors: Visitor[];
      feed: FeedEntry[];
      stats: SceneStats;
      tiktok: TikTokStatus;
    }
  | {
      type: 'visitor:joined';
      visitor: Visitor;
      feedEntry: FeedEntry;
      stats: SceneStats;
    }
  | {
      type: 'visitor:updated';
      visitor: Visitor;
      feedEntry: FeedEntry;
      stats: SceneStats;
    }
  | {
      type: 'visitor:removed';
      visitorId: string;
      stats: SceneStats;
    }
  | {
      type: 'tiktok:status';
      tiktok: TikTokStatus;
    }
  | {
      type: 'scene:cleared';
      stats: SceneStats;
    }
  | {
      type: 'ceremony:start';
      triggeredBy: string;
    }
  | {
      type: 'ceremony:salute';
    };
