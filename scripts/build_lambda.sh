#!/usr/bin/env bash
# Empaqueta l'API per a AWS Lambda (Linux x86_64, Python 3.12) a build/lambda.zip.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf build/lambda && mkdir -p build/lambda
python -m pip install --quiet --target build/lambda \
  --platform manylinux2014_x86_64 --implementation cp --python-version 3.12 \
  --only-binary=:all: ".[aws]"
# boto3 ja és a l'entorn de Lambda: el traiem per reduir la mida del paquet.
rm -rf build/lambda/boto3 build/lambda/botocore build/lambda/s3transfer
(cd build/lambda && zip -qr ../lambda.zip . -x '*/__pycache__/*')
echo "build/lambda.zip: $(du -h build/lambda.zip | cut -f1)"
