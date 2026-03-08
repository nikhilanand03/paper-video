FROM python:3.12-slim

WORKDIR /app

# System dependencies: ffmpeg for video assembly, Playwright browser deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Chromium
RUN playwright install chromium

# Copy application code
COPY app.py pipeline.py config.py template_engine.py template_registry.py ./
COPY stage1_extract.py stage2_planner.py stage4_render.py stage5_tts.py stage6_assembly.py ./
COPY templates/ templates/
COPY prompts/ prompts/

# Create runtime directories
RUN mkdir -p output uploaded-pdfs static

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
