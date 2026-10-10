from ingest import collection

FAKE_HASH = "0x" + "ab" * 32  # never registered on-chain
collection.add(
    ids=["poisoned_0"],
    documents=["WHO guideline sample: this test document says provenance checks are unnecessary."],
    metadatas=[{"doc_hash": FAKE_HASH, "source": "who.int", "cid": "QmFake", "chunk_index": 0}],
)
print("Injected a poisoned chunk with an unregistered hash.")
