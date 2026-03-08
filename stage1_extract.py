"""Stage 1: Extract structured content from a scientific PDF using PyMuPDF."""

from __future__ import annotations

import re
from pathlib import Path

import fitz  # PyMuPDF


def extract_pdf(pdf_path: str | Path, output_dir: str | Path | None = None) -> dict:
    """Return structured content extracted from *pdf_path*.

    Args:
        pdf_path: Path to the PDF file.
        output_dir: Directory to save extracted figures. Defaults to pdf_path's parent.

    Returns a dict with keys:
        title, authors, abstract, sections (list[dict]),
        tables (list[str]), figures (list[dict])
    """
    pdf_path = Path(pdf_path)
    fig_dir = Path(output_dir) if output_dir else pdf_path.parent

    doc = fitz.open(str(pdf_path))
    full_text = "\n".join(page.get_text() for page in doc)

    title = _extract_title(doc)
    authors = _extract_authors(full_text)
    abstract = _extract_abstract(full_text)
    sections = _extract_sections(full_text)
    tables = _extract_tables(doc, fig_dir)
    figures = _extract_figures(doc, fig_dir)

    doc.close()
    return {
        "title": title,
        "authors": authors,
        "abstract": abstract,
        "sections": sections,
        "tables": tables,
        "figures": figures,
    }


def _extract_title(doc: fitz.Document) -> str:
    meta_title = doc.metadata.get("title", "").strip()
    if meta_title:
        return meta_title
    # Fallback: largest font on first page
    page = doc[0]
    blocks = page.get_text("dict")["blocks"]
    best, best_size = "", 0.0
    for b in blocks:
        for line in b.get("lines", []):
            for span in line.get("spans", []):
                if span["size"] > best_size:
                    best_size = span["size"]
                    best = span["text"]
    return best.strip()


def _extract_authors(text: str) -> list[str]:
    # Look for lines between title and abstract that look like author names
    m = re.search(r"(?i)abstract", text)
    if not m:
        return []
    preamble = text[: m.start()]
    lines = [l.strip() for l in preamble.split("\n") if l.strip()]
    # Heuristic: author lines contain commas or 'and', not too long
    authors: list[str] = []
    for line in lines[1:]:  # skip title
        if len(line) > 200:
            continue
        if re.search(r"[,&]|(\band\b)", line) and not re.search(r"[{}]", line):
            authors.append(line)
    return authors


def _extract_abstract(text: str) -> str:
    m = re.search(
        r"(?i)\babstract\b[:\s—\-]*\n?(.*?)(?=\n\s*\n|\n\d+[\.\s]+[A-Z]|\n[A-Z][a-z]+\n)",
        text,
        re.DOTALL,
    )
    if m:
        return " ".join(m.group(1).split())
    return ""


def _extract_sections(text: str) -> list[dict]:
    # Split on numbered section headers like "1 Introduction" or "2. Methods"
    pattern = r"\n(\d+\.?\s+[A-Z][^\n]{2,80})\n"
    parts = re.split(pattern, text)
    sections: list[dict] = []
    i = 1
    while i < len(parts) - 1:
        heading = parts[i].strip()
        body = parts[i + 1].strip()

        # Scan for cross-references to figures and tables
        fig_refs = sorted(set(
            int(m.group(1))
            for m in re.finditer(r"(?:Figure|Fig\.?)\s+(\d+)", body, re.IGNORECASE)
        ))
        table_refs = sorted(set(
            int(m.group(1))
            for m in re.finditer(r"Table\s+(\d+)", body, re.IGNORECASE)
        ))

        sections.append({
            "heading": heading,
            "body": body[:3000],
            "fig_refs": fig_refs,
            "table_refs": table_refs,
        })
        i += 2
    if not sections:
        # Fallback: treat entire text as one section
        sections.append({"heading": "Content", "body": text[:5000], "fig_refs": [], "table_refs": []})
    return sections


def _find_appendix_page(doc: fitz.Document) -> int | None:
    """Return the first page number that starts an appendix section."""
    for page_num, page in enumerate(doc):
        text = page.get_text()
        if re.search(r"(?i)^\s*appendix\b", text, re.MULTILINE):
            return page_num
    return None


def _extract_tables(doc: fitz.Document, out_dir: Path) -> list[dict]:
    """Extract tables as structured data using PyMuPDF's find_tables(), excluding appendix."""
    appendix_start = _find_appendix_page(doc)

    tables: list[dict] = []

    for page_num, page in enumerate(doc):
        if appendix_start is not None and page_num >= appendix_start:
            break

        text = page.get_text()

        # Build a map of table captions on this page
        captions: dict[int, str] = {}
        for m in re.finditer(r"(Table\s+(\d+)[^\n]*)", text, re.IGNORECASE):
            captions[int(m.group(2))] = m.group(1).strip()

        # Use PyMuPDF's built-in table finder
        try:
            found = page.find_tables()
        except Exception:
            continue

        for tab in found.tables:
            rows = tab.extract()
            if not rows or len(rows) < 2:
                continue

            columns = rows[0]
            data_rows = rows[1:]

            # Clean None values
            columns = [str(c) if c else f"Col{i}" for i, c in enumerate(columns)]
            data_rows = [[str(cell) if cell else "" for cell in row] for row in data_rows]

            # Try to match a caption from this page
            caption = ""
            if captions:
                # Use the lowest-numbered unmatched caption
                cap_num = min(captions.keys())
                caption = captions.pop(cap_num)

            tables.append({
                "columns": columns,
                "rows": data_rows,
                "caption": caption,
                "page": page_num,
            })

    return tables


def _extract_figure_captions(doc: fitz.Document) -> dict[int, list[str]]:
    """Scan each page for 'Figure N' / 'Fig. N' captions. Returns {page_num: [caption, ...]}."""
    captions: dict[int, list[str]] = {}
    for page_num, page in enumerate(doc):
        text = page.get_text()
        for m in re.finditer(r"((?:Figure|Fig\.?)\s+\d+[^\n]*)", text, re.IGNORECASE):
            captions.setdefault(page_num, []).append(m.group(1).strip())
    return captions


def _extract_figures(doc: fitz.Document, out_dir: Path) -> list[dict]:
    figures: list[dict] = []
    figs_dir = out_dir / "figures"
    figs_dir.mkdir(parents=True, exist_ok=True)

    page_captions = _extract_figure_captions(doc)

    for page_num, page in enumerate(doc):
        images = page.get_images(full=True)
        page_cap_list = list(page_captions.get(page_num, []))
        cap_idx = 0

        for img_idx, img_info in enumerate(images):
            xref = img_info[0]
            try:
                pix = fitz.Pixmap(doc, xref)
                if pix.n > 4:
                    pix = fitz.Pixmap(fitz.csRGB, pix)

                # Filter tiny images (<100px in either dimension) — likely logos/icons
                if pix.width < 100 or pix.height < 100:
                    continue

                img_path = figs_dir / f"fig_p{page_num}_{img_idx}.png"
                pix.save(str(img_path))

                caption = ""
                if cap_idx < len(page_cap_list):
                    caption = page_cap_list[cap_idx]
                    cap_idx += 1

                figures.append({
                    "path": str(img_path),
                    "page": page_num,
                    "caption": caption,
                })
            except Exception:
                continue
    return figures
