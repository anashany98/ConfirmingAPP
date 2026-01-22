from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth_router, import_router, batch_router, settings_router, providers_router, logs_router, search_router, reports_router
from .database import engine, Base

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="ConfirmingAPP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://192.168.1.242:8095",
        "http://localhost:8095",
        "http://127.0.0.1:8095",
        "https://confirming.egeadev.cloud",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

app.include_router(auth_router.router)
app.include_router(import_router.router)
app.include_router(batch_router.router)
app.include_router(logs_router.router)
app.include_router(providers_router.router)
app.include_router(settings_router.router)
app.include_router(search_router.router)
app.include_router(reports_router.router)

@app.get("/")
def read_root():
    return {"message": "Confirming Bankinter API is running"}
