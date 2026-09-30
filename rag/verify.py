import hashlib
import json
import os
import requests
from web3 import Web3
from dotenv import load_dotenv

load_dotenv("../.env")

SEPOLIA_RPC_URL = os.environ["SEPOLIA_RPC_URL"]
REGISTRY_ADDRESS = "0x9CF40A7DF7F3607d9f957FD7319448778Fb1f367"
IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/"

w3 = Web3(Web3.HTTPProvider(SEPOLIA_RPC_URL))

with open("abi/DocumentRegistry.json") as f:
    abi = json.load(f)["abi"]

registry = w3.eth.contract(address=REGISTRY_ADDRESS, abi=abi)


def verify_document(doc_hash_hex: str) -> dict:
    """
    Fetches the document from IPFS, recomputes its SHA-256, and checks
    it against the on-chain record. Returns a dict describing the result.
    """
    doc_hash_bytes = bytes.fromhex(doc_hash_hex.replace("0x", ""))

    try:
        ipfs_cid, source, timestamp, vote_count, confirmed = registry.functions.verifyDocument(
            doc_hash_bytes
        ).call()
    except Exception:
        return {"valid": False, "reason": "Document not found on-chain"}

    if not confirmed:
        return {
            "valid": False,
            "reason": f"Document not yet confirmed ({vote_count}/2 votes)",
            "cid": ipfs_cid,
            "source": source,
        }

    resp = requests.get(IPFS_GATEWAY + ipfs_cid, timeout=15)
    if resp.status_code != 200:
        return {"valid": False, "reason": f"Could not fetch from IPFS (status {resp.status_code})"}

    actual_hash = hashlib.sha256(resp.content).hexdigest()
    expected_hash = doc_hash_hex.replace("0x", "").lower()

    if actual_hash != expected_hash:
        return {
            "valid": False,
            "reason": "HASH MISMATCH: document content does not match the registered hash — possible tampering",
            "expected_hash": expected_hash,
            "actual_hash": actual_hash,
        }

    return {
        "valid": True,
        "reason": "Hash matches, document confirmed by 2 registrars",
        "content": resp.content.decode("utf-8", errors="replace"),
        "source": source,
        "cid": ipfs_cid,
    }


if __name__ == "__main__":
    import sys
    doc_hash = sys.argv[1] if len(sys.argv) > 1 else "0xf05821e8061c9f00e07a312f836173587c96c30dce485370ed29a9762b1bde39"
    result = verify_document(doc_hash)
    print(json.dumps(result, indent=2))
