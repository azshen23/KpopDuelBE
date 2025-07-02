import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import GameManager from './gameManager';
import { 
  Player, 
  ServerToClientEvents, 
  ClientToServerEvents, 
  InterServerEvents, 
  SocketData 
} from './types';

const app = express();
const httpServer = createServer(app);
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: "*", // In production, specify your client URL
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Game manager instance
const gameManager = new GameManager();

// Store connected players
const connectedPlayers = new Map<string, Player>();

// Basic health check endpoint
app.get('/health', (req, res) => {
  const stats = gameManager.getStats();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    stats
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  const playerId = socket.handshake.query.playerId as string;
  const playerName = socket.handshake.query.playerName as string;
  
  if (!playerId || !playerName) {
    console.log('Invalid connection - missing player info');
    socket.disconnect();
    return;
  }

  // Store player info in socket data
  socket.data.playerId = playerId;
  socket.data.playerName = playerName;

  // Create player object
  const player: Player = {
    id: playerId,
    name: playerName,
    socketId: socket.id
  };

  connectedPlayers.set(playerId, player);
  console.log(`Player ${playerName} (${playerId}) connected`);

  // Handle find opponent request
  socket.on('findOpponent', () => {
    console.log(`${playerName} is looking for an opponent`);
    
    try {
      const matchId = gameManager.addPlayerToQueue(player);
      
      if (matchId) {
        // Match found! Get the match details
        const match = gameManager.getMatch(matchId);
        if (!match) {
          socket.emit('matchmaking_error', { message: 'Failed to create match' });
          return;
        }

        // Get both players
        const player1 = connectedPlayers.get(match.player1Id);
        const player2 = connectedPlayers.get(match.player2Id);
        
        if (!player1 || !player2) {
          socket.emit('matchmaking_error', { message: 'Player not found' });
          return;
        }

        // Store match ID in socket data
        const player1Socket = io.sockets.sockets.get(player1.socketId);
        const player2Socket = io.sockets.sockets.get(player2.socketId);
        
        if (player1Socket) {
          player1Socket.data.matchId = matchId;
          player1Socket.emit('startGame', {
            matchId,
            opponent: { name: player2.name, photo: player2.photo }
          });
        }
        
        if (player2Socket) {
          player2Socket.data.matchId = matchId;
          player2Socket.emit('startGame', {
            matchId,
            opponent: { name: player1.name, photo: player1.photo }
          });
        }

        // Start the match and first round
        setTimeout(() => {
          startNextRound(matchId);
        }, 3000); // 3 second delay to let players prepare
        
        console.log(`Match created: ${player1.name} vs ${player2.name}`);
      }
    } catch (error) {
      console.error('Error in findOpponent:', error);
      socket.emit('matchmaking_error', { message: 'Matchmaking failed' });
    }
  });

  // Handle player guess
  socket.on('playerGuess', (data) => {
    const matchId = socket.data.matchId;
    if (!matchId) {
      console.log('Player guess without active match');
      return;
    }

    try {
      const result = gameManager.submitGuess(matchId, playerId, {
        roundNumber: data.roundNumber,
        guess: data.guess,
        timestamp: Date.now()
      });

      if (result) {
        // Round finished, send results to both players
        const match = gameManager.getMatch(matchId);
        if (match) {
          const player1Socket = io.sockets.sockets.get(
            connectedPlayers.get(match.player1Id)?.socketId || ''
          );
          const player2Socket = io.sockets.sockets.get(
            connectedPlayers.get(match.player2Id)?.socketId || ''
          );

          // Send round result
          player1Socket?.emit('roundResult', result);
          player2Socket?.emit('roundResult', result);

          // Check if game is over
          if (match.state === 'finished') {
            const gameResult = gameManager.getGameResult(matchId);
            if (gameResult) {
              player1Socket?.emit('gameOver', gameResult);
              player2Socket?.emit('gameOver', gameResult);
              console.log(`Game finished: ${matchId}`);
            }
          } else {
            // Start next round after a delay
            setTimeout(() => {
              startNextRound(matchId);
            }, 3000);
          }
        }
      }
    } catch (error) {
      console.error('Error handling player guess:', error);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Player ${playerName} (${playerId}) disconnected`);
    
    // Remove from connected players
    connectedPlayers.delete(playerId);
    
    // Handle match cleanup
    const matchId = socket.data.matchId;
    if (matchId) {
      const match = gameManager.getMatch(matchId);
      if (match && match.state === 'playing') {
        // Notify opponent about disconnection
        const opponentId = match.player1Id === playerId ? match.player2Id : match.player1Id;
        const opponent = connectedPlayers.get(opponentId);
        if (opponent) {
          const opponentSocket = io.sockets.sockets.get(opponent.socketId);
          opponentSocket?.emit('opponent_disconnected');
        }
      }
    }
    
    // Remove player from game manager
    gameManager.removePlayer(playerId);
  });
});

// Helper function to start the next round
function startNextRound(matchId: string) {
  const match = gameManager.startMatch(matchId);
  if (!match) {
    console.error(`Failed to start match: ${matchId}`);
    return;
  }

  const currentRound = gameManager.getCurrentRound(matchId);
  if (!currentRound) {
    console.error(`No current round for match: ${matchId}`);
    return;
  }

  // Get player sockets
  const player1 = connectedPlayers.get(match.player1Id);
  const player2 = connectedPlayers.get(match.player2Id);
  
  if (!player1 || !player2) {
    console.error(`Players not found for match: ${matchId}`);
    return;
  }

  const player1Socket = io.sockets.sockets.get(player1.socketId);
  const player2Socket = io.sockets.sockets.get(player2.socketId);

  const roundData = {
    roundNumber: match.currentRound,
    snippetURL: currentRound.snippetURL,
    options: currentRound.options,
    timeLimit: match.roundTimeLimit
  };

  // Send round data to both players
  player1Socket?.emit('startRound', roundData);
  player2Socket?.emit('startRound', roundData);

  console.log(`Round ${match.currentRound} started for match ${matchId}`);

  // Auto-finish round after time limit
  setTimeout(() => {
    const currentMatch = gameManager.getMatch(matchId);
    if (currentMatch && currentMatch.state === 'playing') {
      // Force finish round if still active
      const result = gameManager.submitGuess(matchId, 'system', {
        roundNumber: match.currentRound,
        guess: '', // Empty guess to trigger round end
        timestamp: Date.now()
      });

      if (result) {
        player1Socket?.emit('roundResult', result);
        player2Socket?.emit('roundResult', result);

        if (currentMatch.state === 'finished') {
          const gameResult = gameManager.getGameResult(matchId);
          if (gameResult) {
            player1Socket?.emit('gameOver', gameResult);
            player2Socket?.emit('gameOver', gameResult);
          }
        } else {
          setTimeout(() => startNextRound(matchId), 3000);
        }
      }
    }
  }, match.roundTimeLimit * 1000 + 1000); // Add 1 second buffer
}

// Cleanup finished matches every 10 minutes
setInterval(() => {
  gameManager.cleanupFinishedMatches();
}, 10 * 60 * 1000);

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🎵 KpopDuel Server running on port ${PORT}`);
  console.log(`🎯 Health check available at http://localhost:${PORT}/health`);
});