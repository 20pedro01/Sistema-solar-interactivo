from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
import os

app = FastAPI()

# Servir archivos estáticos (JS, CSS, Imágenes)
# Servir archivos estáticos (JS, CSS, Imágenes)
app.mount("/static", StaticFiles(directory="."), name="static")
app.mount("/Assets", StaticFiles(directory="Assets"), name="assets")

@app.get("/")
async def read_index():
    return FileResponse('index.html')

@app.get("/game_logic.js")
async def read_js():
    return FileResponse('game_logic.js')

if __name__ == "__main__":
    # Ejecutar servidor en localhost:8000
    print("Iniciando servidor educativo en http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
