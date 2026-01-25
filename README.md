# OCT Poker

Multiplayer Texas Hold'em Poker with OCT token betting, powered by the Octra Network.

## 🎮 Game System Flow

The OCT Poker system is designed for security and fairness, using a temporary escrow-style wallet for each session.

1.  **Connect Wallet**: Connect your OctWa wallet extension.
2.  **Select/Create Table**: Browse available tables or create a new one with custom blinds.
3.  **Secure Buy-in**:
    *   The server generates a unique, temporary **Game Wallet** for your session.
    *   You transfer OCT tokens to this address.
    *   The server verifies the transaction on the Octra Chain.
4.  **Real-time Poker**:
    *   Play Texas Hold'em with 2-8 players.
    *   All game logic and card dealing are handled server-side.
    *   WebSocket (Socket.io) ensures sub-second synchronization.
5.  **Cash Out**:
    *   When you leave the table, your final stack is calculated.
    *   The server automatically transfers your OCT back to your primary wallet.
    *   The temporary Game Wallet is securely disposed of.

---

## 🛡️ Security & Integrity

Our platform underwent a comprehensive security audit to ensure a fair and safe gaming environment.

### 1. Fairness (Anti-Cheat)
*   **Cryptographically Secure Randomness**: Deck shuffling uses the Fisher-Yates algorithm powered by `crypto.randomBytes`, making card sequences impossible to predict.
*   **Zero-Knowledge Information**: Players only receive their own hole cards. Opponents' cards are never sent over the network until a showdown occurs.
*   **Bot Detection**: The `ActionSequenceValidator` enforces a minimum delay between actions and detects suspicious patterns.

### 2. Cryptographic Security
*   **AES-256-GCM Encryption**: Temporary private keys are encrypted at rest.
*   **Key Derivation**: We use **PBKDF2-SHA512** with 100,000 iterations and a unique salt per session.
*   **Master Password**: Production environments require a minimum 32-character master password for key encryption.

### 3. Infrastructure Protection
*   **Rate Limiting**: Multi-layer rate limiting (per socket and per IP) protects against DDoS and brute-force attacks.
*   **Drizzle ORM**: Prevents SQL Injection by using typed, parameterized queries.
*   **IP Connection Limits**: Restricts the number of concurrent connections from a single IP address.

---

## 🚀 Quick Start

### Prerequisites
*   Node.js (v18+)
*   npm

### Installation

1.  **Clone the repository**
2.  **Install dependencies**
    ```bash
    npm install
    cd server && npm install
    ```
3.  **Initialize Database**
    ```bash
    cd server
    npm run db:init
    ```
4.  **Run Development Servers**
    *   **Frontend**: `npm run dev` (Runs on http://localhost:5180)
    *   **Backend**: `cd server && npm run dev` (Runs on http://localhost:3002)

---

## ⚙️ Configuration

### Server Environment (`server/.env`)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Server port | `3002` |
| `DEFAULT_SMALL_BLIND` | Default SB for new tables | `0.1` |
| `DEFAULT_BIG_BLIND` | Default BB for new tables | `0.2` |
| `TURN_TIMEOUT_MS` | Time allowed per turn | `30000` |
| `GAME_WALLET_MASTER_PASSWORD` | **Required** - Used for key encryption | - |
| `OCTRA_RPC_URL` | Octra Chain RPC endpoint | `https://octra.network` |
| `MAX_REQUESTS_PER_IP` | Rate limit threshold | `100` |

### Production Deployment

We use **PM2** for production process management.

```bash
cd server
# Build the project
npm run build
# Start with PM2
pm2 start ecosystem.config.cjs --env production
```

---

## 📂 Project Structure

*   `src/`: Frontend React application (Zustand, Tailwind, Socket.io-client).
*   `server/src/game/`: Core Poker logic and state management.
*   `server/src/gameWallet/`: Secure escrow and on-chain verification system.
*   `server/src/db/`: SQLite schema and repositories (Drizzle ORM).
*   `server/src/socket/`: Real-time communication handlers.
*   `server/src/utils/`: Security, validation, and rate-limiting utilities.

---

## 📄 License

Internal Project.