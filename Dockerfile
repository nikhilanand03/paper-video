FROM python:3.12-slim

WORKDIR /app

# System dependencies: ffmpeg, Node.js 20, Playwright browser deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg curl \
    libglib2.0-0 libnss3 libnspr4 libdbus-1-3 \
    libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0 \
    fonts-liberation \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Chromium
RUN playwright install chromium

# Remotion presets — install Node dependencies
COPY remotion-presets/ remotion-presets/
RUN cd remotion-presets && npm ci --omit=dev

# Copy application code
COPY app.py pipeline.py config.py template_engine.py template_registry.py ./
COPY stage1_extract.py stage2_planner.py stage4_render.py stage4_render_remotion.py stage5_tts.py stage6_assembly.py ./
COPY templates/ templates/
COPY prompts/ prompts/

# Create runtime directories
RUN mkdir -p output uploaded-pdfs static

# Default to Remotion rendering; reuse Playwright's Chromium
ENV RENDER_MODE=html
ENV RENDER_CONCURRENCY=2
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
