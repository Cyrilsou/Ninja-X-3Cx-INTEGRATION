#!/bin/bash

# 3CX-Whisper-NinjaOne Server Installation Script
# For Ubuntu 24 LTS with NVIDIA GPU

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print colored output
print_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root"
   exit 1
fi

print_info "Starting 3CX-Whisper-NinjaOne Server Installation"
echo "================================================"

# Update system
print_info "Updating system packages..."
apt-get update && apt-get upgrade -y

# Install prerequisites
print_info "Installing prerequisites..."
apt-get install -y \
    curl \
    wget \
    git \
    unzip \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    build-essential

# Install Docker
if ! command -v docker &> /dev/null; then
    print_info "Installing Docker..."
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    systemctl start docker
else
    print_info "Docker already installed"
fi

# Install Docker Compose
if ! command -v docker-compose &> /dev/null; then
    print_info "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
else
    print_info "Docker Compose already installed"
fi

# Install NVIDIA drivers and container toolkit
print_info "Checking for NVIDIA GPU..."
if lspci | grep -i nvidia > /dev/null; then
    print_info "NVIDIA GPU detected, installing drivers..."
    
    # Add NVIDIA repository
    add-apt-repository -y ppa:graphics-drivers/ppa
    apt-get update
    
    # Install recommended driver
    ubuntu-drivers autoinstall
    
    # Install NVIDIA container toolkit
    distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
    curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | apt-key add -
    curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | tee /etc/apt/sources.list.d/nvidia-docker.list
    apt-get update
    apt-get install -y nvidia-container-toolkit
    
    # Configure Docker to use NVIDIA runtime
    nvidia-ctk runtime configure --runtime=docker
    systemctl restart docker
    
    # Test NVIDIA runtime
    if docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi > /dev/null 2>&1; then
        print_info "NVIDIA GPU setup successful"
    else
        print_error "NVIDIA GPU setup failed. Please check drivers and reboot."
        exit 1
    fi
else
    print_error "No NVIDIA GPU detected. This system requires an NVIDIA GPU for Whisper."
    exit 1
fi

# Create installation directory
INSTALL_DIR="/opt/3cx-whisper-ninjaone"
print_info "Creating installation directory at $INSTALL_DIR"
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# Download project files
print_info "Downloading project files..."
# In production, this would clone from your repository
# For now, we'll create the structure

# Create directory structure
mkdir -p server/{event-receiver,orchestrator,whisper-worker,tv-dashboard,nginx,scripts,config-ui}
mkdir -p electron-client

# Copy files from current directory if they exist
if [ -d "/tmp/3cx-whisper-ninjaone" ]; then
    cp -r /tmp/3cx-whisper-ninjaone/* .
fi

# Create data directories
print_info "Creating data directories..."
mkdir -p /var/lib/3cx-integration/audio
mkdir -p /var/lib/3cx-integration/models
mkdir -p /var/lib/3cx-integration/logs
chmod -R 755 /var/lib/3cx-integration

# Generate self-signed SSL certificate
print_info "Generating self-signed SSL certificate..."
mkdir -p server/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout server/nginx/ssl/privkey.pem \
    -out server/nginx/ssl/fullchain.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=$(hostname -I | awk '{print $1}')"

# Update nginx configuration to use IP instead of domain
SERVER_IP=$(hostname -I | awk '{print $1}')
print_info "Server IP: $SERVER_IP"

# Create systemd service for configuration UI
print_info "Creating systemd service..."
cat > /etc/systemd/system/3cx-config.service << EOF
[Unit]
Description=3CX-Whisper-NinjaOne Configuration UI
After=docker.service
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/local/bin/docker-compose -f docker-compose.config.yml up
ExecStop=/usr/local/bin/docker-compose -f docker-compose.config.yml down
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Create docker-compose for config UI
cat > $INSTALL_DIR/docker-compose.config.yml << EOF
version: '3.8'

services:
  config-ui:
    build: ./server/config-ui
    container_name: 3cx-config-ui
    ports:
      - "8080:8080"
    volumes:
      - ./.env:/app/.env
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - NODE_ENV=production
    restart: unless-stopped
EOF

# Enable and start configuration service
systemctl daemon-reload
systemctl enable 3cx-config.service

# Create firewall rules
print_info "Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp    # SSH
    ufw allow 80/tcp    # HTTP
    ufw allow 443/tcp   # HTTPS
    ufw allow 8080/tcp  # Config UI
    ufw allow 3003/tcp  # WebSocket
    ufw --force enable
fi

# Create helper scripts
print_info "Creating helper scripts..."

# Start script
cat > $INSTALL_DIR/start.sh << 'EOF'
#!/bin/bash
cd /opt/3cx-whisper-ninjaone
docker-compose up -d
echo "Services started. Check status with: docker-compose ps"
EOF
chmod +x $INSTALL_DIR/start.sh

# Stop script
cat > $INSTALL_DIR/stop.sh << 'EOF'
#!/bin/bash
cd /opt/3cx-whisper-ninjaone
docker-compose down
echo "Services stopped."
EOF
chmod +x $INSTALL_DIR/stop.sh

# Status script
cat > $INSTALL_DIR/status.sh << 'EOF'
#!/bin/bash
cd /opt/3cx-whisper-ninjaone
docker-compose ps
EOF
chmod +x $INSTALL_DIR/status.sh

# Logs script
cat > $INSTALL_DIR/logs.sh << 'EOF'
#!/bin/bash
cd /opt/3cx-whisper-ninjaone
docker-compose logs -f --tail=100
EOF
chmod +x $INSTALL_DIR/logs.sh

# Installation complete
print_info "Installation complete!"
echo ""
echo "========================================"
echo "Next steps:"
echo "1. Access configuration UI: http://$SERVER_IP:8080"
echo "2. Configure all settings in the web interface"
echo "3. Start services from the web interface"
echo ""
echo "Useful commands:"
echo "- Start services: $INSTALL_DIR/start.sh"
echo "- Stop services: $INSTALL_DIR/stop.sh"
echo "- Check status: $INSTALL_DIR/status.sh"
echo "- View logs: $INSTALL_DIR/logs.sh"
echo ""
echo "3CX Webhook URL: https://$SERVER_IP/webhook/call-end"
echo "========================================"

# Start config UI
print_info "Starting configuration UI..."
systemctl start 3cx-config.service

print_info "Setup complete! Access http://$SERVER_IP:8080 to continue."