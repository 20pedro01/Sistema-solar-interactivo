// --- CONFIGURACIÓN VR / AR ---
const videoElement = document.getElementById('input-video');
const canvasElement = document.getElementById('canvas-overlay');
const canvasCtx = canvasElement.getContext('2d');
const statusText = document.getElementById('status-text');

// Variables de Juego Globales (Copia de logic_drag)
let planets = [];
let zones = [];
let invBox = {}, sysBox = {};
let isGameWon = false;
let rocketX = 0, rocketY = 0, rocketAngle = 0;
let asteroidParticles = [];
let isFullscreen = false;

// Estado de manos
let IS_PINCHING = false;
let cursorX = 0, cursorY = 0;
let selectedPlanet = null;
let dragOffset = { x: 0, y: 0 };

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

    sysBox = {
        x: sideMargin,
        y: invBox.y + invBox.h + 5,
        w: vw - (sideMargin * 2),
        h: vh - (invBox.y + invBox.h + 60)
    };

    // Botones en posiciones virtuales
    backBtn.x = padding; backBtn.y = padding;
    restartBtn.x = vw - padding - 50; restartBtn.y = padding;
    fsBtn.x = vw - padding - 50; fsBtn.y = vh - padding - 60;

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

        const sizeFactor = 0.55; // Mucho más pequeño para que quepa en el campo visual del visor
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
    const vw = canvasElement.width / 2;
    const offset = eye === 'right' ? vw : 0;
    
    canvasCtx.save();
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

    // 5. Cursor / Indicador de mano
    if (HAND_DETECTED) {
        canvasCtx.beginPath();
        canvasCtx.arc(cursorX, cursorY, IS_PINCHING ? 8 : 12, 0, Math.PI * 2);
        canvasCtx.fillStyle = IS_PINCHING ? "#00ff00" : "rgba(255,255,255,0.5)";
        canvasCtx.fill();
        canvasCtx.strokeStyle = "white";
        canvasCtx.stroke();
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
        
        // MediaPipe X es invertido para cámara trasera? 
        // No, la cámara trasera no es reflejada, así que X=0 es izquierda.
        const tipX = landmarks[8].x;
        const tipY = landmarks[8].y;
        const thumbX = landmarks[4].x;
        const thumbY = landmarks[4].y;

        // Mapear a coordenadas virtuales (ojo izquierdo)
        cursorX = tipX * vw;
        cursorY = tipY * vh;

        // Detección de pinza
        const dist = Math.sqrt(Math.pow(tipX - thumbX, 2) + Math.pow(tipY - thumbY, 2));
        const wasPinching = IS_PINCHING;
        IS_PINCHING = dist < 0.06;

        updateGameLogic(cursorX, cursorY, IS_PINCHING, wasPinching);
        
        statusText.style.opacity = "0"; // Ocultar HUD una vez detectado
    } else {
        HAND_DETECTED = false;
        if (selectedPlanet) {
            selectedPlanet.isDragging = false;
            checkDrop(selectedPlanet);
            selectedPlanet = null;
        }
    }
}

function updateGameLogic(x, y, pinching, wasPinching) {
    if (isGameWon) return;

    // Gestos sobre botones (Pellizco corto)
    if (pinching && !wasPinching) {
        // Botón FS via gesto
        if (getDist(x, y, fsBtn.x + 25, fsBtn.y + 25) < 30) {
            toggleFullscreen();
            return;
        }
        // Botón Reiniciar
        if (getDist(x, y, restartBtn.x + 25, restartBtn.y + 25) < 30) {
            initGameElements();
            return;
        }
        // Botón Volver
        if (getDist(x, y, backBtn.x + 25, backBtn.y + 25) < 30) {
            window.location.href = 'index.html';
            return;
        }
    }

    if (pinching) {
        if (!selectedPlanet) {
            for (let i = planets.length - 1; i >= 0; i--) {
                const p = planets[i];
                if (p.isLocked) continue;
                if (isInside(x, y, p)) {
                    selectedPlanet = p;
                    selectedPlanet.isDragging = true;
                    dragOffset.x = x - p.x;
                    dragOffset.y = y - p.y;
                    break;
                }
            }
        } else {
            selectedPlanet.x = x - dragOffset.x;
            selectedPlanet.y = y - dragOffset.y;
        }
    } else {
        if (selectedPlanet) {
            selectedPlanet.isDragging = false;
            checkDrop(selectedPlanet);
            selectedPlanet = null;
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

// --- SET UP ---
window.addEventListener('resize', () => {
    initGameElements();
});

initGameElements();
loop();

// Iniciar MediaPipe y Cámara
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

// Cámara trasera con constraints ultra explícitos
async function startCamera() {
    try {
        const constraints = {
            video: {
                facingMode: { exact: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };

        // Si falla con 'exact', intentamos sin exactitud por si el navegador es restrictivo
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
            console.log("Reintentando sin 'exact' para facingMode...");
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" }
            });
        }

        videoElement.srcObject = stream;
        await videoElement.play();
        
        const camera = new Camera(videoElement, {
            onFrame: async () => {
                await hands.send({ image: videoElement });
            },
            width: 1280,
            height: 720
        });
        camera.start();
    } catch (err) {
        console.error("Error al acceder a la cámara:", err);
        statusText.innerText = "Error: Cámara trasera no accesible";
    }
}

startCamera();
