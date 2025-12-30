// DOM Elements
const statusDiv = document.getElementById('status');
const responseDiv = document.getElementById('response');
const switchesContainer = document.getElementById('switchesContainer');
const inputsContainer = document.getElementById('inputsContainer');

let devices = [];
let previousInputStates = {};
let inputSectionsCreated = false;
let inputNames = {};
let groupSettings = {}; // Store emoji/icon for each group
let interconnectionSectionsCreated = false;
let recentlyToggledDevices = new Set(); // Track recently toggled devices to prevent state override
let recentlyToggledGroups = new Set(); // Track recently toggled groups to prevent state override

// Update status message
function updateStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = 'status';
    if (type === 'success') {
        statusDiv.classList.add('success');
    } else if (type === 'error') {
        statusDiv.classList.add('error');
    }
}

// Load devices from JSON file
async function loadDevices() {
    try {
        const response = await fetch('devices.json');
        const ipGroups = await response.json();
        
        // Flatten the structure: add ip, wifiName, and ipGroupName to each device
        devices = [];
        ipGroups.forEach(ipGroup => {
            ipGroup.devices.forEach(device => {
                devices.push({
                    ...device,
                    ip: ipGroup.ip,
                    wifiName: ipGroup.wifiName,
                    ipGroupName: ipGroup.name || ipGroup.ip
                });
            });
        });
        
        // Load input names
        await loadInputNames();
        
        // Load group settings
        await loadGroupSettings();
        
        createSwitches();
        
        // Check connectivity in background (non-blocking)
        checkAllIPConnectivity();
    } catch (error) {
        console.error('Error loading devices:', error);
        updateStatus('Failed to load devices', 'error');
    }
}

// Load input names from JSON file
async function loadInputNames() {
    try {
        const response = await fetch('inputNames.json');
        inputNames = await response.json();
    } catch (error) {
        console.error('Error loading input names:', error);
        inputNames = {};
    }
}

// Save input names to JSON file
async function saveInputNames() {
    try {
        const response = await fetch('/save-input-names', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(inputNames)
        });
        
        if (response.ok) {
            updateStatus('Input names saved!', 'success');
        } else {
            updateStatus('Failed to save input names', 'error');
        }
    } catch (error) {
        console.error('Error saving input names:', error);
        updateStatus('Failed to save input names', 'error');
    }
}

// Load group settings from JSON file
async function loadGroupSettings() {
    try {
        const response = await fetch('groupSettings.json');
        groupSettings = await response.json();
    } catch (error) {
        console.error('Error loading group settings:', error);
        groupSettings = {};
    }
}

// Save group settings to JSON file
async function saveGroupSettings() {
    try {
        const response = await fetch('/save-group-settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(groupSettings)
        });
        
        if (response.ok) {
            updateStatus('Group icon saved!', 'success');
        } else {
            updateStatus('Failed to save group icon', 'error');
        }
    } catch (error) {
        console.error('Error saving group settings:', error);
        updateStatus('Failed to save group icon', 'error');
    }
}

// Save devices to JSON file
async function saveDevicesJson() {
    try {
        // Reconstruct the original JSON structure from devices array
        const response = await fetch('devices.json');
        const ipGroups = await response.json();
        
        // Update device names in the structure
        ipGroups.forEach(ipGroup => {
            ipGroup.devices.forEach(jsonDevice => {
                const updatedDevice = devices.find(d => d.ip === ipGroup.ip && d.number === jsonDevice.number);
                if (updatedDevice) {
                    jsonDevice.name = updatedDevice.name;
                }
            });
        });
        
        // Save to server
        const saveResponse = await fetch('/save-devices', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(ipGroups)
        });
        
        if (saveResponse.ok) {
            updateStatus('Device name saved!', 'success');
        } else {
            updateStatus('Failed to save device name', 'error');
        }
    } catch (error) {
        console.error('Error saving devices:', error);
        updateStatus('Failed to save device name', 'error');
    }
}

// Check if connected to the correct WiFi network
async function checkWiFiNetwork() {
    // Get the expected WiFi name from the first device
    const expectedWiFi = devices[0]?.wifiName;
    
    if (!expectedWiFi) {
        return; // No WiFi check needed
    }
    
    updateStatus(`Checking connectivity to ${expectedWiFi}...`, 'info');
    
    // Get unique IPs to test
    const uniqueIPs = [...new Set(devices.map(d => d.ip))];
    let isConnected = false;
    
    for (const ip of uniqueIPs) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
            
            // Try to fetch the root page
            const response = await fetch(`http://${ip}`, {
                method: 'GET',
                mode: 'no-cors', // Avoid CORS issues, we just need to know if it's reachable
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            // With no-cors mode, response will be opaque but we can check if it succeeded
            // If we get here without error, the device is reachable
            isConnected = true;
            console.log(`Successfully reached ${ip}`);
            break;
        } catch (error) {
            // Device not reachable, continue to next IP
            console.log(`Cannot reach ${ip}:`, error.message);
        }
    }
    
    if (!isConnected) {
        updateStatus(`⚠️ Warning: Please connect to WiFi network "${expectedWiFi}"`, 'error');
        
        // Add warning banner
        const warningBanner = document.createElement('div');
        warningBanner.className = 'wifi-warning';
        warningBanner.innerHTML = `
            <strong>⚠️ WiFi Connection Required</strong><br>
            Please connect to: <strong>${expectedWiFi}</strong><br>
            <small>Cannot detect relay control board on network</small>
        `;
        switchesContainer.parentElement.insertBefore(warningBanner, switchesContainer);
    } else {
        updateStatus(`Connected to ${expectedWiFi} - Devices reachable`, 'success');
    }
}

// Create toggle switches dynamically
function createSwitches() {
    switchesContainer.innerHTML = '';
    
    // Group devices by IP address first
    const devicesByIP = {};
    devices.forEach(device => {
        if (!devicesByIP[device.ip]) {
            devicesByIP[device.ip] = [];
        }
        devicesByIP[device.ip].push(device);
    });
    
    // Create sections for each IP
    Object.keys(devicesByIP).sort().forEach(ip => {
        const ipDevices = devicesByIP[ip];
        const ipGroupName = ipDevices[0].ipGroupName; // Get name from first device
        
        // Create IP section container
        const ipSection = document.createElement('div');
        ipSection.className = 'ip-section';
        
        // Create IP header
        const ipHeader = document.createElement('div');
        ipHeader.className = 'ip-header';
        ipHeader.innerHTML = `
            <div class="ip-header-content">
                <span class="collapse-icon">▼</span>
                <span class="ip-title">${ipGroupName}</span>
            </div>
            <span class="ip-status" data-ip="${ip}">Checking...</span>
        `;
        
        // Add click handler to toggle collapse
        ipHeader.addEventListener('click', () => {
            ipSection.classList.toggle('collapsed');
        });
        
        ipSection.appendChild(ipHeader);
        
        // Group devices within this IP by their group property
        const groupedDevices = {};
        ipDevices.forEach(device => {
            const group = device.group || 'Other';
            if (!groupedDevices[group]) {
                groupedDevices[group] = [];
            }
            groupedDevices[group].push(device);
        });
        
        // Create device switches within this IP
        const ipContent = document.createElement('div');
        ipContent.className = 'ip-content';
        
        // Create switches for each group within this IP
        Object.keys(groupedDevices).sort().forEach(groupName => {
            const groupDevices = groupedDevices[groupName];
            
            // Create group container
            const groupContainer = document.createElement('div');
            groupContainer.className = 'group-container';
            
            // Create group header with toggle
            const groupHeader = document.createElement('div');
            groupHeader.className = 'group-header';
            
            // Get emoji for this group
            const groupKey = `${ip}:${groupName}`;
            const groupEmoji = groupSettings[groupKey] || '';
            
            groupHeader.innerHTML = `
                <div class="group-title-container">
                    <span class="group-emoji" data-group-key="${groupKey}">${groupEmoji}</span>
                    <span class="group-title">${groupName}</span>
                    <button class="edit-group-emoji-btn" data-group-key="${groupKey}" data-group-name="${groupName}" title="Choose icon">🎨</button>
                    <label class="switch">
                        <input type="checkbox" class="group-toggle" data-group="${groupName}" data-ip="${ip}">
                        <span class="slider"></span>
                    </label>
                </div>
            `;
            
            groupContainer.appendChild(groupHeader);
            
            // Add event listener for group toggle
            const groupToggle = groupHeader.querySelector('.group-toggle');
            groupToggle.addEventListener('change', () => handleGroupToggle(groupName, groupDevices, groupToggle));
            
            // Add event listener for emoji edit button
            const emojiEditBtn = groupHeader.querySelector('.edit-group-emoji-btn');
            emojiEditBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openEmojiPicker(groupKey, groupName);
            });
            
            // Create device switches in this group
            const devicesContainer = document.createElement('div');
            devicesContainer.className = 'group-devices';
            
            groupDevices.forEach(device => {
                const switchItem = document.createElement('div');
                switchItem.className = 'switch-item';
                
                switchItem.innerHTML = `
                    <div class="switch-info">
                        <span class="device-name editable-device-name" contenteditable="false" data-device-number="${device.number}" data-device-ip="${device.ip}">${device.name}</span>
                        <button class="edit-device-btn" title="Edit device name">✏️</button>
                        <input type="number" class="device-number-input" value="${device.number}" min="0" max="23" data-original-number="${device.number}" data-device-ip="${device.ip}" title="Device number">
                        <label class="switch">
                            <input type="checkbox" data-number="${device.number}" data-ip="${device.ip}" data-group="${groupName}">
                            <span class="slider"></span>
                        </label>
                    </div>
                `;
                
                devicesContainer.appendChild(switchItem);
                
                // Add edit functionality for device name
                const deviceNameSpan = switchItem.querySelector('.device-name');
                const editBtn = switchItem.querySelector('.edit-device-btn');
                const numberInput = switchItem.querySelector('.device-number-input');
                
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (deviceNameSpan.contentEditable === 'false') {
                        // Enter edit mode
                        deviceNameSpan.contentEditable = 'true';
                        deviceNameSpan.focus();
                        editBtn.textContent = '✓';
                        editBtn.title = 'Save name';
                        // Select all text
                        const range = document.createRange();
                        range.selectNodeContents(deviceNameSpan);
                        const sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(range);
                    } else {
                        // Save and exit edit mode
                        deviceNameSpan.contentEditable = 'false';
                        editBtn.textContent = '✏️';
                        editBtn.title = 'Edit device name';
                        
                        // Save the new name
                        const newName = deviceNameSpan.textContent.trim();
                        if (newName && newName !== device.name) {
                            device.name = newName;
                            saveDevicesJson();
                        } else if (!newName) {
                            // Restore original if empty
                            deviceNameSpan.textContent = device.name;
                        }
                    }
                });
                
                // Save on Enter key, cancel on Escape
                deviceNameSpan.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        editBtn.click();
                    }
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        // Cancel editing
                        deviceNameSpan.contentEditable = 'false';
                        deviceNameSpan.textContent = device.name;
                        editBtn.textContent = '✏️';
                        editBtn.title = 'Edit device name';
                    }
                });
                
                // Add validation and save for device number
                numberInput.addEventListener('change', (e) => {
                    const newNumber = parseInt(e.target.value);
                    const originalNumber = parseInt(e.target.dataset.originalNumber);
                    const deviceIP = e.target.dataset.deviceIp;
                    
                    // Validate number is within range
                    if (newNumber < 0 || newNumber > 23) {
                        updateStatus('Device number must be between 0 and 23', 'error');
                        e.target.value = originalNumber;
                        return;
                    }
                    
                    // Check if number is already assigned to another device on same IP
                    const conflictDevice = devices.find(d => 
                        d.ip === deviceIP && 
                        d.number === newNumber && 
                        d.number !== originalNumber
                    );
                    
                    if (conflictDevice) {
                        updateStatus(`Number ${newNumber} is already assigned to "${conflictDevice.name}"`, 'error');
                        e.target.value = originalNumber;
                        return;
                    }
                    
                    // Update the device number
                    device.number = newNumber;
                    e.target.dataset.originalNumber = newNumber;
                    
                    // Update the toggle checkbox data attribute
                    const toggle = switchItem.querySelector('input[type="checkbox"]');
                    toggle.dataset.number = newNumber;
                    
                    // Save to JSON
                    saveDevicesJson();
                    
                    // Reload switches to reflect changes
                    setTimeout(() => {
                        createSwitches();
                    }, 500);
                });
                
                // Add event listener to the switch
                const toggle = switchItem.querySelector('input[type="checkbox"]');
                toggle.addEventListener('change', () => handleToggle(device, toggle));
            });
            
            groupContainer.appendChild(devicesContainer);
            ipContent.appendChild(groupContainer);
        });
        
        ipSection.appendChild(ipContent);
        switchesContainer.appendChild(ipSection);
    });
    
    // Start periodic state checking
    startStatePolling();
    
    // Start periodic connectivity checking
    startConnectivityPolling();
}

// Check connectivity for a specific IP
async function checkIPConnectivity(ip) {
    const statusSpan = document.querySelector(`.ip-status[data-ip="${ip}"]`);
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`http://${ip}`, {
            method: 'GET',
            mode: 'no-cors',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        statusSpan.textContent = 'Connected';
        statusSpan.className = 'ip-status connected';
    } catch (error) {
        statusSpan.textContent = 'Offline';
        statusSpan.className = 'ip-status offline';
    }
}

// Handle group toggle - turn on/off all devices in the group
async function handleGroupToggle(groupName, groupDevices, groupToggle) {
    const targetState = groupToggle.checked;
    const paramType = targetState ? 'z' : 'v';
    
    groupToggle.disabled = true;
    updateStatus(`Toggling ${groupName}...`, 'info');
    
    // Mark all devices in group as recently toggled
    groupDevices.forEach(device => {
        const deviceKey = `${device.ip}:${device.number}`;
        recentlyToggledDevices.add(deviceKey);
    });
    
    // Mark this group as recently toggled
    const groupKey = `${groupDevices[0].ip}:${groupName}`;
    recentlyToggledGroups.add(groupKey);
    
    // Pause state polling during group toggle
    stopStatePolling();
    
    // Toggle all devices in the group in parallel
    const togglePromises = groupDevices.map(device => {
        const command = `/genericArgs?${paramType}=${device.number}`;
        
        return fetch(`/proxy/command?ip=${device.ip}&cmd=${encodeURIComponent(command)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/plain, */*'
            }
        }).then(() => {
            // Update individual device toggle
            const deviceToggle = document.querySelector(`input[data-number="${device.number}"][data-group="${groupName}"]`);
            if (deviceToggle) {
                deviceToggle.checked = targetState;
            }
        }).catch(error => {
            console.error(`Failed to toggle ${device.name}:`, error);
        });
    });
    
    // Wait for all toggles to complete
    await Promise.all(togglePromises);
    
    updateStatus(`${groupName} ${targetState ? 'ON' : 'OFF'}`, 'success');
    groupToggle.disabled = false;
    
    // Resume state polling after 1 second delay
    setTimeout(() => {
        startStatePolling();
    }, 1000);
    
    // Remove devices from recently toggled after 3 seconds
    setTimeout(() => {
        groupDevices.forEach(device => {
            const deviceKey = `${device.ip}:${device.number}`;
            recentlyToggledDevices.delete(deviceKey);
        });
        recentlyToggledGroups.delete(groupKey);
    }, 3000);
}

// Fetch and parse states from the device
async function fetchStates() {
    const uniqueIPs = [...new Set(devices.map(d => d.ip))];
    
    // Check each IP separately
    for (const ip of uniqueIPs) {
        try {
            // Use proxy endpoint to avoid CORS issues
            const response = await fetch(`/proxy/states?ip=${ip}`, {
                method: 'GET',
                headers: {
                    'Accept': 'text/plain, */*'
                }
            });
            
            if (response.ok) {
                const text = await response.text();
                parseAndUpdateStates(text, ip);
            }
        } catch (error) {
            console.log(`Failed to get states from ${ip}:`, error.message);
        }
    }
}

// Parse states response and update toggle switches
function parseAndUpdateStates(statesText, ip) {
    // Extract the input section
    const inputMatch = statesText.match(/input:\s*([\s\S]*?)(?:output:|$)/);
    
    if (inputMatch) {
        const inputSection = inputMatch[1];
        const lines = inputSection.trim().split('\n');
        
        // Create a map of input states (number -> on/off)
        const inputStates = {};
        lines.forEach(line => {
            const matches = line.matchAll(/(\d+):(on|off)/g);
            for (const match of matches) {
                // Adjust for off-by-one: device shows 01-24 but should be 0-23
                const adjustedNumber = parseInt(match[1]) - 1;
                inputStates[adjustedNumber] = match[2] === 'on';
            }
        });
        
        updateInputDisplay(inputStates, ip);
    }
    
    // Extract the output section
    const outputMatch = statesText.match(/output:\s*([\s\S]*?)(?:all states|$)/);
    
    if (!outputMatch) {
        console.log(`Could not parse output section from states for ${ip}`);
        return;
    }
    
    const outputSection = outputMatch[1];
    const lines = outputSection.trim().split('\n');
    
    // Create a map of output states (number -> on/off)
    const outputStates = {};
    lines.forEach(line => {
        const match = line.match(/(\d+):(on|off)/);
        if (match) {
            // Adjust for off-by-one: device shows 01-16 but should be 0-15
            const adjustedNumber = parseInt(match[1]) - 1;
            outputStates[adjustedNumber] = match[2] === 'on';
        }
    });
    
    // Update toggle switches for devices on this specific IP
    devices.filter(device => device.ip === ip).forEach(device => {
        const toggle = document.querySelector(`input[data-number="${device.number}"][data-ip="${ip}"]`);
        if (toggle && outputStates.hasOwnProperty(device.number)) {
            const deviceKey = `${ip}:${device.number}`;
            
            // Skip updating if this device was recently toggled by the user
            if (recentlyToggledDevices.has(deviceKey)) {
                return;
            }
            
            const shouldBeChecked = outputStates[device.number];
            
            // Only update if different to avoid unnecessary DOM updates
            if (toggle.checked !== shouldBeChecked) {
                toggle.checked = shouldBeChecked;
            }
        }
    });
    
    // Update group toggles based on device states for this IP
    const ipDevices = devices.filter(device => device.ip === ip);
    const groups = {};
    
    // Group devices by group name
    ipDevices.forEach(device => {
        if (!groups[device.group]) {
            groups[device.group] = [];
        }
        groups[device.group].push(device);
    });
    
    // Update each group toggle
    Object.keys(groups).forEach(groupName => {
        const groupDevices = groups[groupName];
        const groupToggle = document.querySelector(`.group-toggle[data-group="${groupName}"][data-ip="${ip}"]`);
        
        if (groupToggle) {
            const groupKey = `${ip}:${groupName}`;
            
            // Skip updating if this group was recently toggled by the user
            if (recentlyToggledGroups.has(groupKey)) {
                return;
            }
            
            // Check if any device in the group is on
            const anyDeviceOn = groupDevices.some(device => {
                return outputStates.hasOwnProperty(device.number) && outputStates[device.number];
            });
            
            // Update group toggle state
            if (groupToggle.checked !== anyDeviceOn) {
                groupToggle.checked = anyDeviceOn;
            }
        }
    });
}

// Update input display
function updateInputDisplay(inputStates, ip) {
    // Create input sections if they don't exist
    if (!inputSectionsCreated) {
        createInputSections();
        inputSectionsCreated = true;
    }
    
    // Get the IP section name
    const ipDevice = devices.find(d => d.ip === ip);
    const ipGroupName = ipDevice ? ipDevice.ipGroupName : ip;
    
    // Initialize previous states for this IP if not exists
    if (!previousInputStates[ip]) {
        previousInputStates[ip] = {};
    }
    
    // Update input states and detect changes for this IP
    Object.keys(inputStates).forEach(number => {
        const isOn = inputStates[number];
        const inputItem = inputsContainer.querySelector(`[data-input-number="${number}"][data-input-ip="${ip}"]`);
        
        if (inputItem) {
            const statusSpan = inputItem.querySelector('.input-status');
            const newState = isOn ? 'on' : 'off';
            const oldState = previousInputStates[ip][number];
            
            // Update the status
            statusSpan.textContent = newState.toUpperCase();
            statusSpan.dataset.state = newState;
            
            // Flash if state changed
            if (oldState !== undefined && oldState !== isOn) {
                inputItem.classList.add('flashing');
                setTimeout(() => {
                    inputItem.classList.remove('flashing');
                }, 4000); // Flash for 3 seconds
            }
        }
        
        // Update previous state
        previousInputStates[ip][number] = isOn;
    });
}

// Create input sections for each IP
function createInputSections() {
    inputsContainer.innerHTML = '';
    const uniqueIPs = [...new Set(devices.map(d => d.ip))];
    
    uniqueIPs.forEach(ip => {
        const ipDevice = devices.find(d => d.ip === ip);
        const ipGroupName = ipDevice ? ipDevice.ipGroupName : ip;
        
        // Initialize inputNames for this IP if not exists
        if (!inputNames[ip]) {
            inputNames[ip] = {};
        }
        
        // Create IP section for inputs
        const inputIpSection = document.createElement('div');
        inputIpSection.className = 'input-ip-section';
        
        // Create header
        const inputHeader = document.createElement('div');
        inputHeader.className = 'input-ip-header';
        inputHeader.innerHTML = `
            <div class="input-ip-header-content">
                <span class="collapse-icon">▼</span>
                <span class="input-ip-title">${ipGroupName} - Inputs</span>
            </div>
        `;
        
        // Add click handler to toggle collapse
        inputHeader.addEventListener('click', () => {
            inputIpSection.classList.toggle('collapsed');
        });
        
        inputIpSection.appendChild(inputHeader);
        
        // Create content container
        const inputContent = document.createElement('div');
        inputContent.className = 'input-ip-content';
        
        const inputGrid = document.createElement('div');
        inputGrid.className = 'inputs-grid';
        
        // Create 24 input items (0-23) for this IP
        for (let i = 0; i < 24; i++) {
            const inputItem = document.createElement('div');
            inputItem.className = 'input-item';
            inputItem.dataset.inputNumber = i;
            inputItem.dataset.inputIp = ip;
            
            // Get custom name or use default
            const displayName = inputNames[ip][i] || `Input ${i}`;
            
            inputItem.innerHTML = `
                <span class="input-number editable" contenteditable="false"><span class="input-number-text">${displayName}</span></span>
                <button class="edit-input-btn" title="Edit name">✏️</button>
                <span class="input-status" data-state="off">OFF</span>
            `;
            
            // Add edit functionality
            const nameSpan = inputItem.querySelector('.input-number');
            const nameTextSpan = nameSpan.querySelector('.input-number-text');
            const editBtn = inputItem.querySelector('.edit-input-btn');
            
            // Check if text needs scrolling
            const checkScrolling = () => {
                if (nameSpan.contentEditable === 'false') {
                    const textWidth = nameTextSpan.offsetWidth;
                    const containerWidth = nameSpan.offsetWidth;
                    if (textWidth > containerWidth) {
                        nameSpan.classList.add('scrolling');
                    } else {
                        nameSpan.classList.remove('scrolling');
                    }
                }
            };
            
            // Initial check
            setTimeout(checkScrolling, 100);
            
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (nameSpan.contentEditable === 'false') {
                    // Enter edit mode
                    nameSpan.classList.remove('scrolling');
                    nameSpan.contentEditable = 'true';
                    nameSpan.focus();
                    editBtn.textContent = '✓';
                    editBtn.title = 'Save name';
                    // Select all text
                    const range = document.createRange();
                    range.selectNodeContents(nameSpan);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                } else {
                    // Save and exit edit mode
                    nameSpan.contentEditable = 'false';
                    editBtn.textContent = '✏️';
                    editBtn.title = 'Edit name';
                    
                    // Save the new name
                    const newName = nameSpan.textContent.trim();
                    if (newName && newName !== `Input ${i}`) {
                        inputNames[ip][i] = newName;
                        nameTextSpan.textContent = newName;
                    } else {
                        // If empty or default, remove custom name
                        delete inputNames[ip][i];
                        nameTextSpan.textContent = `Input ${i}`;
                    }
                    saveInputNames();
                    
                    // Re-check if scrolling is needed after save
                    setTimeout(checkScrolling, 100);
                }
            });
            
            // Save on Enter key, cancel on Escape
            nameSpan.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    editBtn.click();
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    // Cancel editing
                    nameSpan.contentEditable = 'false';
                    nameTextSpan.textContent = inputNames[ip][i] || `Input ${i}`;
                    editBtn.textContent = '✏️';
                    editBtn.title = 'Edit name';
                    checkScrolling();
                }
            });
            
            inputGrid.appendChild(inputItem);
        }
        
        inputContent.appendChild(inputGrid);
        inputIpSection.appendChild(inputContent);
        inputsContainer.appendChild(inputIpSection);
    });
}

// Start polling for states every 2 seconds
let statePollingInterval = null;
let connectivityPollingInterval = null;

function startStatePolling() {
    // Clear any existing interval
    if (statePollingInterval) {
        clearInterval(statePollingInterval);
    }
    
    // Initial fetch
    fetchStates();
    
    // Set up periodic polling every 2 seconds
    statePollingInterval = setInterval(() => {
        fetchStates();
    }, 2000);
}

// Stop polling (useful if needed later)
function stopStatePolling() {
    if (statePollingInterval) {
        clearInterval(statePollingInterval);
        statePollingInterval = null;
    }
}

// Check connectivity for all IPs
function checkAllIPConnectivity() {
    const uniqueIPs = [...new Set(devices.map(d => d.ip))];
    uniqueIPs.forEach(ip => {
        checkIPConnectivity(ip);
    });
}

// Start periodic connectivity checking every 10 seconds
function startConnectivityPolling() {
    // Clear any existing interval
    if (connectivityPollingInterval) {
        clearInterval(connectivityPollingInterval);
    }
    
    // Set up periodic polling every 10 seconds (no initial check)
    connectivityPollingInterval = setInterval(() => {
        checkAllIPConnectivity();
    }, 10000);
}

// Stop connectivity polling
function stopConnectivityPolling() {
    if (connectivityPollingInterval) {
        clearInterval(connectivityPollingInterval);
        connectivityPollingInterval = null;
    }
}

// Handle toggle switch change
async function handleToggle(device, toggle) {
    const paramType = toggle.checked ? 'z' : 'v';
    const command = `/genericArgs?${paramType}=${device.number}`;
    
    toggle.disabled = true;
    updateStatus('Sending command...', 'info');
    
    // Mark this device as recently toggled
    const deviceKey = `${device.ip}:${device.number}`;
    recentlyToggledDevices.add(deviceKey);
    
    // Pause state polling during toggle to avoid conflict
    stopStatePolling();
    
    try {
        // Use proxy endpoint to avoid CORS issues
        const response = await fetch(`/proxy/command?ip=${device.ip}&cmd=${encodeURIComponent(command)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/plain, */*'
            }
        });

        if (response.ok) {
            const contentType = response.headers.get('content-type');
            let data;
            
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
                responseDiv.textContent = JSON.stringify(data, null, 2);
            } else {
                data = await response.text();
                responseDiv.textContent = data;
            }

            updateStatus(`Command sent to ${device.name}!`, 'success');
        } else {
            responseDiv.textContent = `Error: ${response.status} ${response.statusText}`;
            updateStatus(`Failed: ${response.status}`, 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        responseDiv.textContent = `Error: ${error.message}\n\nNote: Make sure the device is reachable on your local network.`;
        updateStatus('Connection failed', 'error');
    } finally {
        toggle.disabled = false;
        
        // Resume state polling after 1 second delay
        setTimeout(() => {
            startStatePolling();
        }, 1000);
        
        // Remove from recently toggled after 3 seconds to allow device to process and report new state
        setTimeout(() => {
            recentlyToggledDevices.delete(deviceKey);
        }, 3000);
    }
}

// Load devices on page load
loadDevices();

// Master toggle for all devices
document.getElementById('masterToggle').addEventListener('change', async function() {
    const targetState = this.checked;
    const paramType = targetState ? 'z' : 'v';
    
    this.disabled = true;
    updateStatus('Toggling all devices...', 'info');
    
    // Mark all devices as recently toggled
    devices.forEach(device => {
        const deviceKey = `${device.ip}:${device.number}`;
        recentlyToggledDevices.add(deviceKey);
    });
    
    // Pause state polling during master toggle
    stopStatePolling();
    
    // Toggle all devices across all IPs in parallel
    const togglePromises = devices.map(device => {
        const command = `/genericArgs?${paramType}=${device.number}`;
        
        return fetch(`/proxy/command?ip=${device.ip}&cmd=${encodeURIComponent(command)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/plain, */*'
            }
        }).then(() => {
            // Update individual device toggle for this specific IP and device number
            const deviceToggle = document.querySelector(`input[data-number="${device.number}"][data-ip="${device.ip}"]`);
            if (deviceToggle) {
                deviceToggle.checked = targetState;
            }
        }).catch(error => {
            console.error(`Failed to toggle ${device.name} on ${device.ip}:`, error);
        });
    });
    
    // Wait for all toggles to complete
    await Promise.all(togglePromises);
    
    // Update all group toggles across all IPs
    document.querySelectorAll('.group-toggle').forEach(groupToggle => {
        groupToggle.checked = targetState;
    });
    
    updateStatus(`All devices ${targetState ? 'ON' : 'OFF'}`, 'success');
    this.disabled = false;
    
    // Resume state polling after 1 second delay
    setTimeout(() => {
        startStatePolling();
    }, 1000);
    
    // Remove all devices from recently toggled after 3 seconds
    setTimeout(() => {
        devices.forEach(device => {
            const deviceKey = `${device.ip}:${device.number}`;
            recentlyToggledDevices.delete(deviceKey);
        });
    }, 3000);
});

// Fetch and parse matrix data from device
async function fetchMatrix(ip) {
    try {
        const response = await fetch(`/proxy/matrix?ip=${ip}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        
        // Parse matrix from response
        const lines = text.split('\n');
        const matrixLines = [];
        let inMatrix = false;
        
        for (const line of lines) {
            if (line.includes('matrix:')) {
                inMatrix = true;
                continue;
            }
            if (line.includes('matrix end')) {
                break;
            }
            if (inMatrix && line.trim()) {
                matrixLines.push(line.trim());
            }
        }
        
        return matrixLines;
    } catch (error) {
        console.error(`Error fetching matrix for ${ip}:`, error);
        return [];
    }
}

// Create interconnection visualization
async function createInterconnectionSections() {
    const interconnectionContainer = document.getElementById('interconnectionContainer');
    interconnectionContainer.innerHTML = '<div class="loading">Loading interconnection data...</div>';
    
    const uniqueIPs = [...new Set(devices.map(d => d.ip))];
    interconnectionContainer.innerHTML = '';
    
    for (const ip of uniqueIPs) {
        const ipData = devices.find(d => d.ip === ip);
        const ipGroupName = ipData ? ipData.ipGroupName : ip;
        
        // Fetch matrix for this IP
        const matrixLines = await fetchMatrix(ip);
        
        if (matrixLines.length === 0) {
            const errorSection = document.createElement('div');
            errorSection.className = 'interconnection-ip-section';
            errorSection.innerHTML = `
                <div class="interconnection-header">${ipGroupName}</div>
                <div class="interconnection-error">No matrix data available</div>
            `;
            interconnectionContainer.appendChild(errorSection);
            continue;
        }
        
        // Create IP section
        const ipSection = document.createElement('div');
        ipSection.className = 'interconnection-ip-section';
        
        const header = document.createElement('div');
        header.className = 'interconnection-header';
        header.textContent = ipGroupName;
        ipSection.appendChild(header);
        
        // Initialize inputNames for this IP if not exists
        if (!inputNames[ip]) {
            inputNames[ip] = {};
        }
        
        const numOutputs = matrixLines.length;
        const numInputs = matrixLines[0] ? matrixLines[0].length : 0;
        
        // Identify used/unused outputs and inputs
        const usedOutputs = [];
        const unusedOutputs = [];
        for (let o = 0; o < numOutputs; o++) {
            const hasConnection = matrixLines[o].includes('+');
            if (hasConnection) {
                usedOutputs.push(o);
            } else {
                unusedOutputs.push(o);
            }
        }
        
        const usedInputs = [];
        const unusedInputs = [];
        for (let i = 0; i < numInputs; i++) {
            let hasConnection = false;
            for (let o = 0; o < numOutputs; o++) {
                if (matrixLines[o][i] === '+') {
                    hasConnection = true;
                    break;
                }
            }
            if (hasConnection) {
                usedInputs.push(i);
            } else {
                unusedInputs.push(i);
            }
        }
        
        // Create ordered lists: used first, then unused
        const orderedOutputs = [...usedOutputs, ...unusedOutputs];
        const orderedInputs = [...usedInputs, ...unusedInputs];
        
        // Create table wrapper for horizontal scrolling
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'matrix-table-wrapper';
        
        // Create table
        const table = document.createElement('table');
        table.className = 'matrix-table';
        
        // Create header row with output names
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Empty cell for top-left corner
        const cornerCell = document.createElement('th');
        cornerCell.className = 'corner-cell';
        headerRow.appendChild(cornerCell);
        
        // Output column headers
        orderedOutputs.forEach(outputIdx => {
            const th = document.createElement('th');
            const device = devices.find(d => d.ip === ip && d.number === outputIdx);
            const outputName = device ? device.name : `Output ${outputIdx}`;
            th.textContent = outputName;
            th.title = outputName; // Full name on hover
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create table body with input rows
        const tbody = document.createElement('tbody');
        
        orderedInputs.forEach(inputIdx => {
            const row = document.createElement('tr');
            
            // Input name cell (row header)
            const inputCell = document.createElement('th');
            const inputName = inputNames[ip][inputIdx] || `Input ${inputIdx}`;
            inputCell.textContent = inputName;
            inputCell.title = inputName; // Full name on hover
            inputCell.className = 'input-cell';
            row.appendChild(inputCell);
            
            // Connection cells for each output
            orderedOutputs.forEach(outputIdx => {
                const td = document.createElement('td');
                
                // Check if there's a connection
                if (matrixLines[outputIdx] && matrixLines[outputIdx][inputIdx] === '+') {
                    td.textContent = '●';
                    td.className = 'connected';
                }
                
                row.appendChild(td);
            });
            
            tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        
        // Add table to wrapper, wrapper to section
        tableWrapper.appendChild(table);
        ipSection.appendChild(tableWrapper);
        interconnectionContainer.appendChild(ipSection);
    }
}

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update active page
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(tabName + 'Page').classList.add('active');
        
        // Load interconnection data when switching to that tab
        if (tabName === 'interconnection' && !interconnectionSectionsCreated) {
            createInterconnectionSections();
            interconnectionSectionsCreated = true;
        }
    });
});

// Emoji library organized by categories
const emojiLibrary = {
    home: ['🏠', '🏡', '🏢', '🏰', '🏛️', '🛋️', '🛏️', '🚪', '🪟', '🪑', '🛁', '🚿', '🧺', '🧹', '🧼', '🗝️'],
    lights: ['💡', '🔦', '🕯️', '🪔', '💫', '✨', '⭐', '🌟', '💥', '🔅', '🔆', '☀️', '🌙', '🌛', '🌜', '🌝'],
    electronics: ['📺', '📻', '🖥️', '⌨️', '🖱️', '🖨️', '📱', '☎️', '📞', '📟', '📠', '🔌', '🔋', '💻', '⏰', '⏱️'],
    comfort: ['🌡️', '❄️', '🔥', '💨', '🌬️', '💧', '💦', '☁️', '⛅', '🌤️', '🌈', '🎵', '🎶', '🔊', '🔇', '📢'],
    security: ['🔒', '🔓', '🔐', '🗝️', '🔑', '🚨', '🚦', '🚥', '⚠️', '🛡️', '🔰', '📹', '📷', '📸', '👁️', '🔍'],
    symbols: ['⭐', '✅', '❌', '❎', '✔️', '✖️', '➕', '➖', '➗', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚪', '⚫', '🟤', '🔶', '🔷', '🔸', '🔹', '💠', '🔺', '🔻', '💎', '🎯', '⚡', '🌀', '♻️']
};

let currentGroupKey = null;

// Open emoji picker modal
function openEmojiPicker(groupKey, groupName) {
    currentGroupKey = groupKey;
    const modal = document.getElementById('emojiPickerModal');
    modal.style.display = 'flex';
    
    // Load initial category (home)
    loadEmojiCategory('home');
}

// Close emoji picker modal
function closeEmojiPicker() {
    const modal = document.getElementById('emojiPickerModal');
    modal.style.display = 'none';
    currentGroupKey = null;
}

// Load emojis for a specific category
function loadEmojiCategory(category) {
    const emojiGrid = document.getElementById('emojiGrid');
    emojiGrid.innerHTML = '';
    
    const emojis = emojiLibrary[category] || [];
    emojis.forEach(emoji => {
        const emojiBtn = document.createElement('button');
        emojiBtn.className = 'emoji-btn';
        emojiBtn.textContent = emoji;
        emojiBtn.addEventListener('click', () => selectEmoji(emoji));
        emojiGrid.appendChild(emojiBtn);
    });
    
    // Add "No Icon" option
    const noEmojiBtn = document.createElement('button');
    noEmojiBtn.className = 'emoji-btn no-emoji';
    noEmojiBtn.textContent = '❌';
    noEmojiBtn.title = 'Remove icon';
    noEmojiBtn.addEventListener('click', () => selectEmoji(''));
    emojiGrid.appendChild(noEmojiBtn);
}

// Select an emoji
function selectEmoji(emoji) {
    if (currentGroupKey) {
        // Save emoji to settings
        if (emoji) {
            groupSettings[currentGroupKey] = emoji;
        } else {
            delete groupSettings[currentGroupKey];
        }
        
        // Update UI
        const emojiSpan = document.querySelector(`.group-emoji[data-group-key="${currentGroupKey}"]`);
        if (emojiSpan) {
            emojiSpan.textContent = emoji;
        }
        
        // Save to server
        saveGroupSettings();
        
        // Close modal
        closeEmojiPicker();
    }
}

// Set up emoji picker event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Close button
    const closeBtn = document.querySelector('.emoji-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeEmojiPicker);
    }
    
    // Click outside modal to close
    const modal = document.getElementById('emojiPickerModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeEmojiPicker();
            }
        });
    }
    
    // Category buttons
    document.querySelectorAll('.emoji-category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            document.querySelectorAll('.emoji-category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Load category
            const category = btn.dataset.category;
            loadEmojiCategory(category);
        });
    });
});

// Register Service Worker for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('ServiceWorker registered'))
            .catch(err => console.log('ServiceWorker registration failed:', err));
    });
}
