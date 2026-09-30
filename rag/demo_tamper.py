import hashlib
import json
from verify import registry

REGISTERED_HASH = "f05821e8061c9f00e07a312f836173587c96c30dce485370ed29a9762b1bde39"

def check_against_chain(doc_hash_hex, claimed_content: bytes):
    doc_hash_bytes = bytes.fromhex(doc_hash_hex)
    cid, source, timestamp, vote_count, confirmed = registry.functions.verifyDocument(doc_hash_bytes).call()

    actual_hash = hashlib.sha256(claimed_content).hexdigest()

    if actual_hash != doc_hash_hex.lower():
        return {
            "valid": False,
            "reason": "HASH MISMATCH: content does not match the registered hash — tampering detected",
            "expected_hash": doc_hash_hex,
            "actual_hash": actual_hash,
        }
    return {"valid": True, "reason": "Hash matches"}


print("=== Case 1: genuine, untouched content ===")
genuine = b"WHO guideline sample: this is a test document for provenance.\n"
print(json.dumps(check_against_chain(REGISTERED_HASH, genuine), indent=2))

print("\n=== Case 2: someone claims THIS is the same registered document ===")
tampered = b"WHO guideline sample: this is a MODIFIED test document for provenance.\n"
print(json.dumps(check_against_chain(REGISTERED_HASH, tampered), indent=2))
