"""End-to-end integration test suite for DocuMind RAG FastAPI backend."""

from io import BytesIO
from fastapi.testclient import TestClient
from server import app

client = TestClient(app)


def generate_valid_pdf_bytes(title: str) -> bytes:
    """Construct a clean, valid standard PDF with extractable text."""
    parts = [
        b"%PDF-1.4\n",
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>\nendobj\n",
    ]
    text_stream = f"BT /F1 12 Tf 72 712 Td ({title}) Tj ET\n".encode("utf-8")
    obj4 = b"4 0 obj\n<< /Length " + str(len(text_stream)).encode() + b" >>\nstream\n" + text_stream + b"endstream\nendobj\n"
    parts.append(obj4)

    offsets = [0]
    cur = len(parts[0])
    for p in parts[1:]:
        offsets.append(cur)
        cur += len(p)

    xref = b"xref\n0 5\n0000000000 65535 f \n"
    for off in offsets[1:]:
        xref += f"{off:010d} 00000 n \n".encode()

    trailer = b"trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n" + str(cur).encode() + b"\n%%EOF\n"
    return b"".join(parts) + xref + trailer


def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["api_key_configured"] is True
    assert data["env_file_found"] is True
    print("[PASS] Health probe passed: API key configured & .env verified.")


def test_status():
    res = client.get("/api/status")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["collection_name"] == "document_qa"
    assert data["api_key_configured"] is True
    print(f"[PASS] Status check passed. Indexed chunks: {data['total_chunks']}, Documents: {data['total_documents']}")


def test_pdf_and_txt_indexing_and_query():
    # 1. Test TXT upload
    txt_content = (
        "Enterprise Security Guidelines.\n\n"
        "All database credentials and API keys must be retained exclusively on backend environments.\n"
        "Frontend clients should communicate solely via reverse proxies and authenticated endpoints."
    )
    txt_files = [
        ("files", ("security_policy.txt", txt_content.encode("utf-8"), "text/plain"))
    ]
    res_txt = client.post("/api/documents/upload", files=txt_files)
    assert res_txt.status_code == 200
    data_txt = res_txt.json()
    assert data_txt["indexed_files"] == 1
    assert data_txt["total_chunks"] >= 1
    print(f"[PASS] TXT upload succeeded: {data_txt['total_chunks']} chunk(s) indexed.")

    # 2. Test PDF upload
    pdf_bytes = generate_valid_pdf_bytes("Quantum Computing Principles and Qubit Stability 2026")
    pdf_files = [
        ("files", ("quantum_computing_test.pdf", pdf_bytes, "application/pdf"))
    ]
    res_pdf = client.post("/api/documents/upload", files=pdf_files)
    assert res_pdf.status_code == 200
    data_pdf = res_pdf.json()
    assert data_pdf["indexed_files"] == 1
    assert data_pdf["total_chunks"] >= 1
    print(f"[PASS] PDF upload succeeded: {data_pdf['total_chunks']} chunk(s) indexed.")

    # 3. Query the TXT content
    res_q1 = client.post(
        "/api/query",
        json={
            "question": "Where should API keys and database credentials be stored according to security policy?",
            "max_distance": 0.85,
            "top_k": 3,
        },
    )
    assert res_q1.status_code == 200
    q1_data = res_q1.json()
    assert q1_data["is_supported"] is True
    assert len(q1_data["relevant_sources"]) > 0
    print("[PASS] Grounded query on TXT doc returned supported answer with sources.")

    # 4. Clean up test documents safely
    del_txt = client.delete("/api/documents/security_policy.txt")
    assert del_txt.status_code == 200
    del_pdf = client.delete("/api/documents/quantum_computing_test.pdf")
    assert del_pdf.status_code == 200
    print("[PASS] Cleaned up temporary test documents successfully.")


def test_unsupported_query():
    res = client.post(
        "/api/query",
        json={
            "question": "What is the average surface wind speed on the exoplanet Proxima Centauri b?",
            "max_distance": 0.65,
            "top_k": 3,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_supported"] is False or len(data["relevant_sources"]) == 0
    print("[PASS] Unsupported query handled appropriately without hallucinations.")


if __name__ == "__main__":
    test_health()
    test_status()
    test_pdf_and_txt_indexing_and_query()
    test_unsupported_query()
    print("\nALL EXPANDED INTEGRATION TESTS PASSED CLEANLY!")
