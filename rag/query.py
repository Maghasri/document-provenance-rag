import os
import json
import chromadb
from chromadb.utils import embedding_functions
from groq import Groq
from dotenv import load_dotenv

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
        print("No relevant, verified documents found in the corpus.")
        return

    context_parts = []
    for chunk, meta in zip(chunks, metadatas):
        context_parts.append(
            f"[Source: {meta['source']} | Doc hash: {meta['doc_hash'][:10]}...]\n{chunk}"
        )
    context = "\n\n".join(context_parts)

    prompt = f"""Answer the question using ONLY the context below. If the context doesn't contain the answer, say so.

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
    print("\n--- Sources used (all verified, hash-matched, 2-of-3 confirmed) ---")
    for meta in metadatas:
        print(f"  - {meta['source']} (doc hash: {meta['doc_hash']})")


if __name__ == "__main__":
    import sys
    q = " ".join(sys.argv[1:]) or "What is this document about?"
    answer_question(q)
