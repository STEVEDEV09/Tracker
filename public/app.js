// app.js - Geolocation API se real GPS location le raha hai

let map;
let myMarker;
let otherUsers = {};
let socket;
let myUserId;
let watchId = null;
let updateInterval = null;

// ==================== MAP INITIALIZATION ====================

function initMap() {
    // Default center (India Gate, Delhi)
    const defaultCenter = [28.6129, 77.2295];
    
    map = L.map('map').setView(defaultCenter, 13);
    
    // OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Socket connection
    socket = io();
    
    // User ID generate
    myUserId = getUserId();
    
    // Start GPS tracking
    startGPSTracking();
    
    // Listen for other users
    listenForOtherUsers();
}

// ==================== USER ID ====================

function getUserId() {
    let userId = localStorage.getItem('userId');
    if(!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('userId', userId);
    }
    return userId;
}

// ==================== GPS TRACKING - GEOLOCATION API ====================

function startGPSTracking() {
    if(!navigator.geolocation) {
        updateGPSStatus('❌ Your browser does not support GPS', 'error');
        return;
    }
    
    updateGPSStatus('📡 Getting your location...', 'loading');
    
    // Check permissions first
    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if(result.state === 'denied') {
            updateGPSStatus('❌ Location permission denied. Please enable in settings.', 'error');
        }
    });
    
    // GEOLOCATION API - Real location lene ke liye
    // watchPosition - continuous tracking (best for real-time)
    if('watchPosition' in navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            // Success callback - location mil gayi
            (position) => {
                handleLocationUpdate(position);
            },
            // Error callback - kuch problem hui
            (error) => {
                handleLocationError(error);
            },
            // Options - accuracy ke liye
            {
                enableHighAccuracy: true,    // High accuracy GPS
                maximumAge: 0,               // No cached location
                timeout: 10000               // 10 second timeout
            }
        );
    } else {
        // Fallback - getCurrentPosition (single shot)
        navigator.geolocation.getCurrentPosition(
            (position) => {
                handleLocationUpdate(position);
                // Har 3 second mein update
                updateInterval = setInterval(() => {
                    navigator.geolocation.getCurrentPosition(
                        handleLocationUpdate,
                        handleLocationError,
                        { enableHighAccuracy: true }
                    );
                }, 3000);
            },
            handleLocationError,
            { enableHighAccuracy: true }
        );
    }
}

// Location update handle karna
function handleLocationUpdate(position) {
    let lat = position.coords.latitude;
    let lng = position.coords.longitude;
    let accuracy = position.coords.accuracy;
    let altitude = position.coords.altitude;
    let speed = position.coords.speed;
    
    // Update UI
    updateGPSStatus('✅ Live location active', 'success');
    updateCoordinates(lat, lng);
    updateAccuracy(accuracy);
    
    if(speed !== null) {
        updateSpeed(speed);
    }
    
    // Khud ka marker
    if(!myMarker) {
        // Pehli baar marker banao
        myMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'self-marker',
                html: '📍',
                iconSize: [32, 32],
                popupAnchor: [0, -16]
            })
        }).addTo(map);
        
        myMarker.bindPopup(`
            <b>You!</b><br>
            📍 Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}<br>
            🎯 Accuracy: ${accuracy.toFixed(0)} meters
        `).openPopup();
        
        // Map center karo
        map.setView([lat, lng], 16);
    } else {
        // Marker update karo
        myMarker.setLatLng([lat, lng]);
        myMarker.bindPopup(`
            <b>You!</b><br>
            📍 Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}<br>
            🎯 Accuracy: ${accuracy.toFixed(0)} meters
        `);
        
        // Agar map follow mode on hai to center karo
        if(followMode) {
            map.setView([lat, lng], map.getZoom());
        }
    }
    
    // Server pe location bhejo
    socket.emit('update-location', {
        userId: myUserId,
        lat: lat,
        lng: lng,
        accuracy: accuracy,
        timestamp: new Date().toISOString()
    });
}

// GPS Error handle
function handleLocationError(error) {
    let message = '';
    switch(error.code) {
        case error.PERMISSION_DENIED:
            message = '❌ Location permission denied. Please allow access.';
            break;
        case error.POSITION_UNAVAILABLE:
            message = '📡 Location unavailable. Check your GPS.';
            break;
        case error.TIMEOUT:
            message = '⏱️ Location request timeout. Trying again...';
            break;
        default:
            message = '❌ GPS error: ' + error.message;
    }
    updateGPSStatus(message, 'error');
    console.error('Geolocation Error:', error);
}

// ==================== UI UPDATES ====================

function updateGPSStatus(message, type) {
    let statusDiv = document.getElementById('gps-status');
    statusDiv.textContent = message;
    
    if(type === 'loading') {
        statusDiv.classList.add('loading');
    } else {
        statusDiv.classList.remove('loading');
    }
    
    if(type === 'error') {
        statusDiv.style.color = '#ff6666';
    } else if(type === 'success') {
        statusDiv.style.color = '#88ff88';
    } else {
        statusDiv.style.color = '#ffaa00';
    }
}

function updateCoordinates(lat, lng) {
    document.getElementById('coords').innerHTML = 
        `📍 ${lat.toFixed(6)}°, ${lng.toFixed(6)}°`;
}

function updateAccuracy(accuracy) {
    let accuracyText = '';
    if(accuracy < 10) {
        accuracyText = '🎯 Excellent (≤10m)';
    } else if(accuracy < 50) {
        accuracyText = '👍 Good (≤50m)';
    } else if(accuracy < 100) {
        accuracyText = '⚠️ Moderate (≤100m)';
    } else {
        accuracyText = '📡 Poor (>100m)';
    }
    document.getElementById('accuracy').innerHTML = 
        `🎯 Accuracy: ${accuracy.toFixed(0)} meters - ${accuracyText}`;
}

function updateSpeed(speed) {
    let speedKmh = (speed * 3.6).toFixed(1);
    let speedDiv = document.getElementById('speed');
    if(!speedDiv) {
        let newDiv = document.createElement('div');
        newDiv.id = 'speed';
        newDiv.className = 'speed';
        document.querySelector('.accuracy').after(newDiv);
        speedDiv = newDiv;
    }
    if(speedKmh > 0) {
        speedDiv.innerHTML = `🚗 Speed: ${speedKmh} km/h`;
    } else {
        speedDiv.innerHTML = '';
    }
}

// Follow mode toggle
let followMode = true;
function toggleFollowMode() {
    followMode = !followMode;
    let btn = document.getElementById('follow-btn');
    if(btn) {
        btn.textContent = followMode ? '🔴 Follow On' : '⚪ Follow Off';
    }
}

// ==================== OTHER USERS ====================

function listenForOtherUsers() {
    // Sab users ka data aaya
    socket.on('all-users', (users) => {
        users.forEach(user => {
            if(user.userId !== myUserId) {
                addOtherUserMarker(user);
            }
        });
        updateUserCount(Object.keys(otherUsers).length + 1);
    });
    
    // Naya user join hua
    socket.on('user-joined', (user) => {
        if(user.userId !== myUserId) {
            addOtherUserMarker(user);
            updateUserCount(Object.keys(otherUsers).length + 1);
            
            // Notification (optional)
            showToast(`🟢 New user joined!`);
        }
    });
    
    // User move hua
    socket.on('user-moved', (user) => {
        if(user.userId !== myUserId) {
            updateOtherUserMarker(user);
        }
    });
    
    // User left
    socket.on('user-left', (userId) => {
        removeOtherUserMarker(userId);
        updateUserCount(Object.keys(otherUsers).length);
        
        showToast(`🔴 A user left`);
    });
}

function addOtherUserMarker(user) {
    if(otherUsers[user.userId]) return;
    
    // Random emoji for different users
    const emojis = ['🚗', '🚕', '🚙', '🚌', '🏍️', '🚲', '🏃', '🧍'];
    let emojiIndex = Object.keys(otherUsers).length % emojis.length;
    let emoji = emojis[emojiIndex];
    
    let marker = L.marker([user.lat, user.lng], {
        icon: L.divIcon({
            className: 'other-marker',
            html: `<div style="font-size:28px;">${emoji}</div>`,
            iconSize: [32, 32],
            popupAnchor: [0, -16]
        })
    }).addTo(map);
    
    let accuracyText = user.accuracy ? `🎯 Accuracy: ${user.accuracy.toFixed(0)}m` : '';
    marker.bindPopup(`
        <b>${emoji} User ${user.userId.slice(-6)}</b><br>
        📍 Last seen: Just now<br>
        ${accuracyText}
    `);
    
    otherUsers[user.userId] = marker;
}

function updateOtherUserMarker(user) {
    if(otherUsers[user.userId]) {
        otherUsers[user.userId].setLatLng([user.lat, user.lng]);
        otherUsers[user.userId].bindPopup(`
            <b>User ${user.userId.slice(-6)}</b><br>
            📍 Moving...
        `);
        
        // Animation effect
        let element = otherUsers[user.userId].getElement();
        if(element) {
            element.style.animation = 'pulse 0.3s ease';
            setTimeout(() => {
                if(element) element.style.animation = '';
            }, 300);
        }
    }
}

function removeOtherUserMarker(userId) {
    if(otherUsers[userId]) {
        map.removeLayer(otherUsers[userId]);
        delete otherUsers[userId];
    }
}

function updateUserCount(count) {
    document.getElementById('user-count').innerText = count;
}

// ==================== TOAST NOTIFICATION ====================

function showToast(message) {
    let toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 12px;
        z-index: 2000;
        animation: fadeOut 2s ease forwards;
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 2000);
}

// Add fadeOut animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        0% { opacity: 1; transform: translateX(-50%) translateY(0); }
        70% { opacity: 1; }
        100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    }
`;
document.head.appendChild(style);

// ==================== CLEANUP ====================

// Page close pe GPS tracking stop karo
window.addEventListener('beforeunload', () => {
    if(watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
    }
    if(updateInterval !== null) {
        clearInterval(updateInterval);
    }
});

// ==================== START ====================
initMap();