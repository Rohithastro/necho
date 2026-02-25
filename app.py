"""
Necho Sign Language Recognition — Cloud Backend
================================================
Uses mediapipe (hand detection) + tflite-runtime (classification).
No full TensorFlow — runs fine on free-tier cloud with limited RAM.

Deploy to Hugging Face Spaces (Docker):
    Upload: app.py, Dockerfile, requirements.txt, Model/model.tflite, Model/labels.txt
"""

import base64
import math
import os
import threading
from datetime import datetime

import cv2
import numpy as np
from flask import Flask, Response, jsonify, request
from flask_cors import CORS

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

# ── Imports ───────────────────────────────────────────────────────────────────
try:
    import mediapipe as mp
    import tflite_runtime.interpreter as tflite
    DEPS_AVAILABLE = True
except ImportError as e:
    DEPS_AVAILABLE = False
    print(f"⚠  Missing dependency: {e}")

# ── Config ────────────────────────────────────────────────────────────────────
MODEL_PATH           = "Model/model.tflite"
LABELS_PATH          = "Model/labels.txt"
CONFIDENCE_THRESHOLD = 0.50
AUTO_SEND_THRESHOLD  = 0.85
IMG_SIZE             = 300
OFFSET               = 20
STABILITY_FRAMES     = 2

# ── Flask app ─────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)


# ─────────────────────────────────────────────────────────────────────────────
#  GestureRecognizer
# ─────────────────────────────────────────────────────────────────────────────
class GestureRecognizer:

    def __init__(self):
        if not DEPS_AVAILABLE:
            raise RuntimeError("mediapipe or tflite_runtime not installed.")

        print("🔧 Loading hand detector …")
        self._mp_hands = mp.solutions.hands
        self._hands    = self._mp_hands.Hands(
            static_image_mode=False,   # tracking mode — faster after first detection
            max_num_hands=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

        print("🔧 Loading TFLite model …")
        self._interp = tflite.Interpreter(model_path=MODEL_PATH)
        self._interp.allocate_tensors()
        self._in  = self._interp.get_input_details()
        self._out = self._interp.get_output_details()

        print("🔧 Reading labels …")
        with open(LABELS_PATH) as f:
            self.labels = [line.strip() for line in f]
        print(f"   Labels: {self.labels}")

        # ── detection state ──────────────────────────────────────────────────
        self.current_gesture    = None
        self.gesture_confidence = 0.0
        self.stable_gesture     = None
        self.stable_count       = 0
        self.last_auto_sent     = None

        # ── conversation ─────────────────────────────────────────────────────
        self.conversation      = []
        self.conversation_lock = threading.Lock()

        print("✅ GestureRecognizer ready.\n")

    # ── Preprocessing (same logic as original cvzone version) ─────────────────
    def _preprocess_hand(self, frame: np.ndarray, bbox: tuple) -> np.ndarray:
        x, y, w, h = bbox
        img_white  = np.ones((IMG_SIZE, IMG_SIZE, 3), np.uint8) * 255
        img_crop   = frame[
            max(0, y - OFFSET): y + h + OFFSET,
            max(0, x - OFFSET): x + w + OFFSET,
        ]
        if img_crop.size == 0:
            raise ValueError("Empty crop region.")

        aspect = h / w
        if aspect > 1:
            k     = IMG_SIZE / h
            w_cal = math.ceil(k * w)
            if w_cal > 0:
                resized = cv2.resize(img_crop, (w_cal, IMG_SIZE))
                gap     = math.ceil((IMG_SIZE - w_cal) / 2)
                img_white[:, gap: w_cal + gap] = resized
        else:
            k     = IMG_SIZE / w
            h_cal = math.ceil(k * h)
            if h_cal > 0:
                resized = cv2.resize(img_crop, (IMG_SIZE, h_cal))
                gap     = math.ceil((IMG_SIZE - h_cal) / 2)
                img_white[gap: h_cal + gap, :] = resized

        return img_white

    def _classify(self, img_white: np.ndarray):
        """Run TFLite inference. Matches cvzone's Teachable Machine normalization."""
        shape = self._in[0]["shape"]          # e.g. [1, 224, 224, 3]
        h_in, w_in = shape[1], shape[2]

        img = cv2.resize(img_white, (w_in, h_in)).astype(np.float32)
        img = (img / 127.0) - 1               # match cvzone ClassificationModule exactly
        img = np.expand_dims(img, axis=0)

        self._interp.set_tensor(self._in[0]["index"], img)
        self._interp.invoke()
        output = self._interp.get_tensor(self._out[0]["index"])[0]

        index      = int(np.argmax(output))
        confidence = float(output[index])
        return confidence, index

    def _hand_bbox(self, frame: np.ndarray, results) -> tuple:
        """Convert mediapipe landmarks to (x, y, w, h) bounding box."""
        h, w = frame.shape[:2]
        lms  = results.multi_hand_landmarks[0].landmark
        xs   = [lm.x * w for lm in lms]
        ys   = [lm.y * h for lm in lms]
        x1, y1 = max(0, int(min(xs))), max(0, int(min(ys)))
        x2, y2 = min(w, int(max(xs))), min(h, int(max(ys)))
        return (x1, y1, x2 - x1, y2 - y1)

    # ── Main predict method ───────────────────────────────────────────────────
    def predict(self, image_data: bytes) -> dict:
        nparr = np.frombuffer(image_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if frame is None:
            return {"hand_detected": False, "gesture": None, "confidence": 0.0}

        rgb     = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self._hands.process(rgb)

        if not results.multi_hand_landmarks:
            self.stable_count       = 0
            self.stable_gesture     = None
            self.current_gesture    = None
            self.gesture_confidence = 0.0
            self.last_auto_sent     = None
            return {"hand_detected": False, "gesture": None, "confidence": 0.0}

        try:
            bbox      = self._hand_bbox(frame, results)
            img_white = self._preprocess_hand(frame, bbox)
            confidence, index = self._classify(img_white)
            label = self.labels[index]

            # ── Stability filter (same as original) ──────────────────────────
            if label == self.stable_gesture:
                self.stable_count += 1
            else:
                self.stable_gesture = label
                self.stable_count   = 1
                self.last_auto_sent = None

            if self.stable_count >= STABILITY_FRAMES and confidence >= CONFIDENCE_THRESHOLD:
                self.current_gesture    = label
                self.gesture_confidence = confidence

                if confidence >= AUTO_SEND_THRESHOLD and self.last_auto_sent != label:
                    self._auto_send(label, confidence)
                    self.last_auto_sent = label

            return {
                "hand_detected": True,
                "gesture":       self.current_gesture,
                "confidence":    self.gesture_confidence,
            }

        except Exception as exc:
            print(f"⚠  Hand processing error: {exc}")
            return {"hand_detected": True, "gesture": None, "confidence": 0.0}

    # ── Conversation helpers ──────────────────────────────────────────────────
    def _timestamp(self) -> str:
        return datetime.now().strftime("%H:%M:%S")

    def _append(self, entry: dict):
        with self.conversation_lock:
            self.conversation.append(entry)

    def _auto_send(self, gesture: str, confidence: float):
        self._append({
            "type": "gesture", "content": gesture,
            "confidence": confidence, "timestamp": self._timestamp(),
            "auto_sent": True,
        })
        print(f"[AUTO-GESTURE] {gesture}  ({confidence * 100:.1f}%)")

    def add_gesture_manual(self) -> bool:
        if not self.current_gesture:
            return False
        self._append({
            "type": "gesture", "content": self.current_gesture,
            "confidence": self.gesture_confidence,
            "timestamp": self._timestamp(), "auto_sent": False,
        })
        return True

    def add_message(self, content: str, msg_type: str):
        self._append({
            "type": msg_type, "content": content,
            "timestamp": self._timestamp(), "auto_sent": False,
        })

    def get_conversation(self) -> list:
        with self.conversation_lock:
            return list(self.conversation)

    def clear_conversation(self):
        with self.conversation_lock:
            self.conversation.clear()


# ── Initialise ────────────────────────────────────────────────────────────────
try:
    recognizer = GestureRecognizer()
except Exception as e:
    recognizer = None
    print(f"⚠  GestureRecognizer not available: {e}")
    print("   Backend running in FRONTEND-ONLY mode (no ML inference).")

def _require_recognizer():
    if recognizer is None:
        from flask import jsonify
        return jsonify({"error": "ML backend not available (tflite_runtime not installed on this platform).", "mode": "frontend-only"}), 503
    return None


# ─────────────────────────────────────────────────────────────────────────────
#  Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/predict", methods=["POST"])
def predict():
    err = _require_recognizer()
    if err: return err
    image_data = None
    ct = request.content_type or ""
    if "application/json" in ct:
        data = request.get_json(silent=True) or {}
        b64  = data.get("image", "")
        if b64:
            if "," in b64:
                b64 = b64.split(",", 1)[1]
            try:
                image_data = base64.b64decode(b64)
            except Exception:
                return jsonify({"error": "Invalid base64 image"}), 400
    else:
        f = request.files.get("image")
        if f:
            image_data = f.read()

    if not image_data:
        return jsonify({"error": "No image provided"}), 400

    return jsonify(recognizer.predict(image_data))


@app.route("/status")
def status():
    if recognizer is None:
        return jsonify({"hand_detected": False, "gesture": None, "confidence": 0.0, "mode": "frontend-only"})
    return jsonify({
        "hand_detected": recognizer.stable_count > 0,
        "gesture":       recognizer.current_gesture,
        "confidence":    recognizer.gesture_confidence,
    })


@app.route("/add_gesture", methods=["POST"])
def add_gesture():
    err = _require_recognizer()
    if err: return err
    if recognizer.add_gesture_manual():
        return jsonify({"success": True, "message": "Gesture added."})
    return jsonify({"success": False, "message": "No gesture currently detected."})


@app.route("/send_message", methods=["POST"])
def send_message():
    data     = request.get_json(silent=True) or {}
    content  = (data.get("message") or "").strip()
    msg_type = data.get("type", "text")
    if not content:
        return jsonify({"success": False, "message": "Empty message."}), 400
    if msg_type not in ("voice", "text"):
        msg_type = "text"
    recognizer.add_message(content, msg_type)
    return jsonify({"success": True})


@app.route("/get_conversation")
def get_conversation():
    if recognizer is None:
        return jsonify([])
    return jsonify(recognizer.get_conversation())


@app.route("/clear_conversation", methods=["POST"])
def clear_conversation():
    if recognizer is None:
        return jsonify({"success": True})
    recognizer.clear_conversation()
    return jsonify({"success": True})


@app.route("/export")
def export():
    lines = ["=" * 52, "  NECHO CONVERSATION EXPORT",
             f"  {datetime.now().strftime('%Y-%m-%d  %H:%M:%S')}", "=" * 52, ""]
    for entry in recognizer.get_conversation():
        ts, body = entry.get("timestamp", ""), entry.get("content", "")
        if entry["type"] == "gesture":
            auto = "[AUTO] " if entry.get("auto_sent") else ""
            conf = entry.get("confidence", 0) * 100
            lines += [f"[{ts}] [GESTURE] {auto}{body}",
                      f"            Confidence: {conf:.1f}%", ""]
        else:
            lines += [f"[{ts}] [{entry['type'].upper()}] {body}", ""]
    filename = f"necho_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    return Response("\n".join(lines), mimetype="text/plain",
                    headers={"Content-Disposition": f"attachment; filename={filename}"})


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    print(f"\n{'='*52}\n  Necho Backend  —  http://localhost:{port}\n{'='*52}\n")
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)
