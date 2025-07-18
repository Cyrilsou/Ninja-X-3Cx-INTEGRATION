FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

# Install Python and system dependencies
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3.11-venv \
    python3-pip \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Create non-root user
RUN useradd -m -s /bin/bash whisper && \
    chown -R whisper:whisper /app

# Copy requirements
COPY --chown=whisper:whisper requirements.txt .

# Install Python dependencies
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy application code
COPY --chown=whisper:whisper . .

# Create directories for models and storage
RUN mkdir -p /app/models /app/storage && \
    chown -R whisper:whisper /app/models /app/storage

# Switch to non-root user
USER whisper

# Pre-download model (optional, can be done at runtime)
# RUN python3 -c "from faster_whisper import WhisperModel; WhisperModel('large-v3', device='cuda', compute_type='float16', download_root='/app/models')"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Expose metrics port
EXPOSE 8080

# Run the worker
CMD ["python3", "worker.py"]