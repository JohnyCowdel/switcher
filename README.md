# Device Switcher Web App

A simple cross-platform web application to control devices on your local network.

## Features

- 🌐 Cross-platform (works on any device with a browser)
- 📱 PWA support (install as an app on mobile/desktop)
- 🎨 Clean, modern UI
- ⚡ Fast and lightweight
- 🔌 Control multiple devices via HTTP commands

## Quick Start

### Option 1: Using Node.js (Recommended)

1. Install Node.js from https://nodejs.org/ (if not already installed)

2. Navigate to the project folder:
   ```bash
   cd C:\dev_projects\switcher
   ```

3. Start the server:
   ```bash
   node server.js
   ```

4. Open your browser and go to:
   - Local: http://localhost:8080
   - From other devices: http://YOUR_IP:8080

### Option 2: Using Python (Alternative)

```bash
cd C:\dev_projects\switcher
python -m http.server 8080
```

Then open http://localhost:8080

### Option 3: Direct File Access

Simply open `index.html` in your browser. Note: Some features may be limited due to CORS restrictions.

## Usage

1. **Select Device**: Choose which device IP you want to control
2. **Select Command**: Choose the command (on/off/status)
3. **Parameter**: (Optional) Add a parameter if your command needs one
4. **Send**: Click the button to send the command

## Customization

### Adding More Devices

Edit `index.html` and add more radio buttons:

```html
<label class="radio-label">
    <input type="radio" name="device" value="192.168.1.199">
    <span>Device 4 (192.168.1.199)</span>
</label>
```

### Adding More Commands

Edit `index.html` to add more command options:

```html
<label class="radio-label">
    <input type="radio" name="command" value="restart">
    <span>Restart</span>
</label>
```

### Changing URL Format

If your devices use a different URL format (not `/command$parameter`), edit `app.js`:

```javascript
// Current format: http://192.168.1.196/on$123
// Change to your format, e.g.:
let url = `http://${device}/api?cmd=${command}&param=${parameter}`;
```

## CORS Issues

If you encounter CORS errors when trying to connect to your devices, you need to:

1. Enable CORS on your device endpoints, OR
2. Use the Node.js server as a proxy (requires additional setup)

## PWA Installation

On mobile devices, you can "Add to Home Screen" to install this as a standalone app.

## Troubleshooting

**Can't connect to devices:**
- Ensure your computer and devices are on the same network
- Check if the device IPs are correct
- Try accessing the device URL directly in your browser first

**Server won't start:**
- Make sure the port 8080 is not already in use
- Try a different port by editing `server.js`

## License

MIT
