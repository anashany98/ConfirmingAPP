from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import import_router, batch_router, settings_router, providers_router, logs_router
from .database import engine, Base

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="ConfirmingAPP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(import_router.router)
app.include_router(batch_router.router)
app.include_router(settings_router.router)
app.include_router(providers_router.router)
app.include_router(logs_router.router)

@app.get("/")
def read_root():
    return {"message": "Confirming Bankinter API is running"}
