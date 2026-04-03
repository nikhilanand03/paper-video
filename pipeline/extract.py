"""Stage 1: Extract structured content from a scientific PDF.

Uses Reducto API for text/table extraction and PyMuPDF for full-figure rendering.
Stops at the appendix boundary (References / Appendix) — main body only.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import fitz  # PyMuPDF — used to render full figures from the PDF pages
import httpx
from reducto import Reducto

from pipeline import config

# Section headings that mark the end of main content
_APPENDIX_PATTERNS = re.compile(
    r"^(?:"
    r"references"
    r"|bibliography"
    r"|appendix"
    r"|appendices"
    r"|supplementary"
    r"|acknowledgements?"
    r"|acknowledgments?"
    r"|[A-Z]\s+[A-Z]"  # e.g. "A Options-Based Vector Generation"
    r")$",
    re.IGNORECASE,
)

_APPENDIX_LETTER_PATTERN = re.compile(
    r"^[A-Z](?:\.\d+)?\s+[A-Z]",  # "A Options-Based...", "B.1 Main Experiments..."
)


def _is_appendix_heading(heading: str) -> bool:
    """Return True if *heading* marks the start of appendix/references."""
    h = heading.strip()
    if _APPENDIX_PATTERNS.match(h):
        return True
    if _APPENDIX_LETTER_PATTERN.match(h):
        return True
    # Numbered "7 Limitations" is fine, but bare "References" is a cutoff
    if h.lower().startswith("reference"):
        return True
    return False


def extract_pdf(pdf_path: str | Path, output_dir: str | Path | None = None) -> dict:
    """Return structured content extracted from *pdf_path* via Reducto + PyMuPDF.

    Creates an output directory with:
        - text.json      — title, authors, abstract, sections (paragraphs + fig/table refs)
        - figures/        — full figure images rendered from PDF pages
        - figures.json    — figure metadata (path, page, caption)
        - tables/         — one JSON file per table
        - tables.json     — table index (caption, page, file path)

    Extraction stops at References/Appendix — only main body content is included.
    """
    pdf_path = Path(pdf_path)
    out_dir = Path(output_dir) if output_dir else pdf_path.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    api_key = config.get("reducto_api_key")
    client = Reducto(api_key=api_key)

    # Upload the PDF
    upload = client.upload(file=pdf_path)

    # Parse with tables as JSON and figure descriptions
    result = client.parse.run(
        input=upload,
        enhance={
            "summarize_figures": True,
        },
        formatting={
            "table_output_format": "json",
        },
        retrieval={
            "chunking": {"chunk_mode": "section"},
            "filter_blocks": ["Header", "Footer"],
        },
    )

    # Handle URL vs inline results
    if hasattr(result.result, "url") and result.result.url:
        raw = httpx.get(result.result.url).json()
        chunks = raw if isinstance(raw, list) else raw.get("chunks", [])
    else:
        chunks = result.result.chunks

    # --- Pass 1: Walk Reducto blocks, build sections/tables, collect figure captions ---
    title = ""
    authors: list[str] = []
    abstract = ""
    sections: list[dict] = []
    raw_tables: list[dict] = []
    # Collect figure caption text + page from Reducto (we render images ourselves)
    figure_captions: list[dict] = []  # [{caption, page}]

    current_section_heading = ""
    current_section_paragraphs: list[str] = []
    current_fig_refs: list[int] = []
    current_table_refs: list[int] = []
    hit_appendix = False

    def _flush_section():
        nonlocal current_section_heading, current_section_paragraphs
        nonlocal current_fig_refs, current_table_refs
        if current_section_paragraphs:
            body = "\n\n".join(current_section_paragraphs)
            sections.append({
                "heading": current_section_heading or "Content",
                "body": body,
                "paragraphs": list(current_section_paragraphs),
                "fig_refs": sorted(set(current_fig_refs)),
                "table_refs": sorted(set(current_table_refs)),
            })
        current_section_heading = ""
        current_section_paragraphs = []
        current_fig_refs = []
        current_table_refs = []

    table_counter = 0

    for chunk in chunks:
        if hit_appendix:
            break
        blocks = chunk.blocks if hasattr(chunk, "blocks") else chunk.get("blocks", [])
        for block in blocks:
            if hit_appendix:
                break

            btype = block.type if hasattr(block, "type") else block.get("type", "")
            content = block.content if hasattr(block, "content") else block.get("content", "")
            page = None
            if hasattr(block, "bbox") and block.bbox:
                page = block.bbox.page if hasattr(block.bbox, "page") else block.bbox.get("page")
            elif isinstance(block, dict) and block.get("bbox"):
                page = block["bbox"].get("page")

            if btype == "Title":
                if not title:
                    title = content.strip()

            elif btype == "Section Header":
                heading = content.strip()
                # Check appendix boundary
                if _is_appendix_heading(heading):
                    _flush_section()
                    hit_appendix = True
                    break
                _flush_section()
                current_section_heading = heading

            elif btype in ("Text", "List Item", "Key Value"):
                text = content.strip()
                if not text:
                    continue

                # Detect abstract
                if not abstract and re.match(r"(?i)^abstract\b", text):
                    abstract = re.sub(r"(?i)^abstract[:\s—\-]*", "", text).strip()
                    continue

                # Detect author lines (before first section, after title)
                if not sections and not current_section_heading and title and not abstract:
                    if len(text) < 200 and re.search(r"[,&]|(\band\b)", text):
                        authors.append(text)
                        continue

                # Scan for figure/table cross-references
                for m in re.finditer(r"(?:Figure|Fig\.?)\s+(\d+)", text, re.IGNORECASE):
                    current_fig_refs.append(int(m.group(1)))
                for m in re.finditer(r"Table\s+(\d+)", text, re.IGNORECASE):
                    current_table_refs.append(int(m.group(1)))

                current_section_paragraphs.append(text)

            elif btype == "Table":
                table_counter += 1
                table_data = _parse_table_content(content)

                caption = ""
                cap_match = re.search(
                    r"(Table\s+\d+[^\n]*)",
                    "\n".join(current_section_paragraphs[-3:]) if current_section_paragraphs else "",
                    re.IGNORECASE,
                )
                if cap_match:
                    caption = cap_match.group(1).strip()

                raw_tables.append({
                    "table_number": table_counter,
                    "columns": table_data.get("columns", []),
                    "rows": table_data.get("rows", []),
                    "caption": caption,
                    "page": page,
                    "raw_content": content,
                })
                current_table_refs.append(table_counter)

            elif btype == "Figure":
                figure_captions.append({
                    "caption": content.strip(),
                    "page": page,
                })
                # Try to extract figure number from caption text
                cap_num_match = re.search(r"(?:Figure|Fig\.?)\s+(\d+)", content, re.IGNORECASE)
                if cap_num_match:
                    current_fig_refs.append(int(cap_num_match.group(1)))

    # Flush the last section
    if not hit_appendix:
        _flush_section()

    # If no sections found, use abstract as fallback
    if not sections and (title or abstract):
        sections.append({
            "heading": "Content",
            "body": abstract or title,
            "paragraphs": [abstract or title],
            "fig_refs": [],
            "table_refs": [],
        })

    # --- Pass 2: Extract full figures from PDF using PyMuPDF ---
    figures_meta = _extract_full_figures(pdf_path, out_dir, figure_captions)

    # --- Save tables as individual JSON files ---
    tables_dir = out_dir / "tables"
    tables_dir.mkdir(parents=True, exist_ok=True)
    tables_meta: list[dict] = []

    for tbl in raw_tables:
        tbl_num = tbl["table_number"]
        tbl_path = tables_dir / f"table_{tbl_num}.json"

        tbl_data = {
            "table_number": tbl_num,
            "caption": tbl.get("caption", ""),
            "page": tbl.get("page"),
            "columns": tbl.get("columns", []),
            "rows": tbl.get("rows", []),
        }
        tbl_path.write_text(json.dumps(tbl_data, indent=2))

        tables_meta.append({
            "table_number": tbl_num,
            "path": str(tbl_path),
            "caption": tbl.get("caption", ""),
            "page": tbl.get("page"),
            "columns": tbl.get("columns", []),
            "rows": tbl.get("rows", []),
        })

    # Save all metadata files
    (out_dir / "tables.json").write_text(json.dumps(tables_meta, indent=2))
    (out_dir / "figures.json").write_text(json.dumps(figures_meta, indent=2))

    text_output = {
        "title": title,
        "authors": authors,
        "abstract": abstract,
        "sections": sections,
    }
    (out_dir / "text.json").write_text(json.dumps(text_output, indent=2))

    return {
        "title": title,
        "authors": authors,
        "abstract": abstract,
        "sections": sections,
        "tables": tables_meta,
        "figures": figures_meta,
    }


# ---------------------------------------------------------------------------
# Full-figure extraction via PyMuPDF page rendering
# ---------------------------------------------------------------------------

def _extract_full_figures(
    pdf_path: Path, out_dir: Path, figure_captions: list[dict]
) -> list[dict]:
    """Render full figures from the PDF by locating 'Figure N' captions on each page
    and capturing the figure region as a single image.

    Instead of extracting embedded sub-images (which splits composite figures),
    we find the caption text position on the page, then render the region above
    the caption that contains the actual figure.
    """
    figs_dir = out_dir / "figures"
    figs_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(str(pdf_path))
    figures_meta: list[dict] = []
    seen_figure_nums: set[int] = set()

    for page_num in range(len(doc)):
        page = doc[page_num]
        text_dict = page.get_text("dict")
        page_rect = page.rect
        page_width = page_rect.width
        page_height = page_rect.height

        # Find all "Figure N" caption positions on this page
        caption_hits = _find_figure_caption_positions(text_dict, page_num)

        for fig_num, cap_rect, cap_text in caption_hits:
            if fig_num in seen_figure_nums:
                continue
            seen_figure_nums.add(fig_num)

            # Find the Reducto caption/description for this figure
            reducto_caption = ""
            for rc in figure_captions:
                rc_text = rc.get("caption", "")
                if re.search(rf"(?:Figure|Fig\.?)\s+{fig_num}\b", rc_text, re.IGNORECASE):
                    reducto_caption = rc_text
                    break

            # Determine the figure region: extend upward from caption to capture
            # the image. We look for the content boundary above the caption.
            fig_rect = _compute_figure_rect(
                text_dict, cap_rect, page_rect, fig_num
            )

            # Render at 2x resolution for quality
            clip = fitz.Rect(fig_rect)
            mat = fitz.Matrix(2.0, 2.0)
            pix = page.get_pixmap(matrix=mat, clip=clip)

            img_path = figs_dir / f"figure_{fig_num}.png"
            pix.save(str(img_path))

            figures_meta.append({
                "figure_number": fig_num,
                "path": str(img_path),
                "page": page_num + 1,  # 1-indexed to match Reducto convention
                "caption": cap_text,
                "description": reducto_caption,
            })

    doc.close()

    # Sort by figure number
    figures_meta.sort(key=lambda f: f["figure_number"])
    return figures_meta


def _find_figure_caption_positions(
    text_dict: dict, page_num: int
) -> list[tuple[int, fitz.Rect, str]]:
    """Find 'Figure N' caption text positions on a page.

    Returns list of (figure_number, caption_rect, full_caption_text).
    """
    hits: list[tuple[int, fitz.Rect, str]] = []
    seen_nums: set[int] = set()

    for block in text_dict.get("blocks", []):
        if block.get("type") != 0:  # text block
            continue
        for line in block.get("lines", []):
            line_text = "".join(span["text"] for span in line.get("spans", []))
            # Match "Figure N" or "Fig. N" at the start of a line (caption line)
            m = re.match(r"((?:Figure|Fig\.?)\s+(\d+)[.:]\s*.*)", line_text, re.IGNORECASE)
            if not m:
                continue
            fig_num = int(m.group(2))
            if fig_num in seen_nums:
                continue
            seen_nums.add(fig_num)

            # Build the bounding rect for this caption line
            spans = line.get("spans", [])
            if not spans:
                continue
            x0 = min(s["bbox"][0] for s in spans)
            y0 = min(s["bbox"][1] for s in spans)
            x1 = max(s["bbox"][2] for s in spans)
            y1 = max(s["bbox"][3] for s in spans)
            cap_rect = fitz.Rect(x0, y0, x1, y1)

            # Collect the full caption text (may span multiple lines in the same block)
            full_caption = _collect_full_caption(block, line_text, line)

            hits.append((fig_num, cap_rect, full_caption))

    return hits


def _collect_full_caption(block: dict, first_line_text: str, first_line: dict) -> str:
    """Collect the full caption text starting from the Figure N line,
    continuing through subsequent lines in the same block."""
    lines = block.get("lines", [])
    collecting = False
    parts = []
    for line in lines:
        if line is first_line:
            collecting = True
        if collecting:
            line_text = "".join(span["text"] for span in line.get("spans", []))
            parts.append(line_text.strip())
            # Stop if we hit a blank line or a new paragraph indicator
            if not line_text.strip():
                break
    return " ".join(parts).strip() if parts else first_line_text


def _compute_figure_rect(
    text_dict: dict,
    cap_rect: fitz.Rect,
    page_rect: fitz.Rect,
    fig_num: int,
) -> fitz.Rect:
    """Compute the bounding rect for the figure image ABOVE its caption.

    The rect captures only the figure content — caption text is excluded.

    Strategy:
    1. Determine the column from the caption's x-position.
    2. Find image blocks (type=1) in the same column above the caption.
    3. Find body-text boundaries in the same column.
    4. Crop horizontally to the column, vertically from body-text boundary
       to just above the caption.
    """
    cap_top = cap_rect.y0
    cap_x0 = cap_rect.x0
    cap_x1 = cap_rect.x1
    cap_cx = (cap_x0 + cap_x1) / 2  # caption center x
    page_mid = (page_rect.x0 + page_rect.x1) / 2

    def _in_same_column(block_rect: fitz.Rect) -> bool:
        """Check if a block is in the same column as the caption."""
        block_cx = (block_rect.x0 + block_rect.x1) / 2
        # Both on left side or both on right side of page midpoint
        return (cap_cx < page_mid) == (block_cx < page_mid)

    # Collect image blocks in the same column, above the caption
    col_images: list[fitz.Rect] = []
    for block in text_dict.get("blocks", []):
        if block.get("type") == 1:  # image block
            br = fitz.Rect(block["bbox"])
            if br.y1 < cap_top + 10 and br.y0 < cap_top and _in_same_column(br):
                col_images.append(br)

    # Collect body-text bottoms in the same column, above the caption
    body_text_bottoms: list[float] = []
    for block in text_dict.get("blocks", []):
        if block.get("type") != 0:
            continue
        br = fitz.Rect(block["bbox"])
        if br.y1 >= cap_top - 2:
            continue
        if not _in_same_column(br):
            continue

        block_text = ""
        for line in block.get("lines", []):
            block_text += "".join(s["text"] for s in line.get("spans", []))

        # Skip other figure captions
        if re.match(r"(?:Figure|Fig\.?)\s+\d+", block_text.strip(), re.IGNORECASE):
            continue

        # Only count substantial text as body text (not axis labels/legends)
        if len(block_text.strip()) > 80:
            body_text_bottoms.append(br.y1)

    # --- Vertical extent ---
    # Top: extend to cover image blocks, bounded by body text
    if col_images:
        fig_top = min(img.y0 for img in col_images) - 5
    else:
        # Vector graphics — generous upward extension
        fig_top = cap_top - page_rect.height * 0.40

    if body_text_bottoms:
        fig_top = max(fig_top, max(body_text_bottoms) + 2)

    fig_top = max(fig_top, page_rect.y0)

    # Bottom: stop just ABOVE the caption text (no caption in the image)
    fig_bottom = cap_top - 3

    # --- Horizontal extent ---
    # Use image block bounds in this column + caption bounds
    fig_x0 = cap_x0
    fig_x1 = cap_x1
    for img in col_images:
        fig_x0 = min(fig_x0, img.x0)
        fig_x1 = max(fig_x1, img.x1)

    # Add small padding
    fig_x0 = max(fig_x0 - 8, page_rect.x0)
    fig_x1 = min(fig_x1 + 8, page_rect.x1)

    return fitz.Rect(
        fig_x0,
        fig_top,
        fig_x1,
        min(fig_bottom, page_rect.y1),
    )


# ---------------------------------------------------------------------------
# Table content parsing
# ---------------------------------------------------------------------------

def _parse_table_content(content: str) -> dict:
    """Parse Reducto's JSON table content into columns + rows."""
    try:
        data = json.loads(content)
        if isinstance(data, list) and len(data) >= 1:
            columns = [str(c) for c in data[0]]
            rows = [[str(cell) for cell in row] for row in data[1:]]
            return {"columns": columns, "rows": rows}
    except (json.JSONDecodeError, TypeError):
        pass

    # Fallback: try to parse markdown table
    lines = [l.strip() for l in content.strip().split("\n") if l.strip()]
    if len(lines) >= 2 and "|" in lines[0]:
        columns = [c.strip() for c in lines[0].split("|") if c.strip()]
        rows = []
        for line in lines[2:]:  # skip header separator
            if re.match(r"^[\s|:-]+$", line):
                continue
            row = [c.strip() for c in line.split("|") if c.strip()]
            if row:
                rows.append(row)
        return {"columns": columns, "rows": rows}

    return {"columns": [], "rows": [], "raw": content}
