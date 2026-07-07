FROM python:3.12-slim

# Prowler v5.x + AWS Lambda runtime interface client.
# Direct pip install avoids the path fragility of multi-stage copy from prowlercloud image.
RUN pip install --no-cache-dir \
    prowler==5.4.0 \
    awslambdaric==2.2.1
# boto3 pulled in transitively by prowler — pinning explicitly causes resolver conflicts

WORKDIR /app
COPY handler.py .

# Lambda container runtime entrypoint
ENTRYPOINT ["python", "-m", "awslambdaric"]
CMD ["handler.handler"]
