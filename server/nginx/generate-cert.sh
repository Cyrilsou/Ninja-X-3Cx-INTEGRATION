#!/bin/bash

# This script generates a self-signed certificate for development
# For production, use Let's Encrypt with certbot

DOMAIN=${1:-localhost}
SSL_DIR="./ssl"

mkdir -p $SSL_DIR

# Generate private key
openssl genrsa -out $SSL_DIR/privkey.pem 2048

# Generate certificate signing request
openssl req -new -key $SSL_DIR/privkey.pem -out $SSL_DIR/cert.csr \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN"

# Generate self-signed certificate
openssl x509 -req -days 365 -in $SSL_DIR/cert.csr \
    -signkey $SSL_DIR/privkey.pem -out $SSL_DIR/fullchain.pem

# Clean up
rm $SSL_DIR/cert.csr

echo "Self-signed certificate generated in $SSL_DIR/"
echo "Note: This is for development only. Use Let's Encrypt for production."