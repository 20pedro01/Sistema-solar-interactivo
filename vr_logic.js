// --- CONFIGURACIÓN VR / AR ---
const videoElement = document.getElementById('input-video');
const canvasElement = document.getElementById('canvas-overlay');
const canvasCtx = canvasElement.getContext('2d');
const statusText = document.getElementById('status-text');

// Variables de Juego Globales (Copia de logic_drag)
let planets = [];
let zones = [];
let invBox = {}, sysBox = {};
let isFullscreen = false;
let worldW = 0, worldH = 0; // Dimensiones del mundo virtual
let cameraYaw = 0; // Desplazamiento horizontal (Alpha)
let cameraPitch = 0; // Desplazamiento vertical (Beta/Gama)

// Sistema de LOG para depuración en pantalla
function log(msg) {
    console.log("VR-LOG:", msg);
    if (statusText) statusText.innerText = msg;
}

// Escuchar orientación del dispositivo
window.addEventListener('deviceorientation', (e) => {
    if (e.alpha !== null) {
        const sensitivityH = 6; 
        const sensitivityV = 4;
        cameraYaw = (e.alpha % 360) * sensitivityH;
        
        if (e.beta !== null) {
            // Ajuste para que la vista sea cómoda al sostener el móvil frente a la cara
            // El ángulo 60-70 suele ser el natural en visores
            cameraPitch = (e.beta - 65) * sensitivityV; 
        }
    }
}, true);

// Estado de manos / Gaze
let IS_PINCHING = false;
let selectedPlanet = null;
let gazeTarget = null; // Planeta al que se está mirando

// Cargar Imágenes
const rocketImg = new Image();
rocketImg.src = "https://cdn-icons-png.flaticon.com/512/1356/1356479.png";

const solarSystemData = [
    { id: "sol", name: "Sol", color: "#FFD700", r: 60, type: "star", src: "Assets/Sol.svg" },
    { id: "mercurio", name: "Mercurio", color: "#A9A9A9", r: 12, type: "circle", src: "Assets/Mercurio.svg" },
    { id: "venus", name: "Venus", color: "#FFA500", r: 20, type: "circle", src: "Assets/Venus.svg" },
    { id: "tierra", name: "Tierra", color: "#1E90FF", r: 22, type: "circle", src: "Assets/Tierra.svg" },
    { id: "marte", name: "Marte", color: "#FF4500", r: 18, type: "circle", src: "Assets/Marte.svg" },
    { id: "cinturon", name: "Cinturón de asteroides", color: "#8B4513", w: 50, h: 180, type: "belt", src: "Assets/Cinturón.svg" },
    { id: "jupiter", name: "Júpiter", color: "#DEB887", r: 55, type: "circle", src: "Assets/Júpiter.svg" },
    { id: "saturno", name: "Saturno", color: "#F4C430", r: 45, type: "saturn", src: "Assets/Saturno.svg" },
    { id: "urano", name: "Urano", color: "#00FFFF", r: 35, type: "circle", src: "Assets/Urano.svg" },
    { id: "neptuno", name: "Neptuno", color: "#00008B", r: 34, type: "circle", src: "Assets/Neptuno.svg" }
];

const planetImages = {};
solarSystemData.forEach(p => {
    const img = new Image();
    img.src = p.src;
    planetImages[p.id] = img;
});

// Botones virtuales (Mismos que drag para lógica, pero se dibujan estéreo)
const fsBtn = { x: 0, y: 0, w: 50, h: 50 };
const backBtn = { x: 0, y: 0, w: 50, h: 50 };
const restartBtn = { x: 0, y: 0, w: 50, h: 50 };

// --- INICIALIZACIÓN ---
function initGameElements() {
    const totalW = window.innerWidth;
    const totalH = window.innerHeight;
    const vw = totalW / 2; 
    const vh = totalH;

    // Mundo Panorámico 360 (Muy ancho para dar la vuelta completa)
    worldW = vw * 8; 
    worldH = vh * 2.5; 

    canvasElement.width = totalW;
    canvasElement.height = totalH;

    planets = [];
    zones = [];
    isGameWon = false;

    const sideMargin = vw * 0.2;

    // 1. BARRA DE INVENTARIO (Cielo virtual)
    invBox = {
        x: sideMargin,
        y: worldH * 0.40, // Bajado para que no se "aplasten" contra el borde superior
        w: worldW - (sideMargin * 2),
        h: 220 
    };

    // 2. SISTEMA SOLAR (Abajo - Horizonte)
    sysBox = {
        x: sideMargin,
        y: worldH * 0.58, // Un poco debajo del centro
        w: worldW - (sideMargin * 2),
        h: worldH * 0.3
    };

    // Distribución en ARCO ENVOLVENTE (Abajo)
    const count = solarSystemData.length;
    const sysCenterX = sysBox.x + (sysBox.w / 2);
    const sysCenterY = sysBox.y + (sysBox.h / 0.8); // Punto focal abajo para curva
    
    const radiusX = sysBox.w * 0.45;
    const radiusY = sysBox.h * 1.2;

    solarSystemData.forEach((data, index) => {
        // Ángulo de distribución a lo largo de los 360° (o gran parte)
        const angleH = Math.PI * (0.1 + (index / (count - 1)) * 0.8);
        
        let distinctX = sysCenterX - Math.cos(angleH) * radiusX;
        let distinctY = sysCenterY - Math.sin(angleH) * radiusY;

        let zoneObj = {
            id: data.id,
            name: data.name,
            baseColor: data.color,
            color: data.color.replace(")", ", 0.2)").replace("rgb", "rgba").replace("#", "#"),
            x: distinctX,
            y: distinctY,
            type: data.type,
            originalR: data.r
        };

        const sizeFactor = 1.7;
        if (data.type === "star") zoneObj.r = 140;
        else if (data.type === "belt") {
            zoneObj.w = 120;
            zoneObj.h = 280;
        } else if (data.type === "saturn") {
            zoneObj.r = 100;
        } else {
            zoneObj.r = (data.r + 5) * sizeFactor;
        }

        zones.push(zoneObj);
    });

    // 3. INVENTARIO (Arriba - Fila única panorámica)
    const shuffledData = [...solarSystemData].sort(() => Math.random() - 0.5);
    const invCount = shuffledData.length;
    const invCenterX = invBox.x + (invBox.w / 2);
    const invRadiusX = invBox.w * 0.45;

    shuffledData.forEach((data, i) => {
        const angleH = Math.PI * (0.1 + (i / (invCount - 1)) * 0.8);
        let posX = invCenterX - Math.cos(angleH) * invRadiusX;
        let posY = invBox.y + (invBox.h / 2);

        const invScale = 1.0; 
        let planetObj = {
            id: data.id, name: data.name, color: data.color,
            x: posX, y: posY, type: data.type,
            isDragging: false, isLocked: false,
            r: data.r * invScale,
            w: (data.w || 40) * invScale,
            h: (data.h || 80) * invScale,
            originalX: posX, originalY: posY
        };
        planets.push(planetObj);
    });
}

// --- LÓGICA DE DIBUJO ---
function drawScene(eye) {
    const totalW = canvasElement.width;
    const vh = canvasElement.height;
    const vw = totalW / 2;
    const offset = eye === 'right' ? vw : 0;
    
    // El desplazamiento del mundo depende de la rotación
    const currentWorldX = (worldW / 2) - (vw / 2) + cameraYaw;
    const currentWorldY = (worldH / 2) - (vh / 2) + cameraPitch;

    canvasCtx.save();
    // Clip para no dibujar en la otra mitad
    canvasCtx.beginPath();
    canvasCtx.rect(offset, 0, vw, vh);
    canvasCtx.clip();
    
    // Capa de Mundo (Mueve el sistema solar en X e Y)
    canvasCtx.save();
    canvasCtx.translate(offset - currentWorldX, -currentWorldY);

    // 1. Inventario Border
    canvasCtx.strokeStyle = "rgba(0, 255, 255, 0.1)";
    canvasCtx.strokeRect(invBox.x, invBox.y, invBox.w, invBox.h);

    // 2. Zonas (Semicírculo Envolvente)
    zones.forEach(zone => {
        canvasCtx.save();
        canvasCtx.strokeStyle = zone.baseColor;
        canvasCtx.lineWidth = 2; // Más gruesa para visibilidad
        canvasCtx.setLineDash([5, 5]);
        const img = planetImages[zone.id];
        if (img && img.complete) {
            canvasCtx.globalAlpha = 0.25;
            if (zone.type === "belt") {
                canvasCtx.drawImage(img, zone.x - zone.w / 2, zone.y - zone.h / 2, zone.w, zone.h);
            } else if (zone.type === "saturn") {
                let satW = zone.r * 4.5; let satH = zone.r * 2.5; // Tamaño original de Saturno
                canvasCtx.drawImage(img, zone.x - satW / 2, zone.y - satH / 2, satW, satH);
            } else {
                canvasCtx.drawImage(img, zone.x - zone.r, zone.y - zone.r, zone.r * 2, zone.r * 2);
            }
        }
        
        // Nombres de zonas más grandes en VR
        canvasCtx.globalAlpha = 1.0;
        canvasCtx.fillStyle = "white";
        canvasCtx.font = "bold 15px Arial";
        canvasCtx.textAlign = "center";
        canvasCtx.fillText(zone.name, zone.x, zone.y + zone.r + 30);
        
        canvasCtx.restore();
    });

    // 3. Planetas
    planets.forEach(p => {
        canvasCtx.save();
        const img = planetImages[p.id];
        if (img && img.complete) {
            if (p.type === "belt") {
                canvasCtx.drawImage(img, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
            } else if (p.type === "saturn") {
                let satW = p.r * 4.5; let satH = p.r * 2.5;
                canvasCtx.drawImage(img, p.x - satW / 2, p.y - satH / 2, satW, satH);
            } else {
                canvasCtx.drawImage(img, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
            }
        }
        canvasCtx.restore();
    });
    canvasCtx.restore();

    // Capa HUD (Fija en la pantalla del ojo)
    canvasCtx.save();
    canvasCtx.translate(offset, 0);

    // Retícula de mirada (Gaze Reticle) - Siempre en el centro de la pantalla
    canvasCtx.beginPath();
    canvasCtx.arc(vw / 2, vh / 2, 5, 0, Math.PI * 2);
    canvasCtx.strokeStyle = "white";
    canvasCtx.lineWidth = 2;
    canvasCtx.stroke();
    
    canvasCtx.beginPath();
    canvasCtx.arc(vw / 2, vh / 2, 15, 0, Math.PI * 2);
    canvasCtx.strokeStyle = gazeTarget || selectedPlanet ? "#00ff00" : "rgba(255,255,255,0.3)";
    canvasCtx.stroke();

    // Botones fijos
    canvasCtx.fillStyle = "rgba(255, 68, 68, 0.7)";
    canvasCtx.beginPath(); canvasCtx.arc(20 + 25, 20 + 25, 20, 0, Math.PI * 2); canvasCtx.fill();
    
    canvasCtx.fillStyle = "rgba(68, 68, 255, 0.7)";
    canvasCtx.beginPath(); canvasCtx.arc(vw - 50 - 25, 20 + 25, 20, 0, Math.PI * 2); canvasCtx.fill();

    canvasCtx.fillStyle = "rgba(255, 165, 0, 0.7)";
    const fsY = !!document.fullscreenElement ? vh - 60 : vh - 100;
    canvasCtx.beginPath(); canvasCtx.arc(vw - 50 - 25, fsY + 25, 20, 0, Math.PI * 2); canvasCtx.fill();

    // Feedback Mano
    if (HAND_DETECTED) {
        canvasCtx.fillStyle = IS_PINCHING ? "#00ff00" : "white";
        canvasCtx.font = "bold 12px Arial";
        canvasCtx.fillText(IS_PINCHING ? "✊ AGARRANDO" : "✋ MANO", 20, vh - 20);
    }
    
    // Línea de separación (Vertical suave)
    canvasCtx.strokeStyle = "rgba(255,255,255,0.1)";
    canvasCtx.lineWidth = 1;
    canvasCtx.beginPath();
    canvasCtx.moveTo(0, 0); canvasCtx.lineTo(0, vh);
    canvasCtx.stroke();

    canvasCtx.restore();
    canvasCtx.restore();
}

function loop() {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    drawScene('left');
    drawScene('right');
    
    requestAnimationFrame(loop);
}

// --- LÓGICA DE MANOS (MediaPipe) ---
let HAND_DETECTED = false;

function onResults(results) {
    const vw = canvasElement.width / 2;
    const vh = canvasElement.height;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        HAND_DETECTED = true;
        const landmarks = results.multiHandLandmarks[0];
        
        const tipX = landmarks[8].x;
        const tipY = landmarks[8].y;
        const thumbX = landmarks[4].x;
        const thumbY = landmarks[4].y;

        // Detección de pinza
        const dist = Math.sqrt(Math.pow(tipX - thumbX, 2) + Math.pow(tipY - thumbY, 2));
        const wasPinching = IS_PINCHING;
        IS_PINCHING = dist < 0.08; // Umbral un poco más permisivo para VR

        updateGameLogic(IS_PINCHING, wasPinching);
        
        statusText.style.opacity = "0"; 
    } else {
        HAND_DETECTED = false;
        if (selectedPlanet) {
            selectedPlanet.isDragging = false;
            checkDrop(selectedPlanet);
            selectedPlanet = null;
        }
    }
}

function updateGameLogic(pinching, wasPinching) {
    if (isGameWon) return;

    const totalW = canvasElement.width;
    const vh = canvasElement.height;
    const vw = totalW / 2;
    
    // Coordenadas fijas del centro de la pantalla
    const screenCenterX = vw / 2;
    const screenCenterY = vh / 2;

    // Traducir el centro de la pantalla a coordenadas del MUNDO panorámico
    const currentWorldXOffset = (worldW / 2) - (vw / 2) + cameraYaw;
    const currentWorldYOffset = (worldH / 2) - (vh / 2) + cameraPitch;
    const centerX = screenCenterX + currentWorldXOffset;
    const centerY = screenCenterY + currentWorldYOffset;

    // 1. Detectar qué hay bajo la retícula (Gaze Target en el mundo)
    if (!selectedPlanet) {
        gazeTarget = null;
        for (let i = planets.length - 1; i >= 0; i--) {
            const p = planets[i];
            if (p.isLocked) continue;
            if (isInside(centerX, centerY, p)) {
                gazeTarget = p;
                break;
            }
        }
    }

    // 2. Lógica de Agarrar (Pinch)
    if (pinching) {
        if (!selectedPlanet && gazeTarget) {
            selectedPlanet = gazeTarget;
            selectedPlanet.isDragging = true;
        }

        if (selectedPlanet) {
            selectedPlanet.x = centerX;
            selectedPlanet.y = centerY;
        }
    } else {
        if (selectedPlanet) {
            selectedPlanet.isDragging = false;
            checkDrop(selectedPlanet);
            selectedPlanet = null;
        }
    }

    // Botones (Estos están en coordenadas de pantalla, no de mundo)
    if (pinching && !wasPinching) {
        const restartBtnX = vw - 50 - 25;
        const fsY = !!document.fullscreenElement ? vh - 60 : vh - 100;

        if (getDist(screenCenterX, screenCenterY, 20 + 25, 20 + 25) < 40) {
            window.location.href = 'index.html'; // Back
        }
        if (getDist(screenCenterX, screenCenterY, restartBtnX + 25, 20 + 25) < 40) {
            initGameElements(); // Restart
        }
        if (getDist(screenCenterX, screenCenterY, restartBtnX + 25, fsY + 25) < 40) {
            toggleFullscreen(); // FS
        }
    }
}

function isInside(x, y, obj) {
    const d = getDist(x, y, obj.x, obj.y);
    return d < (obj.r || 20) * 2.5; 
}

function getDist(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function checkDrop(planet) {
    let landedZone = zones.find(z => z.id === planet.id);
    if (landedZone) {
        const d = getDist(planet.x, planet.y, landedZone.x, landedZone.y);
        if (d < 100) { // Umbral VR más amplio por el tamaño
            planet.x = landedZone.x;
            planet.y = landedZone.y;
            planet.isLocked = true;
            // El planeta se queda con el tamaño grande de la zona
            planet.r = landedZone.r;
            if (planets.every(p => p.isLocked)) {
                isGameWon = true; // Simple win en VR por ahora
            }
            return;
        }
    }
    planet.x = planet.originalX;
    planet.y = planet.originalY;
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen();
    }
}

// Soporte táctil para el botón de pantalla completa en VR
canvasElement.addEventListener('touchstart', (e) => {
    const rect = canvasElement.getBoundingClientRect();
    const touch = e.touches[0];
    const tx = (touch.clientX - rect.left) * (canvasElement.width / rect.width);
    const ty = (touch.clientY - rect.top) * (canvasElement.height / rect.height);
    
    // El toque puede ser en cualquiera de las dos pantallas (izquierda o derecha)
    const vw = canvasElement.width / 2;
    const clickX = tx > vw ? tx - vw : tx; // Normalizar a coordenadas de un solo ojo
    
    if (getDist(clickX, ty, fsBtn.x + 25, fsBtn.y + 25) < 40) {
        toggleFullscreen();
    }
    if (getDist(clickX, ty, restartBtn.x + 25, restartBtn.y + 25) < 40) {
        initGameElements();
    }
    if (getDist(clickX, ty, backBtn.x + 25, backBtn.y + 25) < 40) {
        window.location.href = 'index.html';
    }
}, { passive: false });

// --- INICIO DE PROCESOS ---
async function startApp() {
    log("Iniciando aplicación...");
    initGameElements();
    loop();

    // 1. Iniciar Cámara primero (es lo más rápido y da feedback visual)
    await startCamera();

    // 2. Iniciar IA (después de que la cámara ruede)
    try {
        log("Cargando IA de manos...");
        const hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        hands.onResults(onResults);

        // Vincular el procesamiento del video con la IA
        window.processIA = async (video) => {
            await hands.send({ image: video });
        };
        log("IA Lista. Apunta y usa gestos.");
        setTimeout(() => { if(statusText) statusText.style.opacity = "0"; }, 4000);

    } catch (e) {
        log("Error IA: Usa toque manual");
        console.error(e);
    }
}

// Reemplazar el loop anterior y el startCamera suelto
async function startCamera() {
    try {
        log("Accediendo a cámara trasera...");
        const constraints = {
            video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 640 }, // Menor resolución para mayor fluidez en móvil
                height: { ideal: 480 }
            }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = stream;
        
        await new Promise((resolve) => {
            videoElement.onloadedmetadata = () => resolve();
        });

        await videoElement.play();
        log("Cámara activa. Cargando IA...");

        async function processLoop() {
            if (!videoElement.paused && !videoElement.ended) {
                if (window.processIA) {
                    try {
                        await window.processIA(videoElement);
                    } catch (e) {}
                }
            }
            requestAnimationFrame(processLoop);
        }
        processLoop();

    } catch (err) {
        log("Cámara no disponible. Usa el visor.");
        console.error("Camera Error:", err);
    }
}

// Ejecutar todo
startApp();
