# KpopDuel Server

Real-time multiplayer K-pop guessing game server built with Node.js, Express, and Socket.io.

## Features

- 🎵 Real-time multiplayer game management
- 🎯 Matchmaking system with player queues
- ⚡ WebSocket-based low-latency communication
- 🏆 Score calculation based on speed and accuracy
- 🎮 5-round game sessions with time limits
- 📊 Game state management and cleanup
- 🔄 Automatic round progression

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Real-time Communication**: Socket.io
- **Language**: TypeScript
- **State Management**: In-memory (for MVP)

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd kpopduel-server
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Start the server:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

## Configuration

### Environment Variables

```bash
PORT=3001                    # Server port (default: 3001)
NODE_ENV=development         # Environment mode
```

### Audio Sources

Update the song database in `src/gameManager.ts`:
```typescript
private songDatabase: Round[] = [
  {
    snippetURL: 'https://your-audio-cdn.com/song1.mp3',
    options: ['Song 1', 'Song 2', 'Song 3', 'Song 4'],
    correctAnswer: 'Song 1'
  },
  // Add more songs...
];
```

## API Endpoints

### REST Endpoints

- `GET /health` - Health check and server statistics

### Socket Events

#### Client → Server

- `findOpponent` - Request matchmaking
- `playerGuess` - Submit answer for current round
  ```typescript
  {
    roundNumber: number,
    guess: string
  }
  ```

#### Server → Client

- `startGame` - Game begins with opponent info
  ```typescript
  {
    matchId: string,
    opponent: { name: string, photo?: string }
  }
  ```

- `startRound` - New round with audio snippet and options
  ```typescript
  {
    roundNumber: number,
    snippetURL: string,
    options: string[],
    timeLimit: number
  }
  ```

- `roundResult` - Round results with correct answer and scores
  ```typescript
  {
    correctAnswer: string,
    scores: { [playerId: string]: number },
    playerAnswers: { [playerId: string]: string },
    roundNumber: number
  }
  ```

- `gameOver` - Final game results
  ```typescript
  {
    finalScores: { [playerId: string]: number },
    winner: string,
    matchId: string
  }
  ```

- `matchmaking_error` - Matchmaking failed
- `opponent_disconnected` - Opponent left the game

## Project Structure

```
kpopduel-server/
├── src/
│   ├── server.ts          # Main server file
│   ├── gameManager.ts     # Game logic and state management
│   └── types.ts          # TypeScript type definitions
├── dist/                 # Compiled JavaScript (generated)
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```

## Game Flow

1. **Connection**: Client connects with player ID and name
2. **Matchmaking**: Player requests opponent via `findOpponent`
3. **Match Creation**: Server pairs two players and creates match
4. **Game Start**: Both players receive `startGame` event
5. **Rounds**: 5 rounds of:
   - Server sends `startRound` with audio snippet and options
   - Players submit guesses via `playerGuess`
   - Server calculates scores and sends `roundResult`
6. **Game End**: Server sends `gameOver` with final results

## Scoring System

- **Base Points**: 100 points for correct answer
- **Speed Bonus**: Up to 150 additional points based on response time
- **Formula**: `100 + (timeLimit - responseTime) * 10`
- **Maximum**: 250 points per round

## Development

### Adding New Songs

1. Add audio files to your CDN/storage
2. Update `songDatabase` in `gameManager.ts`:
   ```typescript
   {
     snippetURL: 'https://your-cdn.com/new-song.mp3',
     options: ['Correct Answer', 'Wrong 1', 'Wrong 2', 'Wrong 3'],
     correctAnswer: 'Correct Answer'
   }
   ```

### Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

### Debugging

Enable debug logging:
```bash
DEBUG=socket.io:* npm run dev
```

## Production Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3001
CMD ["npm", "start"]
```

### Environment Setup

- Set `NODE_ENV=production`
- Configure CORS origins for your client domain
- Use a process manager like PM2
- Set up load balancing for multiple instances
- Configure logging and monitoring

### Scaling Considerations

- **Database**: Replace in-memory storage with Redis/MongoDB
- **Session Management**: Use Redis for session storage
- **Load Balancing**: Use Socket.io Redis adapter
- **CDN**: Host audio files on a CDN for better performance

## Monitoring

### Health Check

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "stats": {
    "activeMatches": 5,
    "waitingPlayers": 2,
    "totalMatches": 150
  }
}
```

### Metrics to Monitor

- Active connections
- Match creation rate
- Average game duration
- Player wait times
- Error rates

## Troubleshooting

### Common Issues

1. **CORS Errors**: Update CORS configuration in `server.ts`
2. **Audio Loading**: Ensure audio URLs are accessible and CORS-enabled
3. **Memory Leaks**: Monitor match cleanup and player disconnections
4. **Performance**: Check for blocking operations in game logic

### Logs

Server logs include:
- Player connections/disconnections
- Match creation and completion
- Round progression
- Error messages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure TypeScript compilation passes
5. Submit a pull request

## License

MIT License - see LICENSE file for details