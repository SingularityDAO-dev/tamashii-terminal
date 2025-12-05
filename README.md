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

A privacy-enhanced command-line EVM wallet with integrated **Codex LLM** support. Built on **Railgun** for zero-knowledge private transactions on **BNB Chain** (default). Features private token transfers, swaps, and AI-powered assistance through OpenAI Codex.

## 🌟 Features

- **Privacy-Enhanced Wallet**: Full EVM wallet with Railgun zero-knowledge privacy protocol integration
- **Multi-Chain Support**: Ethereum, BNB Chain (default), Polygon, and Arbitrum networks
- **Private Transactions**: Shield/unshield tokens with complete transaction privacy using zk-SNARKs
- **Codex LLM Integration**: AI-powered assistance via OpenAI Codex CLI for coding and development tasks
- **Token Swaps**: Private and public token swaps via 0x protocol
- **Ease Payment System**: Pay for sessions using private BNB transactions
- **Waku Network**: Decentralized broadcasting for private transaction relay
- **Wallet Management**: Create, import, and manage multiple Railgun wallets
- **Balance Tracking**: Real-time public and private balance monitoring
- **Cross-Contract Calls**: Execute smart contract calls with private token payments

## 🚀 Installation

### Prerequisites

- **Node.js** >= 20
- Terminal/Command line access
- BNB Chain wallet  for transactions
- BNB  tokens for gas fees

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/tamashii-terminal.git
cd tamashii-terminal

# Install dependencies
npm install --legacy-peer-deps

# Build the project
npm run build

# Run the terminal wallet
npm start
# or use the binary
./bin/tamashii
```

## 📖 Usage

Tamashii Terminal runs as an interactive CLI wallet. Upon startup, you'll see a menu-driven interface.

### Main Features

**Wallet Operations:**
- Create new Railgun wallet or load existing wallet
- Switch between multiple wallets
- View public and private balances
- Manage wallet passwords and encryption

**Private Transactions (Railgun):**
- **Shield**: Move tokens from public wallet to private Railgun shield
- **Unshield**: Move tokens from private shield back to public wallet
- **Private Transfer**: Send tokens privately to another Railgun address
- **Private Swap**: Swap tokens privately using 0x protocol

**Public Transactions:**
- Send tokens publicly
- Public token swaps
- Approve token spending

**Network Management:**
- Switch between networks (Ethereum, BNB Chain, Polygon, Arbitrum)
- Configure custom RPC providers
- View network status and gas prices

**Codex LLM Integration:**
- Launch Codex for AI-powered coding assistance
- Configure OpenAI API key for Codex
- Use Codex with wallet context (addresses, network info)

**Ease Payment System:**
- Pay for sessions using private BNB transactions
- Verify payment receipts
- Cross-contract calls with private token payments

### Example Workflow

1. **Start the wallet**: `npm start` or `./bin/tamashii`
2. **Create/Load wallet**: Select from menu
3. **Select network**: Choose BNB Chain (default) or another network
4. **Shield tokens**: Move BNB/tokens to private Railgun address
5. **Make private transactions**: Send, swap, or pay privately
6. **Use Codex**: Launch AI assistant for development tasks

## 🔒 Privacy Features

### Railgun Zero-Knowledge Privacy

Tamashii Terminal uses Railgun's zk-SNARK technology for complete transaction privacy:

- **Private Transactions**: Shield, unshield, transfer, and swap tokens with complete privacy
- **zk-SNARK Proofs**: Zero-knowledge proofs hide transaction amounts, sender, and receiver
- **On-Chain Privacy**: Private transactions are verified on-chain without revealing details
- **Multi-Chain Support**: Railgun privacy available on Ethereum, BNB Chain, Polygon, and Arbitrum
- **BNB Chain Default**: Optimized for BNB Chain with native BNB and BEP-20 token support
- **Waku Broadcasting**: Decentralized transaction relay through Waku network
- **POI Proofs**: Proof of Innocence system for regulatory compliance

### Codex LLM Integration

AI-powered assistance through OpenAI Codex:

- **Codex CLI Integration**: Seamless integration with OpenAI Codex command-line tool
- **Wallet Context**: Codex has access to wallet information (addresses, network, balances)
- **API Key Authentication**: Secure API key-based authentication
- **Development Assistance**: Get AI help for coding, debugging, and development tasks
- **Privacy-Focused**: Codex queries are handled locally with your API key

## 🛠️ Configuration

### RPC Provider Setup

Tamashii Terminal comes with default public RPC providers for each network, but you can add custom RPC providers for better performance and reliability.

#### Method 1: Through the Wallet UI (Recommended)

1. Start the wallet: `npm start`
2. Navigate to the main menu
3. Select **"Network Tools"** or **"Edit RPC Providers"**
4. Choose your network (BNB Chain, Ethereum, etc.)
5. Select **"Add Custom RPC"**
6. Enter your RPC URL (e.g., `https://bsc-dataseed.binance.org/`)
7. The wallet will test the RPC connection automatically

#### Method 2: Environment Variable (Remote Config)

For advanced users, you can set a custom RPC for remote configuration:

**Linux/macOS:**
```bash
export REMOTE_CONFIG_RPC=https://your-ethereum-rpc-url.com
npm start
```

**Windows (CMD):**
```cmd
set REMOTE_CONFIG_RPC=https://your-ethereum-rpc-url.com
npm start
```

**Windows (PowerShell):**
```powershell
$env:REMOTE_CONFIG_RPC="https://your-ethereum-rpc-url.com"
npm start
```

#### Default RPC Providers

The wallet includes multiple default RPC providers for each network:

- **BNB Chain**: Ankr, LlamaRPC, BlastAPI, BlockPI, Binance official
- **Ethereum**: LlamaRPC, BlastAPI, PublicNode, Cloudflare
- **Polygon**: LlamaRPC, MeowRPC, QuickNode, PublicNode
- **Arbitrum**: LlamaRPC, BlastAPI, Omniatech, PublicNode

You can enable/disable individual providers through the UI.

### OpenAI/Codex API Key Setup

Codex LLM integration requires an OpenAI-compatible API key. You can configure it in two ways:

#### Method 1: Codex Config File (Recommended)

1. Create or edit the Codex config file:
   ```bash
   # Linux/macOS
   mkdir -p ~/.codex
   nano ~/.codex/config.toml
   
   # Windows
   # Navigate to: C:\Users\YourUsername\.codex\config.toml
   ```

2. Add your API key, model, and optional base URL:
   ```toml
   api_key = "sk-your-openai-api-key-here"
   model = "gpt-4"  # Optional: specify the model to use
   base_url = "https://api.openai.com/v1"  # Optional: for custom endpoints
   ```

   **For OpenAI-compatible APIs (e.g., DeepSeek, Anthropic, etc.):**
   ```toml
   api_key = "your-api-key"
   model = "deepseek-v3.1"  # Model name for your provider
   base_url = "https://api.deepseek.com/v1"  # Your API endpoint
   ```

   **Common model examples:**
   - OpenAI: `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo`
   - DeepSeek: `deepseek-v3.1`, `deepseek-chat`
   - Anthropic Claude: `claude-3-opus`, `claude-3-sonnet`
   - Custom providers: Check your provider's documentation

3. Save the file and restart the wallet

#### Method 2: Environment Variables

You can also set API keys, model, and base URL via environment variables:

**Linux/macOS:**
```bash
export OPENAI_API_KEY="sk-your-api-key-here"
export OPENAI_MODEL="gpt-4"  # Optional: specify the model
export OPENAI_BASE_URL="https://api.openai.com/v1"  # Optional
npm start
```

**Windows (CMD):**
```cmd
set OPENAI_API_KEY=sk-your-api-key-here
set OPENAI_MODEL=gpt-4
set OPENAI_BASE_URL=https://api.openai.com/v1
npm start
```

**Windows (PowerShell):**
```powershell
$env:OPENAI_API_KEY="sk-your-api-key-here"
$env:OPENAI_MODEL="gpt-4"
$env:OPENAI_BASE_URL="https://api.openai.com/v1"
npm start
```

#### Supported Environment Variables

- `OPENAI_API_KEY` - Your OpenAI or compatible API key
- `CODEX_API_KEY` - Alternative name for API key
- `OPENAI_MODEL` - Model to use (e.g., `gpt-4`, `deepseek-v3.1`, `claude-3-opus`)
- `CODEX_MODEL` - Alternative name for model
- `OPENAI_BASE_URL` - Base URL for API (default: `https://api.openai.com/v1`)
- `CODEX_BASE_URL` - Alternative name for base URL

#### Getting an API Key

1. **OpenAI**: Get your key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. **OpenAI-Compatible APIs**: Use your provider's API key and set the `base_url` accordingly
   - DeepSeek: `https://api.deepseek.com/v1` (models: `deepseek-v3.1`, `deepseek-chat`)
   - Anthropic Claude: `https://api.anthropic.com/v1` (models: `claude-3-opus`, `claude-3-sonnet`)
   - Custom endpoints: Your provider's API URL

#### Model Configuration

The model determines which AI model is used for Codex interactions. If not specified, the default model depends on your API provider:

- **Default**: Uses the provider's default model (often `gpt-3.5-turbo` for OpenAI)
- **OpenAI Models**: `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo`, `gpt-4o`
- **DeepSeek Models**: `deepseek-v3.1`, `deepseek-chat`
- **Anthropic Models**: `claude-3-opus`, `claude-3-sonnet`, `claude-3-haiku`

You can set the model in three ways:
1. **Config file** (`~/.codex/config.toml`): `model = "gpt-4"`
2. **Environment variable**: `export OPENAI_MODEL="gpt-4"`
3. **Codex CLI**: The Codex CLI may use its own model selection

**Note**: The model must be compatible with your API provider and base URL.

#### Verifying Codex Setup

1. Start the wallet: `npm start`
2. From the main menu, select **"Launch Codex"**
3. If configured correctly, Codex will launch with wallet context
4. If not configured, you'll see instructions to set up the API key

### Default Configuration

The wallet uses default configurations stored in `src/config/config-defaults.ts`:

- **Default Network**: BNB Chain (Binance Smart Chain)
- **Supported Networks**: Ethereum, BNB Chain, Polygon, Arbitrum
- **Database Path**: `.railgun.db` (local)
- **Artifact Path**: `.artifacts-2.5` (Railgun circuit artifacts)
- **Keychain Path**: `.zKeyChains` (encrypted wallet storage)

## 🔐 Security

- **Encrypted Wallet Storage**: Wallets are encrypted with password-derived keys
- **Private Key Security**: Private keys never leave your device
- **Zero-Knowledge Proofs**: Railgun transactions use zk-SNARKs for privacy
- **On-Chain Privacy**: Transaction amounts and participants are hidden on-chain
- **Waku Network**: Decentralized broadcasting prevents single points of failure
- **Multi-Provider Support**: Redundant RPC providers for reliability
- **Railgun Audits**: Railgun smart contracts are audited and verified
- **Local Database**: All wallet data stored locally in encrypted format
- **Password Protection**: Wallet access requires password authentication

## 📝 Examples

### Starting the Wallet

```bash
$ npm start
# or
$ ./bin/tamashii

# You'll see the interactive menu:
# 1. Create New Wallet
# 2. Load Existing Wallet
# 3. Switch Network
# 4. View Balances
# 5. Shield Tokens
# 6. Private Transfer
# 7. Launch Codex
# ...
```

### Typical Workflow

1. **Create/Load Wallet**: Select from menu, enter password
2. **Select Network**: Choose BNB Chain (default) or switch to another
3. **Shield Tokens**: Move BNB or tokens to private Railgun address
4. **Make Private Transaction**: Send tokens privately to another Railgun address
5. **Use Codex**: Launch Codex for AI assistance with wallet context

### Codex Integration

```bash
# From the wallet menu, select "Launch Codex"
# Codex will have access to:
# - Current network (BNB Chain, Ethereum, etc.)
# - Your public and Railgun addresses
# - Wallet name and balances
# - Network capabilities
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

- `npm start` - Run the built application
- `npm run build` - Build TypeScript to JavaScript
- `npm run lint` - Run ESLint
- `npm run installdeps` - Install dependencies with legacy peer deps

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

