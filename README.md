```
████████╗ █████╗ ███╗   ███╗ █████╗ ███████╗██╗  ██╗██╗██╗
╚══██╔══╝██╔══██╗████╗ ████║██╔══██╗██╔════╝██║  ██║██║██║
   ██║   ███████║██╔████╔██║███████║███████╗███████║██║██║
   ██║   ██╔══██║██║╚██╔╝██║██╔══██║╚════██║██╔══██║██║██║
   ██║   ██║  ██║██║ ╚═╝ ██║██║  ██║███████║██║  ██║██║██║
   ╚═╝   ╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝╚═╝
```

## privacy LLM

# Tamashii Terminal

A privacy-enhanced command-line EVM wallet with integrated **Codex LLM** support and **GPU billing backend**. Built on **Railgun** for zero-knowledge private transactions on **BNB Chain** (default). Features private token transfers, swaps, AI-powered assistance through open source LLM models (Llama, Mistral, Qwen, and more), and a backend service that tracks GPU resource usage with private Railgun payments.

## 🌟 Features

- **Privacy-Enhanced Wallet**: EVM wallet with Railgun zero-knowledge privacy on BNB Chain (default)
- **Private Transactions**: Shield/unshield, transfer, and swap tokens with complete privacy using zk-SNARKs
- **Codex LLM Integration**: AI-powered assistance with open source models (Llama, Mistral, Qwen, etc.)
- **GPU Billing Backend**: FastAPI service tracks GPU job costs and balances via Railgun transactions
- **Railgun GPU Payments**: Pay for GPU resources (LLM inference, zk-SNARK generation) via private Railgun transactions
- **TEE GPU Encryption**: Trusted Execution Environment encryption for secure GPU-accelerated operations
- **Token Swaps**: Private and public swaps via 0x protocol
- **Multi-Chain**: Ethereum, BNB Chain, Polygon, and Arbitrum support

## 🚀 Installation

### Prerequisites

- **Node.js** >= 20 (for terminal)
- **Python 3.10+** (for backend)
- Terminal/Command line access
- BNB Chain wallet for transactions
- BNB tokens for gas fees

### Quick Start

**Terminal Wallet:**
```bash
# Clone the repository
git clone https://github.com/yourusername/tamashii-terminal.git
cd tamashii-terminal/terminal

# Install dependencies
npm install --legacy-peer-deps

# Build the project
npm run build

# Run the terminal wallet
npm start
# or use the binary
./bin/tamashii
```

**Backend Service (GPU Billing):**
```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Set environment variables (see backend/.env.example)
# Run the FastAPI service
uvicorn main:app --reload
```

**Project Structure:**
- `terminal/` - CLI wallet application
- `backend/` - FastAPI GPU billing service
- `llm-debug/` - LLM request/response logging proxy
- `railgun/` - Railgun integration components

## 📖 Usage

### Terminal Wallet

Tamashii Terminal runs as an interactive CLI wallet with a menu-driven interface.

**Key Operations:**
- Create/load Railgun wallets, shield/unshield tokens, private transfers/swaps
- Launch Codex for AI assistance (GPU resources paid via Railgun)
- Pay for GPU resources using private Railgun transactions
- Manage networks, RPC providers, and view balances
- Execute private transactions with zero-knowledge privacy

**Workflow:**
1. Start: `cd terminal && npm start` or `./bin/tamashii`
2. Create/load wallet and select network (BNB Chain default)
3. Shield tokens to private Railgun address
4. Use "Pay EASE" or private transfer to pay for GPU resources
5. Make private transactions or launch Codex for AI assistance

### Backend Service

The backend service provides GPU job management and billing:

**API Endpoints:**
- `POST /jobs` - Launch GPU jobs (deducts from Railgun balance)
- `GET /balance` - Check balance (deposits - spent)
- `GET /jobs` - List user's GPU jobs

**How it works:**
1. Users deposit BNB via private Railgun transactions to the service address
2. Backend tracks deposits by scanning Railgun transactions
3. When launching GPU jobs, cost is calculated and deducted from balance
4. Balance = Total deposits - Total spent on billed jobs

## 🔒 Privacy Features

**Railgun Zero-Knowledge Privacy:**
- Private transactions (shield, unshield, transfer, swap) with zk-SNARK proofs
- GPU resource payments via private Railgun transactions on BNB Chain
- On-chain privacy: amounts, sender, and receiver remain hidden
- Waku network for decentralized transaction relay

**Codex LLM Integration:**
- Open source models (Llama, Mistral, Qwen, Gemma, Phi)
- TEE encryption for GPU-accelerated inference
- GPU resources paid via private Railgun transactions
- Wallet context awareness for AI assistance

## 🛠️ Configuration

### RPC Provider Setup

Add custom RPC providers via the wallet UI (Network Tools → Edit RPC Providers) or set `REMOTE_CONFIG_RPC` environment variable. Default providers are included for BNB Chain, Ethereum, Polygon, and Arbitrum.

### Codex API Key Setup

Configure Codex via `~/.codex/config.toml` or environment variables:

**Config file (`~/.codex/config.toml`):**
```toml
api_key = "your-api-key"
model = "llama-3.1-70b-instruct"  # Optional
base_url = "https://api.together.xyz/v1"  # Optional
```

**Environment variables:**
```bash
export OPENAI_API_KEY="your-api-key"
export OPENAI_MODEL="llama-3.1-70b-instruct"  # Optional
export OPENAI_BASE_URL="https://api.together.xyz/v1"  # Optional
```

**Providers:** Together AI, Hugging Face, Groq, or local servers (Ollama, LM Studio).  
**Models:** Llama, Mistral, Qwen, Gemma, Phi, and other open source models.

### TEE Encryption & GPU Payments

**TEE Encryption:** Hardware-level security for GPU operations with encrypted memory and secure key management. Authentication uses password-derived keys (scrypt, 131,072 iterations).

**GPU Resource Payments:** GPU resources (LLM inference, zk-SNARK generation) are paid via private Railgun transactions on BNB Chain. Payments are private and untraceable while verified on-chain.

**Auto-enabled** when GPU is detected. No configuration required.

### Default Configuration

- **Default Network**: BNB Chain
- **Supported Networks**: Ethereum, BNB Chain, Polygon, Arbitrum
- **Storage**: `.railgun.db`, `.artifacts-2.5`, `.zKeyChains` (local, encrypted)

## 🔐 Security

- Encrypted wallet storage with password-derived keys
- Private keys never leave device
- Zero-knowledge proofs (zk-SNARKs) for transaction privacy
- TEE encryption for GPU operations
- Local encrypted database
- Password-protected access

## 📝 Examples

**Terminal Wallet:**
```bash
cd terminal
npm start

# Menu options:
# - Create Wallet
# - Shield [BNB]
# - Private Transfer [0zk → 0zk]
# - Pay EASE (for GPU resources)
# - Launch Codex
```

**Backend API:**
```bash
cd backend
uvicorn main:app --reload

# API available at http://localhost:8000
# Docs at http://localhost:8000/docs
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the **LGPL-3.0-or-later** License - see the LICENSE file for details.

## 🛠️ Development

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Scripts

**Terminal:**
- `npm start` - Run the built application
- `npm run build` - Build TypeScript to JavaScript
- `npm run lint` - Run ESLint
- `npm run installdeps` - Install dependencies with legacy peer deps

**Backend:**
- `uvicorn main:app --reload` - Run FastAPI development server
- `alembic upgrade head` - Run database migrations

## ⚠️ Disclaimer

This tool is designed for privacy-conscious users. While it implements strong privacy measures, users should understand the limitations and use it responsibly and in accordance with applicable laws and regulations.

## 🔗 Links

- [Documentation](https://github.com/yourusername/tamashii-terminal/wiki)
- [Issue Tracker](https://github.com/yourusername/tamashii-terminal/issues)
- [Privacy Policy](https://github.com/yourusername/tamashii-terminal/blob/main/PRIVACY.md)

## 📧 Contact

For questions, suggestions, or support, please open an issue on GitHub.

---

**Tamashii Terminal** - Privacy-enhanced EVM wallet with Codex LLM integration. Built on Railgun for zero-knowledge private transactions.

