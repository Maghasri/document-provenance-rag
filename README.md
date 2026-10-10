# Blockchain-Based Document Provenance for RAG Systems

A tamper-evident provenance layer for Retrieval-Augmented Generation (RAG). Documents are accepted only from approved sources, stored on IPFS, fingerprinted with SHA-256, and registered on an Ethereum testnet through a smart contract that requires **2-of-3 independent registrar approval** before a document counts as confirmed. The RAG pipeline ingests only documents that pass on-chain verification, and every answer is returned with the hash-traceable sources it came from.

> The blockchain does not decide whether a document's content is *true*. It provides a public, tamper-evident record that a specific document was approved and has not changed since.

**Live contract (Sepolia, verified):** [`0x9CF40A7DF7F3607d9f957FD7319448778Fb1f367`](https://sepolia.etherscan.io/address/0x9CF40A7DF7F3607d9f957FD7319448778Fb1f367#code)

## Problem

RAG systems answer from external documents. If those documents are silently modified, replaced or poisoned, the system produces untrustworthy answers and the user has no way to tell. A centralized database can rewrite both documents and their metadata without leaving a trustworthy history.

## How it works

```
Document + claimed source
        |
        v
Trusted-source check (allowlist)  --> rejected if source not approved
        |
        v
SHA-256 hash  -->  upload to IPFS (CID)
        |
        v
Owner proposes (hash, CID, source) on-chain
        |
        v
Registrar 1, 2, 3 vote  -->  confirmed once 2 of 3 approve
        |
        v
verify.py: read on-chain record, fetch file from IPFS,
recompute SHA-256, compare with registered hash
        |
        v
Valid documents only: chunk -> embed -> ChromaDB
        |
        v
Query -> retrieve chunks -> LLM answer + sources (doc hash, source)
```

### Roles in the smart contract

| Role | Can do | Cannot do |
|---|---|---|
| Owner (deployer) | Propose documents | Vote |
| Registrar 1-3 (distinct accounts) | Vote to confirm | Propose |
| Anyone | Read and verify records | Change anything |

The constructor rejects a registrar set that includes the owner or repeats an address. A document is confirmed after 2 distinct registrar votes; duplicate votes and votes after confirmation revert.

### Why a blockchain

Registrar approval is an independent, public decision that no single party, including the system operator, can rewrite after the fact. Anyone can audit the approval record without trusting the operator.

## Tech stack

- **Smart contract:** Solidity 0.8.20, Hardhat 2.22, ethers.js, Sepolia testnet, Alchemy RPC
- **Storage:** IPFS via Pinata
- **RAG:** Python, web3.py, ChromaDB, sentence-transformers (`all-MiniLM-L6-v2`), Groq (`openai/gpt-oss-20b`)

## Repository layout

```
contracts/DocumentRegistry.sol   v2 registry (owner proposes, 2-of-3 registrars confirm)
contracts/Warmup.sol             toolchain warm-up contract
test/DocumentRegistry.js         8 unit tests
scripts/registerDocument.js      source check -> hash -> IPFS -> on-chain proposal
scripts/voteDocument.js          registrar vote
scripts/evaluate.js              evaluation harness (gas, latency, tamper detection)
config/trustedSources.json       approved source domains
rag/verify.py                    on-chain + IPFS integrity verification
rag/ingest.py                    verify, chunk, embed, store
rag/query.py                     retrieval + generation with sources
rag/demo_tamper.py               tamper-detection demo
rag/demo_poison.py   injects a fake chunk to show query-time exclusion
```

## Setup

```bash
npm install
cd rag && python3 -m venv venv && source venv/bin/activate
pip install chromadb sentence-transformers web3 requests groq python-dotenv
```

Create a `.env` in the project root (never commit it) with these variables:

```
PRIVATE_KEY=                 # owner account
SEPOLIA_RPC_URL=
ETHERSCAN_API_KEY=
PINATA_JWT=
REGISTRAR1_PRIVATE_KEY=
REGISTRAR2_PRIVATE_KEY=
REGISTRAR3_PRIVATE_KEY=
GROQ_API_KEY=
```

## Usage

```bash
# Tests and evaluation (local Hardhat network)
npx hardhat test
npx hardhat run scripts/evaluate.js

# Register a document, then confirm it with two registrars
HARDHAT_NETWORK=sepolia node scripts/registerDocument.js documents/sample.txt who.int
HARDHAT_NETWORK=sepolia node scripts/voteDocument.js <docHash> 1
HARDHAT_NETWORK=sepolia node scripts/voteDocument.js <docHash> 2

# RAG (from rag/)
python3 verify.py <docHash>
python3 ingest.py <docHash>
python3 query.py "What is this document about?"
python3 demo_tamper.py
```

## Evaluation

Measured on a local Hardhat network with 100 synthetic documents:

| Metric | Result |
|---|---|
| Deployment gas | 1,442,735 |
| Gas per confirmed document | 348,700 (propose 193,726 + votes 74,033 and 80,940) |
| Verification latency | 0.30 ms mean, 0.36 ms p95 (in-memory network, no RPC or IPFS) |
| Originals wrongly rejected | 0 / 100 |
| Tampered variants rejected | 400 / 400 (bit flip, appended byte, truncation, overwritten chunk) |
| End-to-end verification on Sepolia (20 runs) | mean 7.4 s, median 6.9 s, p95 10.2 s |

Notes:
- The 100% detection rate follows from SHA-256: any change produces a hash that was never registered. It demonstrates the avalanche property, not a heuristic detector.
- Sepolia latency breakdown: IPFS public-gateway fetch about 5.6 s, RPC read about 1.7 s, SHA-256 under 0.01 ms. The cost is in network calls, not hashing or contract logic. The 0.30 ms figure in the table measures the in-memory test network only.

## Limitations

- **Garbage in, garbage out:** a document that is already poisoned before registration, or bad content from an approved source, will be confirmed like any other. Registrars are the control for this.
- **The source allowlist is a local config file.** It is not itself decentralized.
- **Registrars are three accounts I control** in this demo. The trust model is only as strong as the independence of the real registrars.
- **Retrieval-ranking manipulation** is not covered. Query-time checks exclude chunks whose document hash is unregistered or unconfirmed, and chunks whose text isn't in the verified document, but they can't tell if embeddings were altered to change which chunks rank highest.
- Testnet only. A production deployment would use a Layer-2 network such as Polygon or Arbitrum.

## Roadmap

- Document versioning and updates
- Cache verified content with a short TTL, or use a dedicated Pinata gateway, to cut IPFS fetch time
- Convert gas figures to cost on a Layer-2 network

## Version history

- **v2 (current):** owner proposes, three distinct registrars vote, 2 of 3 required.
- **v1 (deprecated):** `0xD943321Acf69BD2CCa218c9a204095dE5F5dC73c`. A registrar proposed and counted as the first vote. Superseded so that submitting and approving are separate roles.
