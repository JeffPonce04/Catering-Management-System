# Face recognition service

This service implements the HTTP contract used by Laravel `FaceRecognitionService`:

- `GET /health`
- `POST /verify` with `reference_image`, `captured_image`, and `threshold`

## Run locally

Use Python 3.10 or 3.11 in a dedicated virtual environment. DeepFace/TensorFlow may require platform-specific installation support.

```powershell
cd face-recognition-service
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 5001
```

The first verification downloads/initializes the Facenet512 model and can take time. Keep this service on localhost or a private network; do not expose it publicly without authentication, network restrictions, request limits, and TLS.

## Laravel configuration

Add to `backend/.env` after installing and validating the service:

```env
FACE_RECOGNITION_URL=http://127.0.0.1:5001
FACE_RECOGNITION_THRESHOLD=0.30
FACE_RECOGNITION_ENFORCED=false
```

Set `FACE_RECOGNITION_ENFORCED=true` only after:
1. the service `/health` check succeeds;
2. HR has enrolled each employee using the protected face-profile endpoint;
3. you have validated the threshold against representative consented images and lighting conditions;
4. a manual exception process is available for camera failure, disability, injury, or false rejection.

The backend is fail-closed when enforcement is enabled: missing face profile, missing capture, service outage, or failed match prevents the attendance punch.

## Important limitations

This implementation performs one-to-one face matching. It does **not** implement presentation-attack/liveness detection (for example, defending against a photo/video replay). Do not advertise it as liveness-secure or use it as the only control for payroll fraud prevention. Add a separately validated liveness/anti-spoofing component before treating the system as spoof-resistant.

Biometric images are stored on Laravel's private local storage disk. Treat the data as sensitive personal information: collect explicit consent, restrict enrollment to HR/admin, apply retention/deletion procedures, encrypt disks/backups, and limit access to biometric files.
