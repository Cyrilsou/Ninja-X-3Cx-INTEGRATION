#!/bin/bash

# 3CX-Whisper-NinjaOne Server Installation Script
# For Ubuntu 24 LTS with NVIDIA GPU
# Version 2.0

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

print_info "Starting 3CX-Whisper-NinjaOne Server Installation v2.0"
echo "===================================================="

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
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable docker
    systemctl start docker
else
    print_info "Docker already installed"
fi

# Install Docker Compose standalone
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
    
    # Check if NVIDIA driver is already installed
    if ! nvidia-smi &> /dev/null; then
        # Install NVIDIA driver
        print_info "Installing NVIDIA driver..."
        apt-get install -y nvidia-driver-550
        print_warning "NVIDIA driver installed. A reboot may be required."
    else
        print_info "NVIDIA driver already installed"
        nvidia-smi
    fi
    
    # Install NVIDIA Container Toolkit for Ubuntu 24.04
    print_info "Installing NVIDIA Container Toolkit..."
    
    # Remove old nvidia-docker packages if they exist
    apt-get remove -y nvidia-docker nvidia-docker2 nvidia-container-runtime 2>/dev/null || true
    
    # Remove existing gpg key if present
    rm -f /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
    
    # Add NVIDIA Container Toolkit repository
    curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
    
    # Create the repository configuration
    distribution=ubuntu22.04  # Use 22.04 repo for 24.04 as it's compatible
    curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
        sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
        tee /etc/apt/sources.list.d/nvidia-container-toolkit.list > /dev/null
    
    apt-get update
    apt-get install -y nvidia-container-toolkit
    
    # Configure Docker to use NVIDIA runtime
    nvidia-ctk runtime configure --runtime=docker
    systemctl restart docker
    
    # Test NVIDIA runtime
    print_info "Testing NVIDIA GPU in Docker..."
    if docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi > /dev/null 2>&1; then
        print_info "NVIDIA GPU setup successful"
    else
        print_warning "NVIDIA GPU test failed. You may need to reboot the system."
        print_warning "After reboot, run: docker run --rm --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi"
    fi
else
    print_error "No NVIDIA GPU detected. This system requires an NVIDIA GPU for Whisper."
    exit 1
fi

# Create installation directory
INSTALL_DIR="/opt/3cx-whisper-ninjaone"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if we're already in the installation directory
if [ "$SCRIPT_DIR" = "$INSTALL_DIR" ]; then
    print_info "Already in installation directory: $INSTALL_DIR"
    print_info "Using existing project files"
else
    print_info "Creating installation directory at $INSTALL_DIR"
    mkdir -p $INSTALL_DIR
    
    # Check if project files exist in current directory
    if [ -d "$SCRIPT_DIR/server" ] && [ -f "$SCRIPT_DIR/docker-compose.yml" ]; then
        print_info "Copying project files from $SCRIPT_DIR to $INSTALL_DIR..."
        # Copy all files except the install script itself
        # Copy all files except the install scripts
        find "$SCRIPT_DIR" -mindepth 1 -maxdepth 1 ! -name "install-*.sh" -exec cp -r {} "$INSTALL_DIR/" \;
    else
        print_warning "Project files not found in current directory"
        print_info "Creating directory structure..."
        cd $INSTALL_DIR
        mkdir -p server/{event-receiver,orchestrator,whisper-worker,tv-dashboard,nginx,scripts,config-ui}
        mkdir -p electron-client
    fi
    cd $INSTALL_DIR
fi

# Create data directories
print_info "Creating data directories..."
mkdir -p /var/lib/3cx-integration/audio
mkdir -p /var/lib/3cx-integration/models
mkdir -p /var/lib/3cx-integration/logs
chmod -R 755 /var/lib/3cx-integration

# Generate self-signed SSL certificate
print_info "Generating self-signed SSL certificate..."
mkdir -p $INSTALL_DIR/server/nginx/ssl
SERVER_IP=$(hostname -I | awk '{print $1}')
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout $INSTALL_DIR/server/nginx/ssl/privkey.pem \
    -out $INSTALL_DIR/server/nginx/ssl/fullchain.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=$SERVER_IP" \
    2>/dev/null

print_info "Server IP: $SERVER_IP"

# Create docker-compose for config UI only
cat > $INSTALL_DIR/docker-compose.config.yml << EOF
services:
  config-ui:
    build: ./server/config-ui
    container_name: 3cx-config-ui
    ports:
      - "8080:8080"
    volumes:
      - $INSTALL_DIR:/project:rw
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - NODE_ENV=production
      - DOCKER_ENV=true
    restart: unless-stopped
EOF

# Create systemd service for main stack
print_info "Creating systemd service..."
cat > /etc/systemd/system/3cx-whisper.service << EOF
[Unit]
Description=3CX-Whisper-NinjaOne Stack
After=docker.service
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/local/bin/docker-compose up
ExecStop=/usr/local/bin/docker-compose down
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable service (but don't start it yet)
systemctl daemon-reload
systemctl enable 3cx-whisper.service

# Configure firewall
print_info "Configuring firewall..."
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp    # SSH
    ufw allow 80/tcp    # HTTP
    ufw allow 443/tcp   # HTTPS
    ufw allow 8080/tcp  # Config UI
    ufw allow 3002/tcp  # API
    ufw allow 3003/tcp  # WebSocket
    ufw allow 5355/udp  # Discovery
    ufw --force enable
fi

# Create helper scripts
print_info "Creating helper scripts..."

# Start script
cat > $INSTALL_DIR/start.sh << 'EOF'
#!/bin/bash
cd /opt/3cx-whisper-ninjaone
if [ ! -f .env ]; then
    echo "ERROR: Configuration not found. Please access http://$(hostname -I | awk '{print $1}'):8080 to configure."
    exit 1
fi
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

# Build and start config UI
print_info "Building configuration UI..."
cd $INSTALL_DIR

# Clean up any existing .env file or directory (Docker volume issue)
if [ -e "$INSTALL_DIR/.env" ]; then
    print_info "Removing existing .env file/directory..."
    rm -rf "$INSTALL_DIR/.env"
fi

# Also clean up any .env in the mounted volume location
if [ -e "/project/.env" ]; then
    print_info "Cleaning up /project/.env..."
    rm -rf "/project/.env" 2>/dev/null || true
fi

# Check if config-ui directory exists
if [ ! -d "$INSTALL_DIR/server/config-ui" ]; then
    print_error "Configuration UI directory not found at $INSTALL_DIR/server/config-ui"
    print_error "Please ensure all project files are present"
    exit 1
fi

# Clean any existing containers
docker-compose -f docker-compose.config.yml down 2>/dev/null || true

# Build with progress output
print_info "This may take a few minutes..."
if ! docker-compose -f docker-compose.config.yml build; then
    print_error "Failed to build configuration UI"
    print_error "Attempting rebuild without cache..."
    docker-compose -f docker-compose.config.yml build --no-cache
fi

# Start config UI
if ! docker-compose -f docker-compose.config.yml up -d; then
    print_error "Failed to start configuration UI"
    print_error "Check logs with: docker-compose -f docker-compose.config.yml logs"
    exit 1
fi

# Wait for config UI to be ready
print_info "Waiting for configuration UI to start..."
sleep 5

# Check if config UI is running
if docker ps | grep -q 3cx-config-ui; then
    print_info "Configuration UI is running"
else
    print_error "Configuration UI failed to start"
    print_error "Check logs with: docker-compose -f docker-compose.config.yml logs"
    exit 1
fi

# Check if NVIDIA driver needs a reboot
if ! nvidia-smi &> /dev/null; then
    print_warning "NVIDIA driver was installed but requires a system reboot."
    NEEDS_REBOOT=true
else
    NEEDS_REBOOT=false
fi

# Installation complete
print_info "Installation complete!"
echo ""
echo "========================================"
echo "Next steps:"
echo "1. Access configuration UI: http://$SERVER_IP:8080"
echo "2. Configure all settings in the web interface"
echo "3. Start services from the web interface or using ./start.sh"
echo ""
echo "Useful commands:"
echo "- Start services: $INSTALL_DIR/start.sh"
echo "- Stop services: $INSTALL_DIR/stop.sh"
echo "- Check status: $INSTALL_DIR/status.sh"
echo "- View logs: $INSTALL_DIR/logs.sh"
echo ""
echo "3CX Webhook URL: https://$SERVER_IP/webhook/call-end"
echo "========================================"

if [ "$NEEDS_REBOOT" = true ]; then
    echo ""
    print_warning "IMPORTANT: System reboot required for NVIDIA driver!"
    print_warning "Please reboot the system and then access http://$SERVER_IP:8080"
    echo ""
    read -p "Reboot now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        reboot
    fi
else
    print_info "Configuration UI is running at http://$SERVER_IP:8080"
fi