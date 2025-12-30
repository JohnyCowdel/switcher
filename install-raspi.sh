#!/bin/bash

# Switcher IoT Control - Raspberry Pi Installation Script
# Run this script on your Raspberry Pi to set up everything automatically

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Switcher IoT Control - Raspberry Pi Setup${NC}"
echo -e "${BLUE}================================================${NC}\n"

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}Please do not run this script as root (no sudo)${NC}"
    echo -e "The script will ask for sudo password when needed."
    exit 1
fi

# Step 1: Check if Node.js is installed
echo -e "\n${YELLOW}[1/7]${NC} Checking Node.js installation..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓${NC} Node.js is already installed: ${NODE_VERSION}"
else
    echo -e "${YELLOW}Installing Node.js 18.x...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo -e "${GREEN}✓${NC} Node.js installed: $(node -v)"
fi

# Step 2: Check if PM2 is installed
echo -e "\n${YELLOW}[2/7]${NC} Checking PM2 installation..."
if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}✓${NC} PM2 is already installed"
else
    echo -e "${YELLOW}Installing PM2...${NC}"
    sudo npm install -g pm2
    echo -e "${GREEN}✓${NC} PM2 installed"
fi

# Step 3: Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo -e "\n${YELLOW}[3/7]${NC} Project directory: ${SCRIPT_DIR}"

# Step 4: Configure firewall if UFW is active
echo -e "\n${YELLOW}[4/7]${NC} Checking firewall configuration..."
if command -v ufw &> /dev/null && sudo ufw status | grep -q "Status: active"; then
    echo -e "${YELLOW}Allowing port 3000 through firewall...${NC}"
    sudo ufw allow 3000
    echo -e "${GREEN}✓${NC} Port 3000 opened in firewall"
else
    echo -e "${GREEN}✓${NC} Firewall not active or not installed, skipping"
fi

# Step 5: Stop existing PM2 process if running
echo -e "\n${YELLOW}[5/7]${NC} Checking for existing switcher process..."
if pm2 list | grep -q "switcher"; then
    echo -e "${YELLOW}Stopping existing switcher process...${NC}"
    pm2 stop switcher
    pm2 delete switcher
fi

# Step 6: Start the server with PM2
echo -e "\n${YELLOW}[6/7]${NC} Starting switcher server..."
cd "$SCRIPT_DIR"
pm2 start server.js --name switcher
pm2 save
echo -e "${GREEN}✓${NC} Server started with PM2"

# Step 7: Configure PM2 to start on boot
echo -e "\n${YELLOW}[7/7]${NC} Configuring auto-start on boot..."
PM2_STARTUP=$(pm2 startup systemd -u $USER --hp $HOME | grep "sudo env")
if [ ! -z "$PM2_STARTUP" ]; then
    eval $PM2_STARTUP
    echo -e "${GREEN}✓${NC} PM2 configured to start on boot"
else
    echo -e "${YELLOW}⚠${NC} Could not configure auto-start, you may need to run: pm2 startup"
fi

# Get IP addresses
echo -e "\n${BLUE}================================================${NC}"
echo -e "${GREEN}✓ Installation Complete!${NC}"
echo -e "${BLUE}================================================${NC}\n"

echo -e "Server is running and will auto-start on boot.\n"

echo -e "${YELLOW}Access the app from:${NC}"
IP_ADDRESSES=$(hostname -I | awk '{print $1}')
echo -e "  • Local:   ${GREEN}http://localhost:3000${NC}"
echo -e "  • Network: ${GREEN}http://$IP_ADDRESSES:3000${NC}"
echo -e "  • Hostname: ${GREEN}http://$(hostname).local:3000${NC}\n"

echo -e "${YELLOW}Useful commands:${NC}"
echo -e "  • Check status:  ${BLUE}pm2 status${NC}"
echo -e "  • View logs:     ${BLUE}pm2 logs switcher${NC}"
echo -e "  • Restart:       ${BLUE}pm2 restart switcher${NC}"
echo -e "  • Stop:          ${BLUE}pm2 stop switcher${NC}"
echo -e "  • Monitor:       ${BLUE}pm2 monit${NC}\n"

echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Edit ${BLUE}devices.json${NC} with your relay board IPs"
echo -e "  2. Open the app in your browser"
echo -e "  3. Add to home screen on mobile for app experience\n"

echo -e "${GREEN}Happy automating! 🎉${NC}\n"
