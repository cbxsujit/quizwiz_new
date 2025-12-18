
// Data structure for a connected player
export interface Player {
  id: string; // The peer ID of the player
  name: string; // The display name
  avatar: string; // Emoji avatar
  theme: string; // Color theme ID (e.g., 'red', 'blue')
  joinedAt: number;
  score: number; // Added score tracking
  streak: number; // Consecutive correct answers
  coins: number; // Currency for power-ups
}

// Application View States (Global)
export type AppState = 
  | 'LANDING' 
  | 'HOST_AUTH' 
  | 'HOST_DASHBOARD' 
  | 'HOST_CREATE' 
  | 'HOST_LOBBY' 
  | 'PLAYER_JOIN' 
  | 'PLAYER_WAITING';

// Host Game States
export type HostGameState = 'LOBBY' | 'PLAYING' | 'REVEAL' | 'GAME_OVER';

// Player Game States
export type PlayerGameState = 'LOBBY' | 'ANSWERING' | 'SUBMITTED' | 'RESULT' | 'GAME_OVER' | 'KICKED';

// Quiz Data Structures
export type QuestionType = 'MC' | 'TRUE_FALSE' | 'POLL' | 'OPEN_ENDED' | 'WORD_CLOUD' | 'SLIDER';
export type MediaType = 'image' | 'youtube';

export interface Option {
  id: string;
  color: 'red' | 'blue' | 'green' | 'yellow';
  text: string;
}

export interface Question {
  id: number;
  type: QuestionType;
  text: string;
  timeLimit: number; // Time in seconds
  
  // Multimedia
  mediaType?: MediaType;
  mediaUrl?: string;
  
  // For MC, TRUE_FALSE, POLL
  options?: Option[]; 
  correctOptionId?: string; // For MC, TRUE_FALSE

  // For OPEN_ENDED
  correctAnswer?: string; // Text matching
  
  // For SLIDER
  min?: number;
  max?: number;
  correctValue?: number;
  step?: number;
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  questions: Question[];
  createdAt: number;
}

// New Types for Badges and Stats
export type BadgeType = 'SPEED_DEMON' | 'LONE_WOLF' | 'COMEBACK_KID' | 'ON_FIRE';
export type PowerUpType = 'FIFTY_FIFTY' | 'TIME_FREEZE' | 'DOUBLE_DOWN';

export interface RoundStats {
  totalPlayers: number;
  correctCount: number;
  voteDistribution: Record<string, number>; // key: optionId or answer string, value: count
  averageValue?: number; // For slider
}

// Message Protocol for PeerJS communication
export type PeerMessage = 
  | { type: 'JOIN'; name: string; avatar: string; theme: string }
  | { type: 'WELCOME'; gameId: string }
  | { type: 'GAME_START'; question: Question; currentQuestion: number; totalQuestions: number; startTime: number }
  | { type: 'VOTE'; answer: string | number } 
  | { type: 'REACTION'; emoji: string }
  | { type: 'USE_POWERUP'; powerUp: PowerUpType }
  | { type: 'POWERUP_EFFECT'; powerUp: PowerUpType; payload?: any }
  | { 
      type: 'RESULT'; 
      correctOptionId?: string; 
      correctText: string; 
      score: number; 
      correctValue?: number | string; 
      streak: number;
      coins: number;
      coinsEarned: number;
      // New Fields
      badges: BadgeType[];
      rank: number;
      roundStats: RoundStats;
    }
  | { type: 'GAME_OVER'; rank: number; score: number }
  | { type: 'KICK' };
