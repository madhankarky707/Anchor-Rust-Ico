
# 🚀 Solana ICO Program with Anchor

This project implements an **ICO (Initial Coin Offering)** smart contract on the **Solana blockchain**, built using the **Anchor framework**. It allows users to purchase a SPL token in exchange for SOL at a configurable rate. Admins can manage token prices, treasury, and ownership.

---

## 📦 Features

- Token purchase using SOL
- Admin-controlled token price updates
- Transferable ownership
- Custom treasury wallet
- Built with Anchor and SPL Token standards

---

## 🧱 Tech Stack

- [Solana](https://solana.com/)
- [Anchor Framework](https://www.anchor-lang.com/)
- [TypeScript](https://www.typescriptlang.org/)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [@solana/spl-token](https://github.com/solana-labs/solana-program-library/tree/master/token/js)

---

## 📁 Project Structure

```
.
├── Anchor.toml
├── Cargo.toml
├── programs/
│   └── tokenico/
│       └── src/lib.rs       # Main Rust program
├── tests/
│   └── tokenico.test.ts          # Integration tests
├── migrations/
├── target/
│── package.json
│── tsconfig.json
└── README.md
```

---

## 🔧 Setup Instructions

### 1. Clone the repo

```bash
git clone https://github.com/madhankarky707/Anchor-Rust-Ico.git
cd Anchor-Rust-Ico
```

### 2. Install dependencies

```bash
npm install
```

### 3. Build & Deploy Locally

```bash
anchor build
anchor test
```

### 4. Deploy to Devnet (optional)

```bash
solana config set --url devnet
anchor deploy
```

---

## 🔐 Admin Functions

- **update_price(new_price: u64)**  
  Update token price in lamports.

- **update_treasury()**  
  Change treasury wallet.

- **transfer_ownership()**  
  Transfer contract ownership.

---

## ✅ Testing

Run tests with:

```bash
anchor test
```

---

## 📜 License

MIT License.

---

## 🤝 Contributions

Contributions, issues and feature requests are welcome!  
Feel free to open a pull request.