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

// Sistema de LOG para depuración en pantalla
function log(msg) {
    console.log("VR-LOG:", msg);
    if (statusText) statusText.innerText = msg;
}

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
    // En VR, dividimos el ancho entre 2
    const totalW = window.innerWidth;
    const totalH = window.innerHeight;
    const vw = totalW / 2; // Ancho virtual (por ojo)
    const vh = totalH;

    canvasElement.width = totalW;
    canvasElement.height = totalH;

    // Resetear
    planets = [];
    zones = [];
    asteroidParticles = [];
    isGameWon = false;

    // Ajustar Caja Inventario y Sistema al ancho virtual
    const padding = 15;
    const sideMargin = vw * 0.05;

    invBox = {
        x: sideMargin,
        y: padding + 20, // Más abajo para el texto
        w: vw - (sideMargin * 2),
        h: Math.min(vh * 0.20, 100)
    };

    const inFS = !!document.fullscreenElement;
    sysBox = {
        x: sideMargin,
        y: invBox.y + invBox.h + 5,
        w: vw - (sideMargin * 2),
        h: vh - (invBox.y + invBox.h + (inFS ? 40 : 80)) // Más margen si no está en FS
    };

    // Botones en posiciones virtuales
    backBtn.x = padding; backBtn.y = padding;
    restartBtn.x = vw - padding - 50; restartBtn.y = padding;
    // Subido de 60 a 90 (o más si no hay FS) para visibilidad
    fsBtn.x = vw - padding - 50; 
    fsBtn.y = inFS ? vh - padding - 50 : vh - padding - 95; 

    // Distribución horizontal (Escalada para VR)
    const positionsPct = [0.05, 0.14, 0.21, 0.28, 0.35, 0.46, 0.56, 0.76, 0.88, 0.98];
    const sysCenterY = sysBox.y + (sysBox.h / 2);

    solarSystemData.forEach((data, index) => {
        let distinctX = sysBox.x + (sysBox.w * positionsPct[index]);
        let distinctY = sysCenterY;

        if (data.type !== "belt") {
            const zigzagAmt = sysBox.h * 0.18;
            distinctY = (index % 2 !== 0) ? sysCenterY + zigzagAmt : sysCenterY - zigzagAmt;
        }

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

        const sizeFactor = 0.45; // Reducido de 0.55 a 0.45 para compactar
        if (data.type === "star") zoneObj.r = Math.min(70 * sizeFactor, sysBox.h * 0.4);
        else if (data.type === "belt") {
            zoneObj.w = Math.min(60 * sizeFactor, sysBox.w * 0.05);
            zoneObj.h = sysBox.h * 0.85;
        } else if (data.type === "saturn") {
            zoneObj.r = Math.min(45 * sizeFactor, sysBox.h * 0.18);
            zoneObj.ringR = zoneObj.r * 2.2;
        } else {
            zoneObj.r = Math.min((data.r + 5) * sizeFactor, sysBox.h * 0.18);
        }

        zones.push(zoneObj);
    });

    // Inventario
    let shuffledData = [...solarSystemData].sort(() => Math.random() - 0.5);
    shuffledData.forEach((data, i) => {
        const cols = 10;
        const colW = invBox.w / cols;
        const rowH = invBox.h;
        const col = i % cols;

        let posX = invBox.x + (col * colW) + (colW / 2);
        let posY = invBox.y + (rowH / 2);

        const invScale = 0.4; // Iconos pequeños para VR
        let planetObj = {
            id: data.id, name: data.name, color: data.color,
            x: posX, y: posY, type: data.type,
            isDragging: false, isLocked: false,
            targetR: data.r * 0.6,
            r: data.r * invScale,
            w: (data.w || 40) * (data.id === "saturno" ? invScale * 1.5 : invScale),
            h: (data.h || 80) * invScale,
            originalX: posX, originalY: posY
        };
        if (planetObj.id === "saturno") planetObj.r *= 0.75;
        planets.push(planetObj);
    });
}

// --- LÓGICA DE DIBUJO ---
function drawScene(eye) {
    const totalW = canvasElement.width;
    const vh = canvasElement.height;
    const vw = totalW / 2;
    const offset = eye === 'right' ? vw : 0;
    
    canvasCtx.save();
    // Clip para no dibujar en la otra mitad
    canvasCtx.beginPath();
    canvasCtx.rect(offset, 0, vw, vh);
    canvasCtx.clip();
    
    canvasCtx.translate(offset, 0);

    // 1. Botones
    // Volver
    canvasCtx.fillStyle = "rgba(255, 68, 68, 0.7)";
    canvasCtx.beginPath(); canvasCtx.arc(backBtn.x + 25, backBtn.y + 25, 20, 0, Math.PI * 2); canvasCtx.fill();
    
    // Reiniciar
    canvasCtx.fillStyle = "rgba(68, 68, 255, 0.7)";
    canvasCtx.beginPath(); canvasCtx.arc(restartBtn.x + 25, restartBtn.y + 25, 20, 0, Math.PI * 2); canvasCtx.fill();

    // Pantalla completa
    canvasCtx.fillStyle = "rgba(255, 165, 0, 0.7)";
    canvasCtx.beginPath(); canvasCtx.arc(fsBtn.x + 25, fsBtn.y + 25, 20, 0, Math.PI * 2); canvasCtx.fill();

    // 2. Inventario Border
    canvasCtx.strokeStyle = "rgba(0, 255, 255, 0.2)";
    canvasCtx.setLineDash([5, 5]);
    canvasCtx.strokeRect(invBox.x, invBox.y, invBox.w, invBox.h);
    canvasCtx.setLineDash([]);

    // 3. Zonas
    zones.forEach(zone => {
        canvasCtx.save();
        canvasCtx.strokeStyle = zone.baseColor;
        canvasCtx.lineWidth = 1;
        canvasCtx.setLineDash([3, 3]);
        
        const img = planetImages[zone.id];
        if (img && img.complete) {
            canvasCtx.globalAlpha = 0.2;
            if (zone.type === "belt") {
                canvasCtx.drawImage(img, zone.x - zone.w / 2, zone.y - zone.h / 2, zone.w, zone.h);
            } else if (zone.type === "saturn") {
                let satW = zone.r * 4.5; let satH = zone.r * 2.5;
                canvasCtx.drawImage(img, zone.x - satW / 2, zone.y - satH / 2, satW, satH);
            } else {
                canvasCtx.drawImage(img, zone.x - zone.r, zone.y - zone.r, zone.r * 2, zone.r * 2);
            }
        }
        canvasCtx.restore();
    });

    // 4. Planetas
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

    // 5. Retícula de mirada (Gaze Reticle)
    canvasCtx.beginPath();
    canvasCtx.arc(vw / 2, vh / 2, 5, 0, Math.PI * 2);
    canvasCtx.strokeStyle = "white";
    canvasCtx.lineWidth = 2;
    canvasCtx.stroke();
    
    // Círculo exterior que se ilumina si hay algo seleccionado
    canvasCtx.beginPath();
    canvasCtx.arc(vw / 2, vh / 2, 15, 0, Math.PI * 2);
    canvasCtx.strokeStyle = gazeTarget || selectedPlanet ? "#00ff00" : "rgba(255,255,255,0.3)";
    canvasCtx.lineWidth = 1;
    canvasCtx.stroke();

    // 6. Indicador de gesto detectado (en una esquina para feedback)
    if (HAND_DETECTED) {
        canvasCtx.fillStyle = IS_PINCHING ? "#00ff00" : "rgba(255,255,255,0.2)";
        canvasCtx.font = "bold 10px Arial";
        canvasCtx.textAlign = "left";
        canvasCtx.fillText(IS_PINCHING ? "MANO: AGARRANDO" : "MANO: DETECTADA", 10, vh - 20);
    }

    // Texto Instrucción (Reducido)
    canvasCtx.fillStyle = "white";
    canvasCtx.font = "bold 10px Arial";
    canvasCtx.textAlign = "center";
    canvasCtx.fillText("Arrastra los planetas a su posición", vw / 2, 35);

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

    const vw = canvasElement.width / 2;
    const vh = canvasElement.height;
    const centerX = vw / 2;
    const centerY = vh / 2;

    // 1. Detectar qué hay bajo la retícula (Gaze Target)
    if (!selectedPlanet) {
        gazeTarget = null;
        // Priorizar planetas no bloqueados
        for (let i = planets.length - 1; i >= 0; i--) {
            const p = planets[i];
            if (p.isLocked) continue;
            // Usamos un área de selección generosa para el centro de la mirada
            if (isInside(centerX, centerY, p)) {
                gazeTarget = p;
                break;
            }
        }
    }

    // 2. Lógica de Agarrar (Pinch)
    if (pinching) {
        if (!selectedPlanet && gazeTarget) {
            // Empezar a arrastrar lo que estamos mirando
            selectedPlanet = gazeTarget;
            selectedPlanet.isDragging = true;
        }

        if (selectedPlanet) {
            // El planeta se queda "pegado" al centro de nuestra mirada
            selectedPlanet.x = centerX;
            selectedPlanet.y = centerY;
        }
    } else {
        // Soltar
        if (selectedPlanet) {
            selectedPlanet.isDragging = false;
            checkDrop(selectedPlanet);
            selectedPlanet = null;
        }
    }

    // Gestos sobre botones (si la mirada está sobre ellos)
    if (pinching && !wasPinching) {
        if (getDist(centerX, centerY, fsBtn.x + 25, fsBtn.y + 25) < 40) {
            toggleFullscreen();
        }
        if (getDist(centerX, centerY, restartBtn.x + 25, restartBtn.y + 25) < 40) {
            initGameElements();
        }
        if (getDist(centerX, centerY, backBtn.x + 25, backBtn.y + 25) < 40) {
            window.location.href = 'index.html';
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
        if (d < 50) { // Umbral VR
            planet.x = landedZone.x;
            planet.y = landedZone.y;
            planet.isLocked = true;
            planet.r = landedZone.originalR * 0.6;
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
