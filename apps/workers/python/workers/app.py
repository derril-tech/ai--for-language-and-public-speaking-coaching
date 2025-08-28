from fastapi import FastAPI
import uvicorn

app = FastAPI(title="Workers API")

@app.get("/")
def health():
    return {"ok": True, "name": "workers", "version": "0.1.0"}


def run():
    uvicorn.run("workers.app:app", host="0.0.0.0", port=8000, reload=True)


