import os
import chromadb
from chromadb.utils import embedding_functions
from groq import Groq
from dotenv import load_dotenv
from verify import verify_document

load_dotenv("../.env")

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

groq_client = Groq(api_key=os.environ["GROQ_API_KEY"])


def answer_question(question: str, n_results: int = 3):
    results = collection.query(query_texts=[question], n_results=n_results)
    chunks = results["documents"][0]
    metadatas = results["metadatas"][0]

    if not chunks:
        print("No relevant documents found in the corpus.")
        return

    # Re-verify each distinct source document against the chain at query time
    verified = {}
    for meta in metadatas:
        h = meta["doc_hash"]
        if h not in verified:
            verified[h] = verify_document(h)

    trusted = []
    for chunk, meta in zip(chunks, metadatas):
        v = verified[meta["doc_hash"]]
        short = meta["doc_hash"][:10]
        if not v["valid"]:
            print(f"✗ EXCLUDED chunk from {short}...: {v['reason']}")
            continue
        if chunk not in " ".join(v["content"].split()):
            print(f"✗ EXCLUDED chunk from {short}...: text does not match the verified document")
            continue
        trusted.append((chunk, meta))

    if not trusted:
        print("No retrieved chunk passed verification. Refusing to answer.")
        return

    context = "\n\n".join(
        f"[Source: {m['source']} | Doc hash: {m['doc_hash'][:10]}...]\n{c}"
        for c, m in trusted
    )

    prompt = f"""Answer the question using ONLY the context below. If the context doesn't contain the answer, reply with exactly:NO_ANSWER.

Context:
{context}

Question: {question}

Answer:"""

    response = groq_client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[{"role": "user", "content": prompt}],
    )

    answer = response.choices[0].message.content
    print("Answer:\n", answer)
    if "NO_ANSWER" in answer:
        print("No verified document answers this question.")
        return
    print("--- Retrieved and verified context ---")
    for h in dict.fromkeys(m["doc_hash"] for _, m in trusted):
        src = verified[h]["source"]
        print(f"  ✓ {src} (doc hash: {h})")


if __name__ == "__main__":
    import sys
    q = " ".join(sys.argv[1:]) or "What is this document about?"
    answer_question(q)

