FROM python:3.12-slim

# Install git for repo cloning
RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*

# Install scanning tools and Lambda runtime
RUN pip install --no-cache-dir \
    checkov==3.2.0 \
    semgrep==1.90.0 \
    bandit==1.7.10 \
    boto3==1.35.0 \
    awslambdaric==2.2.1

WORKDIR /app
COPY handler.py .

ENTRYPOINT ["python", "-m", "awslambdaric"]
CMD ["handler.handler"]
