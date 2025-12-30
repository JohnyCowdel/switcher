const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // Handle saving input names
    if (req.url === '/save-input-names' && req.method === 'POST') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const inputNames = JSON.parse(body);
                fs.writeFileSync('inputNames.json', JSON.stringify(inputNames, null, 4));
                res.writeHead(200, { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        
        return;
    }
    
    // Handle saving devices
    if (req.url === '/save-devices' && req.method === 'POST') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const devicesData = JSON.parse(body);
                fs.writeFileSync('devices.json', JSON.stringify(devicesData, null, 4));
                res.writeHead(200, { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        
        return;
    }
    
    // Handle saving group settings
    if (req.url === '/save-group-settings' && req.method === 'POST') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const groupSettings = JSON.parse(body);
                fs.writeFileSync('groupSettings.json', JSON.stringify(groupSettings, null, 4));
                res.writeHead(200, { 
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        
        return;
    }
    
    // Handle proxy endpoint for matrix data
    if (req.url.startsWith('/proxy/matrix?')) {
        const urlParams = new URL(req.url, `http://localhost:${PORT}`);
        const deviceIP = urlParams.searchParams.get('ip');
        
        if (!deviceIP) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Missing IP parameter');
            return;
        }
        
        const deviceUrl = `http://${deviceIP}/matrix`;
        
        http.get(deviceUrl, (deviceRes) => {
            let data = '';
            
            deviceRes.on('data', chunk => {
                data += chunk;
            });
            
            deviceRes.on('end', () => {
                res.writeHead(200, { 
                    'Content-Type': 'text/plain',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(data);
            });
        }).on('error', (error) => {
            console.error('Error fetching matrix:', error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error fetching matrix from device');
        });
        
        return;
    }
    
    // Handle proxy endpoint for device commands (genericArgs)
    if (req.url.startsWith('/proxy/command?')) {
        const urlParams = new URL(req.url, `http://localhost:${PORT}`);
        const deviceIP = urlParams.searchParams.get('ip');
        const command = urlParams.searchParams.get('cmd');
        
        if (!deviceIP || !command) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Missing IP or command parameter');
            return;
        }
        
        // Proxy request to the device
        http.get(`http://${deviceIP}${command}`, (proxyRes) => {
            let data = '';
            
            proxyRes.on('data', (chunk) => {
                data += chunk;
            });
            
            proxyRes.on('end', () => {
                res.writeHead(200, { 
                    'Content-Type': 'text/plain',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(data);
            });
        }).on('error', (err) => {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(`Proxy error: ${err.message}`);
        });
        
        return;
    }
    
    // Handle proxy endpoint for device states
    if (req.url.startsWith('/proxy/states?ip=')) {
        const urlParams = new URL(req.url, `http://localhost:${PORT}`);
        const deviceIP = urlParams.searchParams.get('ip');
        
        if (!deviceIP) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Missing IP parameter');
            return;
        }
        
        // Proxy request to the device
        http.get(`http://${deviceIP}/states`, (proxyRes) => {
            let data = '';
            
            proxyRes.on('data', (chunk) => {
                data += chunk;
            });
            
            proxyRes.on('end', () => {
                res.writeHead(200, { 
                    'Content-Type': 'text/plain',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(data);
            });
        }).on('error', (err) => {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end(`Proxy error: ${err.message}`);
        });
        
        return;
    }
    
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = path.extname(filePath);
    const contentType = mimeTypes[extname] || 'text/plain';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`, 'utf-8');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    const networkInterfaces = require('os').networkInterfaces();
    let localIP = 'localhost';
    
    // Find local IP
    Object.keys(networkInterfaces).forEach((ifname) => {
        networkInterfaces[ifname].forEach((iface) => {
            if (iface.family === 'IPv4' && !iface.internal) {
                localIP = iface.address;
            }
        });
    });

    console.log('='.repeat(50));
    console.log('Device Switcher Server Running!');
    console.log('='.repeat(50));
    console.log(`\nLocal:   http://localhost:${PORT}`);
    console.log(`Network: http://${localIP}:${PORT}`);
    console.log('\nAccess from any device on your network!');
    console.log('Press Ctrl+C to stop the server\n');
});
