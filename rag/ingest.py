import chromadb
from chromadb.utils import embedding_functions
from verify import verify_document

CHROMA_PATH = "./chroma_db"
COLLECTION_NAME = "provenance_docs"

client = chromadb.PersistentClient(path=CHROMA_PATH)

embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

collection = client.get_or_create_collection(
    name=COLLECTION_NAME,
    embedding_function=embedding_fn,
)


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return chunks


def ingest_document(doc_hash_hex: str):
    result = verify_document(doc_hash_hex)

    if not result["valid"]:
        print(f"REJECTED — not ingested. Reason: {result['reason']}")
        return

    chunks = chunk_text(result["content"])
    ids = [f"{doc_hash_hex}_{i}" for i in range(len(chunks))]
    metadatas = [
        {
            "doc_hash": doc_hash_hex,
            "source": result["source"],
            "cid": result["cid"],
            "chunk_index": i,
        }
        for i in range(len(chunks))
    ]

    collection.add(documents=chunks, ids=ids, metadatas=metadatas)
    print(f"Ingested {len(chunks)} chunk(s) from a verified document (source: {result['source']})")


if __name__ == "__main__":
    import sys
    doc_hash = sys.argv[1] if len(sys.argv) > 1 else "0xf05821e8061c9f00e07a312f836173587c96c30dce485370ed29a9762b1bde39"
    ingest_document(doc_hash)
