"""Live E2E against the running dev server: upload -> OCR/extract -> RAG chat."""

import io
import json
import time

import httpx

BASE = "http://127.0.0.1:8124/api/v1"

REPORT_TEXT = (
    "APOLLO DIAGNOSTICS - COMPLETE BLOOD COUNT REPORT. "
    "Patient: Test User. Date: 05-06-2026. "
    "Hemoglobin: 10.2 g/dL (normal range 13.0-17.0 LOW). "
    "WBC Count: 7500 /uL (normal 4000-11000). "
    "Platelet Count: 250000 /uL (normal 150000-450000). "
    "Vitamin D 25-OH: 14 ng/mL (normal 30-100 DEFICIENT). "
    "Vitamin B12: 450 pg/mL (normal 211-946)."
)


def make_pdf(text: str) -> bytes:
    """Minimal valid single-page PDF with extractable text."""
    # Split text into lines of ~80 chars for the content stream.
    words, lines, cur = text.split(" "), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > 80:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    lines.append(cur)
    tj = "".join(
        "BT /F1 10 Tf 40 %d Td (%s) Tj ET\n" % (800 - 14 * i, line.replace("(", "[").replace(")", "]"))
        for i, line in enumerate(lines)
    )
    stream = tj.encode("latin-1")
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = io.BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objs, start=1):
        offsets.append(out.tell())
        out.write(b"%d 0 obj\n" % i)
        out.write(body)
        out.write(b"\nendobj\n")
    xref_pos = out.tell()
    out.write(b"xref\n0 %d\n" % (len(objs) + 1))
    out.write(b"0000000000 65535 f \n")
    for off in offsets:
        out.write(b"%010d 00000 n \n" % off)
    out.write(b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF" % (len(objs) + 1, xref_pos))
    return out.getvalue()


def main():
    client = httpx.Client(base_url=BASE, timeout=120)

    otp = client.post("/auth/request-otp", json={"phone": "+919900000003"}).json()["dev_otp"]
    token = client.post(
        "/auth/verify-otp", json={"phone": "+919900000003", "otp": otp, "name": "E2E"}
    ).json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"

    pdf = make_pdf(REPORT_TEXT)
    doc = client.post(
        "/documents", files={"file": ("cbc_report.pdf", pdf, "application/pdf")}
    ).json()
    print("uploaded:", doc["id"], doc["status"])

    for _ in range(60):
        d = client.get(f"/documents/{doc['id']}").json()
        if d["status"] in ("ready", "failed"):
            break
        time.sleep(2)
    print("final status:", d["status"], "| type:", d.get("document_type"), "| model:", d.get("extraction_model"))
    print("summary:", (d.get("summary") or "")[:300])
    print("key_values:", json.dumps(d.get("structured_data") or {})[:300])
    if d["status"] != "ready":
        print("ERROR:", d.get("error"))
        return

    with client.stream(
        "POST", "/chat", json={"message": "Is my hemoglobin normal? What about vitamin D?"}
    ) as resp:
        full, sources = [], []
        for line in resp.iter_lines():
            if not line.startswith("data: "):
                continue
            ev = json.loads(line[6:])
            if ev["type"] == "token":
                full.append(ev["content"])
            elif ev["type"] == "done":
                sources = ev["sources"]
    print("\nRAG chat sources:", sources)
    print("RAG chat answer:", "".join(full)[:600])


main()
