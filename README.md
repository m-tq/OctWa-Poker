# OCT Poker

Multiplayer Texas Hold'em Poker with OCT token betting, integrated with OctWa Wallet.

## Features

- **Multiplayer**: 2-8 players per table
- **OCT Betting**: Real cryptocurrency stakes using OCT tokens
- **OctWa Wallet Integration**: Secure wallet connection via @octwa/sdk
- **Real-time**: WebSocket-based game synchronization
- **Persistent Storage**: SQLite database for tables, hands, and transactions
- **Auto-reconnect**: 60-second grace period for disconnected players
- **Turn Timer**: 30-second timeout with auto-fold
- **User Dashboard**: Statistics and detailed hand history
- **Leaderboard**: Global player rankings by net profit
- **Theme Toggle**: Dark/Light mode support

## Security Features

- **Input Validation**: Strict validation of all client inputs
- **Rate Limiting**: Per-socket and per-IP rate limiting
- **IP Connection Limits**: Max 5 connections per IP address
- **Cryptographic Shuffle**: Secure deck shuffling using crypto.randomBytes
- **Bot Detection**: Action timing validation
- **Multi-table Prevention**: One table per wallet address
- **Hand Locks**: Race condition prevention
- **Escrow Buy-in**: On-chain balance verification with unique escrow wallets

## Escrow System

The escrow system provides on-chain balance verification for buy-ins:

### How It Works

1. **Get Quote**: Player requests a buy-in quote, server generates a unique escrow wallet
2. **Send OCT**: Player sends OCT to the escrow address with encoded message payload
3. **Verify**: Server verifies the on-chain transaction
4. **Play**: Player joins the table with verified funds
5. **Settle**: When player leaves, funds are sent back to their wallet

### Escrow Configuration

Add to `server/.env`:

```env
# SECURITY: Generate a strong random password (min 32 chars in production)
# Example: openssl rand -base64 32
ESCROW_MASTER_PASSWORD=your-secure-escrow-password-min-32-characters
```

### Escrow API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/escrow/quote` | POST | Get buy-in quote with escrow address |
| `/api/escrow/verify` | POST | Verify deposit transaction |
| `/api/escrow/session/:id` | GET | Get escrow session status |

### Security Features

- **AES-256-GCM Encryption**: Private keys encrypted at rest
- **PBKDF2 Key Derivation**: 100k iterations with SHA-512
- **Unique Salt Per Session**: Prevents batch attacks
- **Nonce Replay Protection**: Each transaction can only be used once
- **Session Expiry**: 10-minute window for deposits

## Quick Start

### Frontend

```bash
cd oct-poker
npm install
npm run dev
```

The frontend runs on http://localhost:5180

### Backend

```bash
cd oct-poker/server
npm install
npm run db:init    # Initialize SQLite database (first time only)
npm run dev
```

The server runs on http://localhost:3002

## Configuration

### Frontend (.env)

```env
VITE_API_URL=http://localhost:3002
VITE_WS_URL=http://localhost:3002
VITE_OCTRA_EXPLORER=https://octrascan.io
```

### Backend (server/.env)

```env
# Server
PORT=3002

# Game Defaults
DEFAULT_SMALL_BLIND=10
DEFAULT_BIG_BLIND=20
DEFAULT_MIN_BUY_IN=400
DEFAULT_MAX_BUY_IN=2000
DEFAULT_MAX_PLAYERS=8

# Timing
TURN_TIMEOUT_MS=30000
DISCONNECT_GRACE_MS=60000

# Security - IP Rate Limiting
MAX_REQUESTS_PER_IP_PER_SECOND=50
MAX_CONNECTIONS_PER_IP=5
IP_BLOCK_DURATION_MS=60000
```

## Database

The server uses SQLite for persistent storage:

- **Location**: `server/data/poker.db`
- **ORM**: Drizzle ORM with better-sqlite3
- **Mode**: WAL (Write-Ahead Logging) for concurrent performance

### Database Commands

```bash
npm run db:init     # Create database and tables
npm run db:studio   # Open Drizzle Studio (GUI)
```

### Tables

| Table | Description |
|-------|-------------|
| `users` | Player accounts and statistics |
| `tables` | Poker table configurations |
| `table_sessions` | Active player sessions |
| `hands` | Completed hand history |
| `hand_players` | Players in each hand with results |
| `actions` | All betting actions |
| `transactions` | Buy-in and cash-out records |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Server health check |
| `/api/config` | GET | Game configuration defaults |
| `/api/tables` | GET | List all tables |
| `/api/users/:address/stats` | GET | User statistics |
| `/api/users/:address/history` | GET | User hand history |
| `/api/users/:address/exists` | GET | Check if user exists |
| `/api/users/register` | POST | Register new user |
| `/api/users/update-username` | POST | Update username |
| `/api/hands/:handId` | GET | Hand details |
| `/api/leaderboard` | GET | Global leaderboard |
| `/api/escrow/quote` | POST | Get escrow buy-in quote |
| `/api/escrow/verify` | POST | Verify escrow deposit |
| `/api/escrow/session/:id` | GET | Get escrow session status |

## WebSocket Events

### Client → Server

| Event | Description |
|-------|-------------|
| `get-tables` | Request table list |
| `create-table` | Create new table |
| `join-table` | Join a table with buy-in |
| `leave-table` | Leave current table |
| `rejoin-table` | Rejoin after disconnect |
| `player-action` | Send game action (fold/check/call/bet/raise/all-in) |

### Server → Client

| Event | Description |
|-------|-------------|
| `tables-list` | Updated table list |
| `table-state` | Current table state |
| `hand-started` | New hand with hole cards |
| `player-acted` | Player action broadcast |
| `turn-changed` | Active player changed |
| `hand-ended` | Hand result with winners |
| `player-busted` | Player ran out of chips |
| `error` | Error message |

## Project Structure

```
oct-poker/
├── src/                    # Frontend React application
│   ├── components/
│   │   ├── ui/            # Base UI components
│   │   ├── layout/        # Header, Layout
│   │   ├── wallet/        # Wallet connection
│   │   ├── lobby/         # Table list, Create/Join dialogs, Escrow buy-in
│   │   ├── table/         # Poker table, seats, cards
│   │   └── user/          # Username setup
│   ├── hooks/             # useSocket, useWallet
│   ├── pages/             # Lobby, Table, Dashboard
│   ├── store/             # Zustand stores
│   └── config/            # Configuration
├── server/
│   └── src/
│       ├── db/            # Database layer
│       │   ├── schema.ts  # Drizzle schema
│       │   └── repositories/
│       ├── escrow/        # Escrow wallet system
│       │   ├── escrowCrypto.ts  # AES-256-GCM encryption
│       │   ├── escrowManager.ts # Session management
│       │   └── types.ts   # Type definitions
│       ├── game/          # GameManager, TableManager
│       ├── socket/        # Socket.IO handlers
│       ├── utils/         # Validation, Rate limiting, Security
│       └── config.ts      # Server configuration
└── package.json
```

## Game Flow

1. **Connect Wallet**: Connect OctWa wallet extension
2. **Authorize**: Grant permission for balance check and transactions
3. **Set Username**: Choose a display name (3-16 alphanumeric characters)
4. **Join Table**: Select a table and buy-in amount
5. **Play**: Standard Texas Hold'em with blinds and betting rounds
6. **View Stats**: Check your statistics and hand history in Dashboard
7. **Cash Out**: Leave table to keep your chips

## Deployment

### Frontend (Vercel)

The frontend includes `vercel.json` for SPA routing:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

### Backend

Deploy the server separately (e.g., Railway, Render, VPS):

1. Set environment variables from `.env.example`
2. Run `npm run db:init` to initialize database
3. Run `npm start` for production

## Technologies

| Layer | Technologies |
|-------|--------------|
| Frontend | React, TypeScript, Vite, Tailwind CSS, Zustand |
| Backend | Node.js, Express, Socket.IO, TypeScript |
| Database | SQLite, Drizzle ORM |
| Wallet | @octwa/sdk |
| Security | crypto (Node.js), rate limiting, input validation |

## Requirements

- Node.js 18+
- OctWa Wallet browser extension
- OCT tokens for betting

## License

MIT
