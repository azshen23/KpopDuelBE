import { v4 as uuidv4 } from 'uuid';
import { Player, Match, Round, PlayerGuess, RoundResult, GameResult } from './types';

class GameManager {
  private matches: Map<string, Match> = new Map();
  private waitingPlayers: Player[] = [];
  private playerMatches: Map<string, string> = new Map(); // playerId -> matchId

  // Sample K-pop songs data (in production, this would come from a database)
  private songDatabase: Round[] = [
    {
      snippetURL: 'https://example.com/audio/dynamite.mp3',
      options: ['Dynamite', 'Butter', 'Permission to Dance', 'Life Goes On'],
      correctAnswer: 'Dynamite'
    },
    {
      snippetURL: 'https://example.com/audio/gangnam-style.mp3',
      options: ['Gangnam Style', 'Gentleman', 'Daddy', 'New Face'],
      correctAnswer: 'Gangnam Style'
    },
    {
      snippetURL: 'https://example.com/audio/how-you-like-that.mp3',
      options: ['How You Like That', 'Kill This Love', 'DDU-DU DDU-DU', 'Lovesick Girls'],
      correctAnswer: 'How You Like That'
    },
    {
      snippetURL: 'https://example.com/audio/next-level.mp3',
      options: ['Next Level', 'Savage', 'Black Mamba', 'My World'],
      correctAnswer: 'Next Level'
    },
    {
      snippetURL: 'https://example.com/audio/god-menu.mp3',
      options: ['God\'s Menu', 'Back Door', 'Thunderous', 'MANIAC'],
      correctAnswer: 'God\'s Menu'
    },
    {
      snippetURL: 'https://example.com/audio/fancy.mp3',
      options: ['Fancy', 'Feel Special', 'More & More', 'I Can\'t Stop Me'],
      correctAnswer: 'Fancy'
    },
    {
      snippetURL: 'https://example.com/audio/love-scenario.mp3',
      options: ['Love Scenario', 'Killing Me', 'Goodbye Road', 'Why Why Why'],
      correctAnswer: 'Love Scenario'
    },
    {
      snippetURL: 'https://example.com/audio/spring-day.mp3',
      options: ['Spring Day', 'Blood Sweat & Tears', 'Fire', 'Save ME'],
      correctAnswer: 'Spring Day'
    }
  ];

  addPlayerToQueue(player: Player): string | null {
    // Check if player is already in a match
    if (this.playerMatches.has(player.id)) {
      return null;
    }

    // Remove player from waiting queue if already there
    this.waitingPlayers = this.waitingPlayers.filter(p => p.id !== player.id);
    
    // Add to waiting queue
    this.waitingPlayers.push(player);

    // Try to create a match if we have 2+ players
    if (this.waitingPlayers.length >= 2) {
      return this.createMatch();
    }

    return null;
  }

  private createMatch(): string {
    const player1 = this.waitingPlayers.shift()!;
    const player2 = this.waitingPlayers.shift()!;
    
    const matchId = uuidv4();
    const rounds = this.generateRounds(5);
    
    const match: Match = {
      id: matchId,
      player1Id: player1.id,
      player2Id: player2.id,
      currentRound: 0,
      rounds,
      scores: {
        [player1.id]: 0,
        [player2.id]: 0
      },
      state: 'waiting',
      playerAnswers: {},
      roundTimeLimit: 15 // 15 seconds per round
    };

    this.matches.set(matchId, match);
    this.playerMatches.set(player1.id, matchId);
    this.playerMatches.set(player2.id, matchId);

    return matchId;
  }

  private generateRounds(count: number): Round[] {
    const shuffled = [...this.songDatabase].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  startMatch(matchId: string): Match | null {
    const match = this.matches.get(matchId);
    if (!match) return null;

    match.state = 'playing';
    match.currentRound = 1;
    match.roundStartTime = Date.now();
    
    return match;
  }

  getCurrentRound(matchId: string): Round | null {
    const match = this.matches.get(matchId);
    if (!match || match.currentRound === 0 || match.currentRound > match.rounds.length) {
      return null;
    }
    
    return match.rounds[match.currentRound - 1];
  }

  submitGuess(matchId: string, playerId: string, guess: PlayerGuess): RoundResult | null {
    const match = this.matches.get(matchId);
    if (!match || match.state !== 'playing' || guess.roundNumber !== match.currentRound) {
      return null;
    }

    // Store the player's answer
    match.playerAnswers[playerId] = guess.guess;

    // Check if this is the correct answer
    const currentRound = match.rounds[match.currentRound - 1];
    if (guess.guess === currentRound.correctAnswer) {
      // Calculate score based on speed (faster = more points)
      const timeElapsed = (guess.timestamp - (match.roundStartTime || 0)) / 1000;
      const speedBonus = Math.max(0, match.roundTimeLimit - timeElapsed);
      const points = Math.round(100 + speedBonus * 10); // Base 100 + speed bonus
      
      match.scores[playerId] += points;
    }

    // Check if both players have answered or time is up
    const playerIds = [match.player1Id, match.player2Id];
    const allAnswered = playerIds.every(id => match.playerAnswers[id] !== undefined);
    
    if (allAnswered || this.isRoundTimeUp(match)) {
      return this.finishRound(match);
    }

    return null;
  }

  private isRoundTimeUp(match: Match): boolean {
    if (!match.roundStartTime) return false;
    const timeElapsed = (Date.now() - match.roundStartTime) / 1000;
    return timeElapsed >= match.roundTimeLimit;
  }

  private finishRound(match: Match): RoundResult {
    const currentRound = match.rounds[match.currentRound - 1];
    
    const result: RoundResult = {
      correctAnswer: currentRound.correctAnswer,
      scores: { ...match.scores },
      playerAnswers: { ...match.playerAnswers },
      roundNumber: match.currentRound
    };

    // Clear answers for next round
    match.playerAnswers = {};
    
    // Move to next round or finish game
    if (match.currentRound >= match.rounds.length) {
      match.state = 'finished';
    } else {
      match.currentRound++;
      match.roundStartTime = undefined; // Will be set when next round starts
    }

    return result;
  }

  getGameResult(matchId: string): GameResult | null {
    const match = this.matches.get(matchId);
    if (!match || match.state !== 'finished') {
      return null;
    }

    const player1Score = match.scores[match.player1Id];
    const player2Score = match.scores[match.player2Id];
    
    let winner: string;
    if (player1Score > player2Score) {
      winner = match.player1Id;
    } else if (player2Score > player1Score) {
      winner = match.player2Id;
    } else {
      winner = 'tie';
    }

    return {
      finalScores: { ...match.scores },
      winner,
      matchId
    };
  }

  removePlayer(playerId: string): void {
    // Remove from waiting queue
    this.waitingPlayers = this.waitingPlayers.filter(p => p.id !== playerId);
    
    // Handle if player was in a match
    const matchId = this.playerMatches.get(playerId);
    if (matchId) {
      const match = this.matches.get(matchId);
      if (match && match.state !== 'finished') {
        // Mark match as finished due to disconnection
        match.state = 'finished';
      }
      this.playerMatches.delete(playerId);
    }
  }

  getMatch(matchId: string): Match | undefined {
    return this.matches.get(matchId);
  }

  getPlayerMatch(playerId: string): Match | null {
    const matchId = this.playerMatches.get(playerId);
    if (!matchId) return null;
    return this.matches.get(matchId) || null;
  }

  // Clean up finished matches (call periodically)
  cleanupFinishedMatches(): void {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    for (const [matchId, match] of this.matches.entries()) {
      if (match.state === 'finished' && (match.roundStartTime || 0) < oneHourAgo) {
        this.matches.delete(matchId);
        // Remove player mappings
        this.playerMatches.delete(match.player1Id);
        this.playerMatches.delete(match.player2Id);
      }
    }
  }

  // Get stats for monitoring
  getStats() {
    return {
      activeMatches: Array.from(this.matches.values()).filter(m => m.state === 'playing').length,
      waitingPlayers: this.waitingPlayers.length,
      totalMatches: this.matches.size
    };
  }
}

export default GameManager;