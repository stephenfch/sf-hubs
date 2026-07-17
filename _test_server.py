import sys
sys.path.insert(0, r"C:\Users\Win 11\Desktop\sf-hubs")
sys.path.insert(0, r"C:\Users\Win 11\Desktop\sf-hubs\scripts")
from album_server import app
from fastapi.testclient import TestClient
import os

client = TestClient(app)

# Test health
r = client.get("/api/health")
print(f"Health: {r.status_code} {r.json()}")

# Test trips
r = client.get("/api/trips")
print(f"Trips: {r.status_code} {len(r.json())} trips")

# Test photo serving
r = client.get("/api/photo/osaka-2026/IMG_0001.jpg")
print(f"Photo: {r.status_code}")

# Test upload route
r = client.post("/api/upload/test-trip", files={"file": ("test.jpg", b"fake-image-data", "image/jpeg")})
print(f"Upload: {r.status_code} {r.json()}")
