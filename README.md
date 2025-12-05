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

A privacy-enhanced command-line EVM wallet with integrated **Codex LLM** support. Built on **Railgun** for zero-knowledge private transactions on **BNB Chain** (default). Features private token transfers, swaps, and AI-powered assistance through open source LLM models (Llama, Mistral, Qwen, and more). **Railgun is used to pay for GPU resources** required for LLM inference and cryptographic operations.

## 🌟 Features

- **Privacy-Enhanced Wallet**: Full EVM wallet with Railgun zero-knowledge privacy protocol integration
- **Multi-Chain Support**: Ethereum, BNB Chain (default), Polygon, and Arbitrum networks
- **Private Transactions**: Shield/unshield tokens with complete transaction privacy using zk-SNARKs
- **Codex LLM Integration**: AI-powered assistance via Codex CLI with open source models for coding and development tasks
- **Railgun GPU Payments**: Pay for GPU resources (LLM inference, zk-SNARK generation) using private Railgun transactions
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
- Configure API key for Codex (supports open source models)
- Use Codex with wallet context (addresses, network info)
- GPU resources for LLM inference are paid via private Railgun transactions

**Ease Payment System:**
- Pay for sessions using private BNB transactions
- Verify payment receipts
- Cross-contract calls with private token payments

**GPU Resource Payments:**
- Pay for GPU resources (LLM inference, zk-SNARK generation) using private Railgun transactions
- Payments are private and untraceable on-chain
- Automatic payment processing when GPU resources are requested

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
- **GPU Resource Payments**: Pay for GPU resources (LLM inference, cryptographic operations) using private Railgun transactions
- **zk-SNARK Proofs**: Zero-knowledge proofs hide transaction amounts, sender, and receiver
- **On-Chain Privacy**: Private transactions are verified on-chain without revealing details
- **Multi-Chain Support**: Railgun privacy available on Ethereum, BNB Chain, Polygon, and Arbitrum
- **BNB Chain Default**: Optimized for BNB Chain with native BNB and BEP-20 token support
- **Waku Broadcasting**: Decentralized transaction relay through Waku network
- **POI Proofs**: Proof of Innocence system for regulatory compliance

### Codex LLM Integration

AI-powered assistance through Codex CLI with open source models:

- **Codex CLI Integration**: Seamless integration with Codex command-line tool
- **Open Source Models**: Supports Llama, Mistral, Qwen, Gemma, Phi, and other open source models
- **TEE GPU Encryption**: Uses Trusted Execution Environment (TEE) encryption for GPU-accelerated model inference
- **Railgun GPU Payments**: GPU resources for LLM inference are paid for using private Railgun transactions on BNB Chain
- **Wallet Context**: Codex has access to wallet information (addresses, network, balances)
- **API Key Authentication**: Secure API key-based authentication
- **Development Assistance**: Get AI help for coding, debugging, and development tasks
- **Privacy-Focused**: Codex queries are handled locally with your API key, payments remain private

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

### Codex API Key Setup

Codex LLM integration requires an OpenAI-compatible API key for open source models. You can configure it in two ways:

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
   api_key = "your-api-key-here"
   model = "llama-3.1-70b-instruct"  # Optional: specify the open source model to use
   base_url = "https://api.together.xyz/v1"  # Optional: for custom endpoints
   ```

   **For OpenAI-compatible APIs with open source models:**
   ```toml
   api_key = "your-api-key"
   model = "mistral-7b-instruct"  # Open source model name
   base_url = "https://api.mistral.ai/v1"  # Your API endpoint
   ```

   **Common open source model examples:**
   - Llama (Meta): `llama-3.1-70b-instruct`, `llama-3-70b-instruct`, `llama-2-70b-chat`
   - Mistral: `mistral-7b-instruct`, `mixtral-8x7b-instruct`, `mistral-large`
   - Qwen (Alibaba): `qwen-2.5-72b-instruct`, `qwen-1.5-72b-chat`
   - Gemma (Google): `gemma-7b-it`, `gemma-2b-it`
   - Phi (Microsoft): `phi-3-medium`, `phi-2`
   - Custom providers: Check your provider's documentation

3. Save the file and restart the wallet

#### Method 2: Environment Variables

You can also set API keys, model, and base URL via environment variables:

**Linux/macOS:**
```bash
export OPENAI_API_KEY="your-api-key-here"
export OPENAI_MODEL="llama-3.1-70b-instruct"  # Optional: specify the open source model
export OPENAI_BASE_URL="https://api.together.xyz/v1"  # Optional
npm start
```

**Windows (CMD):**
```cmd
set OPENAI_API_KEY=your-api-key-here
set OPENAI_MODEL=llama-3.1-70b-instruct
set OPENAI_BASE_URL=https://api.together.xyz/v1
npm start
```

**Windows (PowerShell):**
```powershell
$env:OPENAI_API_KEY="your-api-key-here"
$env:OPENAI_MODEL="llama-3.1-70b-instruct"
$env:OPENAI_BASE_URL="https://api.together.xyz/v1"
npm start
```

#### Supported Environment Variables

- `OPENAI_API_KEY` - Your API key for open source model providers (Together AI, Hugging Face, Groq, etc.)
- `CODEX_API_KEY` - Alternative name for API key
- `OPENAI_MODEL` - Open source model to use (e.g., `llama-3.1-70b-instruct`, `mistral-7b-instruct`, `qwen-2.5-72b-instruct`)
- `CODEX_MODEL` - Alternative name for model
- `OPENAI_BASE_URL` - Base URL for API (e.g., `https://api.together.xyz/v1` for open source models)
- `CODEX_BASE_URL` - Alternative name for base URL

#### Getting an API Key

1. **Together AI**: Get your key from [together.ai](https://together.ai) - supports Llama, Mistral, Qwen, and more
2. **OpenAI-Compatible APIs with Open Source Models**: Use your provider's API key and set the `base_url` accordingly
   - Together AI: `https://api.together.xyz/v1` (models: `llama-3.1-70b-instruct`, `mistral-7b-instruct`, `qwen-2.5-72b-instruct`)
   - Hugging Face: `https://api-inference.huggingface.co/v1` (models: `meta-llama/Llama-3.1-70B-Instruct`, `mistralai/Mistral-7B-Instruct-v0.2`)
   - Groq: `https://api.groq.com/openai/v1` (models: `llama-3.1-70b-versatile`, `mixtral-8x7b-32768`)
   - Local LLM servers: Use `http://localhost:8000/v1` for local models (Ollama, LM Studio, etc.)
   - Custom endpoints: Your provider's API URL

#### Model Configuration

The model determines which open source AI model is used for Codex interactions. If not specified, the default model depends on your API provider:

- **Default**: Uses the provider's default model
- **Llama Models (Meta)**: `llama-3.1-70b-instruct`, `llama-3-70b-instruct`, `llama-2-70b-chat`
- **Mistral Models**: `mistral-7b-instruct`, `mixtral-8x7b-instruct`, `mistral-large`
- **Qwen Models (Alibaba)**: `qwen-2.5-72b-instruct`, `qwen-1.5-72b-chat`, `qwen-2-72b-instruct`
- **Gemma Models (Google)**: `gemma-7b-it`, `gemma-2b-it`
- **Phi Models (Microsoft)**: `phi-3-medium`, `phi-2`

You can set the model in three ways:
1. **Config file** (`~/.codex/config.toml`): `model = "llama-3.1-70b-instruct"`
2. **Environment variable**: `export OPENAI_MODEL="llama-3.1-70b-instruct"`
3. **Codex CLI**: The Codex CLI may use its own model selection

**Note**: The model must be compatible with your API provider and base URL. Check your provider's documentation for available open source models.

### TEE Encryption for GPUs

Tamashii Terminal uses **Trusted Execution Environment (TEE)** encryption for GPU-accelerated operations, providing hardware-level security for sensitive computations.

#### What is TEE Encryption?

TEE (Trusted Execution Environment) is a secure area of a processor that ensures code and data loaded inside are protected with respect to confidentiality and integrity. When used with GPUs, TEE encryption provides:

- **Hardware-Level Isolation**: GPU operations run in an isolated, encrypted environment
- **Memory Protection**: GPU memory is encrypted and protected from unauthorized access
- **Secure Key Management**: Encryption keys are managed within the TEE, never exposed to the host system
- **Attestation**: TEE can prove its integrity and authenticity to remote parties

#### How TEE Works with GPUs

1. **Initialization**: When GPU operations begin, the TEE is initialized with your authentication credentials
2. **Key Derivation**: Encryption keys are derived from your password using secure key derivation functions (scrypt)
3. **GPU Memory Encryption**: All data sent to the GPU is encrypted before processing
4. **Secure Execution**: Model inference and cryptographic operations run within the TEE
5. **Result Decryption**: Results are decrypted only within the secure TEE environment

#### Authentication Flow

The authentication process for TEE-encrypted GPU operations works as follows:

1. **Password Entry**: You enter your wallet password when prompted
2. **Password Hashing**: The password is hashed using SHA-256 and salted with a unique salt
3. **Key Derivation**: A 256-bit encryption key is derived from the hashed password using scrypt (131,072 iterations)
4. **TEE Initialization**: The derived key is used to initialize the TEE on the GPU
5. **Session Management**: The hashed password is cached in memory for the session (never stored on disk)
6. **Verification**: Each operation verifies the password hash matches before proceeding

#### Security Features

- **Password Validation**: Minimum 8 characters required, validated on each use
- **Hash Comparison**: Password hashes are compared to prevent unauthorized access
- **Session Timeout**: Cached passwords are cleared when operations complete
- **No Plaintext Storage**: Passwords are never stored in plaintext, only hashed values
- **GPU Memory Isolation**: Encrypted data in GPU memory cannot be read by the host system

#### Supported GPU Operations

TEE encryption is used for:

- **LLM Model Inference**: Open source model inference runs in encrypted GPU memory (paid via Railgun)
- **Zero-Knowledge Proof Generation**: zk-SNARK proof generation uses TEE-encrypted GPU acceleration (paid via Railgun)
- **Cryptographic Operations**: Wallet encryption/decryption operations
- **Transaction Signing**: Private key operations within the TEE

#### GPU Resource Payment via Railgun

GPU resources are paid for using private Railgun transactions:

1. **Resource Request**: When GPU operations are needed (LLM inference, zk-SNARK generation), a payment request is created
2. **Private Payment**: Payment is made using Railgun's private transaction system on BNB Chain
3. **Zero-Knowledge Privacy**: The payment amount, sender, and recipient remain private on-chain
4. **Resource Access**: Once payment is verified, GPU resources are allocated for the requested operation
5. **TEE Execution**: Operations run within the TEE-encrypted GPU environment

**Benefits:**
- **Privacy**: GPU resource payments are completely private and untraceable
- **Security**: Payments are verified on-chain without revealing transaction details
- **Efficiency**: Direct payment for GPU resources without intermediaries
- **Transparency**: Payment verification is public while transaction details remain private

#### Configuration

TEE encryption is automatically enabled when:
- A GPU is detected on your system
- You're using GPU-accelerated model providers
- Performing cryptographic operations that benefit from GPU acceleration

No additional configuration is required - TEE encryption is transparent and automatic.

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
- **TEE GPU Encryption**: Trusted Execution Environment encryption for GPU-accelerated operations
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

