export interface Player {
  id: string;
  name: string;
  socketId: string;
  photo?: string;
}

export interface Round {
  snippetURL: string;
  options: string[];
  correctAnswer: string;
}

export interface Match {
  id: string;
  player1Id: string;
  player2Id: string;
  currentRound: number;
  rounds: Round[];
  scores: { [playerId: string]: number };
  state: 'waiting' | 'playing' | 'finished';
  roundStartTime?: number;
  playerAnswers: { [playerId: string]: string };
  roundTimeLimit: number;
}

export interface PlayerGuess {
  roundNumber: number;
  guess: string;
  timestamp: number;
}

export interface RoundResult {
  correctAnswer: string;
  scores: { [playerId: string]: number };
  playerAnswers: { [playerId: string]: string };
  roundNumber: number;
}

export interface GameResult {
  finalScores: { [playerId: string]: number };
  winner: string;
  matchId: string;
}

// Socket event types
export interface ServerToClientEvents {
  startGame: (data: { matchId: string; opponent: { name: string; photo?: string } }) => void;
  startRound: (data: { 
    roundNumber: number; 
    snippetURL: string; 
    options: string[]; 
    timeLimit: number 
  }) => void;
  roundResult: (data: RoundResult) => void;
  gameOver: (data: GameResult) => void;
  matchmaking_error: (data: { message: string }) => void;
  opponent_disconnected: () => void;
}

export interface ClientToServerEvents {
  findOpponent: () => void;
  playerGuess: (data: { roundNumber: number; guess: string }) => void;
}

export interface InterServerEvents {
  // For scaling across multiple servers if needed
}

export interface SocketData {
  playerId: string;
  playerName: string;
  matchId?: string;
}