# Device Switcher Web App

A modern, responsive web application for controlling relay boards and IoT devices on your local network. Features group management, custom icons, input monitoring, and interconnection matrix visualization.

## ✨ Features

- 🎛️ **Multi-Device Control**: Manage multiple relay boards with grouped outputs
- 🎨 **Custom Group Icons**: Choose from 100+ emojis to personalize device groups
- 📊 **Input Monitoring**: Real-time input state tracking with change detection
- 🔗 **Interconnection Matrix**: Visual table showing input-output connections
- 📱 **Mobile Optimized**: Responsive design with sticky headers and touch scrolling
- 💾 **Persistent Settings**: Device names, input names, and group icons saved automatically
- 🌐 **PWA Support**: Install as a standalone app on any device
- ⚡ **Real-time Updates**: 2-second state polling, 10-second connectivity checks
- 🎯 **Smart Grouping**: Group toggle controls, collapsible sections

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ installed
- Devices accessible on local network

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/switcher.git
   cd switcher
   ```

2. Start the server:
   ```bash
   node server.js
   ```

3. Open your browser:
   - Local: http://localhost:3000
   - Network: http://YOUR_IP:3000

## 📦 Project Structure

```
switcher/
├── index.html          # Main HTML structure with 3 tabs
├── app.js              # Core application logic (1400+ lines)
├── style.css           # Complete styling with gradients & animations
├── server.js           # Node.js server with CORS proxy
├── devices.json        # Device configuration
├── inputNames.json     # Custom input labels
├── groupSettings.json  # Group emoji preferences
├── manifest.json       # PWA manifest
└── sw.js              # Service worker for offline support
```

## ⚙️ Configuration

### Adding Devices

Edit `devices.json`:
```json
[
  {
    "ip": "192.168.1.166",
    "name": "Living Room",
    "wifiName": "YourNetwork",
    "devices": [
      { "number": 0, "name": "Ceiling Light", "group": "Lights" },
      { "number": 1, "name": "Floor Lamp", "group": "Lights" }
    ]
  }
]
```

### Customizing Input Names

Input names can be edited directly in the UI (Inputs tab), or manually in `inputNames.json`:
```json
{
  "192.168.1.166": {
    "0": "Front Door Sensor",
    "1": "Motion Detector"
  }
}
```

## 🎨 Features in Detail

### 1. Device Control
- Individual toggle switches for each output
- Group toggles to control multiple devices at once
- Master toggle for all devices
- Visual feedback with status indicators

### 2. Emoji Group Icons
- Click 🎨 button next to any group name
- Choose from 6 categories: Home, Lights, Electronics, Comfort, Security, Symbols
- Icons saved automatically to `groupSettings.json`

### 3. Input Monitoring
- 24 inputs per device board
- Real-time ON/OFF status
- Flash animation on state changes
- Editable custom names

### 4. Interconnection Matrix
- Table view showing which inputs trigger which outputs
- ● indicates active connections
- Sticky headers for easy navigation on mobile
- Used connections appear first, unused at the end

## 🖥️ Deploying to Raspberry Pi

### Quick Installation (Automated)

The easiest way to set up on Raspberry Pi:

```bash
cd ~
git clone https://github.com/YOUR_USERNAME/switcher.git
cd switcher
chmod +x install-raspi.sh
./install-raspi.sh
```

The script will automatically:
- Install Node.js 18.x
- Install PM2 process manager
- Configure firewall (if UFW is active)
- Start the server
- Enable auto-start on boot

After installation, access at: `http://raspberrypi.local:3000`

---

### Manual Installation (Step-by-Step)

- [ ] **Install Node.js on Raspberry Pi**
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
  node --version  # Verify installation
  ```

- [ ] **Clone the repository**
  ```bash
  cd ~
  git clone https://github.com/YOUR_USERNAME/switcher.git
  cd switcher
  ```

- [ ] **Configure firewall (if enabled)**
  ```bash
  sudo ufw allow 3000
  sudo ufw status
  ```

- [ ] **Update device IPs in devices.json**
  - Edit `devices.json` with your relay board IPs
  - Make sure Raspberry Pi is on the same network

- [ ] **Test the server manually**
  ```bash
  node server.js
  # Open browser to http://raspberrypi.local:3000
  # Press Ctrl+C to stop
  ```

- [ ] **Install PM2 for auto-start**
  ```bash
  sudo npm install -g pm2
  pm2 start server.js --name switcher
  pm2 logs switcher  # Check for errors
  ```

- [ ] **Enable PM2 on system boot**
  ```bash
  pm2 save
  pm2 startup
  # Follow the command output instructions
  sudo systemctl enable pm2-pi
  ```

- [ ] **Verify auto-start**
  ```bash
  sudo reboot
  # After reboot, check: pm2 status
  ```

- [ ] **Access from mobile device**
  - Open browser: `http://raspberrypi.local:3000` or `http://PI_IP_ADDRESS:3000`
  - Add to home screen for app-like experience

- [ ] **Optional: Set static IP for Raspberry Pi**
  ```bash
  sudo nano /etc/dhcpcd.conf
  # Add at the end:
  # interface eth0
  # static ip_address=192.168.1.100/24
  # static routers=192.168.1.1
  # static domain_name_servers=192.168.1.1
  ```

### Alternative: Systemd Service (instead of PM2)

If you prefer systemd over PM2:

```bash
sudo nano /etc/systemd/system/switcher.service
```

Add this content:
```ini
[Unit]
Description=Switcher IoT Control Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/switcher
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable switcher.service
sudo systemctl start switcher.service
sudo systemctl status switcher.service
```

## 🔧 API Endpoints

The server provides proxy endpoints to avoid CORS issues:

- `GET /proxy/command?ip=X.X.X.X&cmd=/path` - Send device command
- `GET /proxy/states?ip=X.X.X.X` - Get device states
- `GET /proxy/matrix?ip=X.X.X.X` - Get interconnection matrix
- `POST /save-devices` - Save device configuration
- `POST /save-input-names` - Save input names
- `POST /save-group-settings` - Save group icons

## 📱 Mobile Installation

1. Open the app in your mobile browser
2. Tap "Share" → "Add to Home Screen"
3. App will launch fullscreen like a native app

## 🎯 Usage Tips

- **Edit device names**: Click ✏️ button next to any device
- **Rename inputs**: Click ✏️ button in the Inputs tab
- **Collapse sections**: Click IP headers to collapse/expand
- **Change device numbers**: Use number input next to each device
- **View full names**: Hover over truncated text in matrix

## 🐛 Troubleshooting

**Can't connect to devices:**
- Verify devices are on same network
- Check IP addresses in `devices.json`
- Ensure devices respond to HTTP requests

**Matrix not loading:**
- Check device supports `/matrix` endpoint
- Verify matrix format matches expected structure

**Server won't start:**
- Port 3000 might be in use: `lsof -i :3000`
- Kill process: `pkill -f "node server.js"`

## 🔒 Security Notes

- This app is designed for **local network use only**
- No authentication implemented
- Do not expose to public internet without proper security measures

## 📄 License

MIT - Feel free to use and modify for your projects!
