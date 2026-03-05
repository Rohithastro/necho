"""
Necho Sign Language Recognition — Local Backend
================================================
Uses your webcam + mediapipe (hand detection) + tensorflow.keras (model.h5).
Streams annotated MJPEG video to the browser and exposes all REST endpoints
that interpreter.html needs.

Usage:
    python local_backend.py

Then open interpreter.html  (backend lives at http://localhost:5000)

Requirements:
    pip install flask flask-cors opencv-python mediapipe tensorflow pandas numpy
"""

import copy
import itertools
import os
import string
import threading
import time
from collections import Counter, deque
from datetime import datetime

import cv2
import mediapipe as mp
import numpy as np
import pandas as pd
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from tensorflow import keras

# ── Model ─────────────────────────────────────────────────────────────────────
print("🔧 Loading model.h5 …")
model = keras.models.load_model("model.h5")

# ── Alphabet — derived from keypoint.csv, sorted exactly as sklearn LabelEncoder
# This must match the label ordering used during training.
_CSV_PATH = "keypoint.csv"
if os.path.exists(_CSV_PATH):
    import csv as _csv
    _labels = set()
    with open(_CSV_PATH, newline="") as _f:
        for _row in _csv.reader(_f):
            if _row:
                _labels.add(str(_row[0]))
    alphabet = sorted(_labels)   # LabelEncoder sorts alphabetically
    print(f"   Labels loaded from keypoint.csv ({len(alphabet)} classes): {alphabet}")
else:
    # Fallback: digits 1-9 then A-Z (matches a full 35-class training set)
    alphabet  = ['1','2','3','4','5','6','7','8','9']
    alphabet += list(string.ascii_uppercase)
    print("   keypoint.csv not found — using default 35-class alphabet")

# ── MediaPipe ─────────────────────────────────────────────────────────────────
mp_drawing        = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles
mp_hands          = mp.solutions.hands

# ── Config ────────────────────────────────────────────────────────────────────
CONFIDENCE_THRESHOLD = 0.75   # min confidence to display/store a gesture
AUTO_SEND_THRESHOLD  = 0.90   # auto-add to chat at this confidence
STABILITY_FRAMES     = 5      # minimum window frames before accepting a gesture
WINDOW_SIZE          = 15     # sliding-window size for majority-vote stability
MAJORITY_RATIO       = 0.60   # fraction of window that must agree on a gesture

# ── Flask ─────────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

# ── Shared state ──────────────────────────────────────────────────────────────
_state_lock        = threading.Lock()
_current_frame     = None     # latest JPEG bytes for the MJPEG stream
_hand_detected     = False
_current_gesture   = None
_gesture_conf      = 0.0
_pred_window       = deque(maxlen=WINDOW_SIZE)   # sliding window of raw predictions
_last_auto_sent    = None
_camera_on         = True     # toggled via /camera_toggle

_conv_lock    = threading.Lock()
_conversation = []

# ── Landmark helpers (identical to your original script) ──────────────────────
def calc_landmark_list(image, landmarks):
    image_width, image_height = image.shape[1], image.shape[0]
    points = []
    for _, lm in enumerate(landmarks.landmark):
        lx = min(int(lm.x * image_width),  image_width  - 1)
        ly = min(int(lm.y * image_height), image_height - 1)
        points.append([lx, ly])
    return points


def pre_process_landmark(landmark_list):
    tmp = copy.deepcopy(landmark_list)
    base_x, base_y = tmp[0][0], tmp[0][1]
    for i, pt in enumerate(tmp):
        tmp[i][0] -= base_x
        tmp[i][1] -= base_y
    flat    = list(itertools.chain.from_iterable(tmp))
    max_val = max(map(abs, flat)) or 1
    return [v / max_val for v in flat]


# ── Timestamp ─────────────────────────────────────────────────────────────────
def _ts():
    return datetime.now().strftime("%H:%M:%S")


# ── Background camera thread ───────────────────────────────────────────────────
def _camera_thread():
    global _current_frame, _hand_detected, _current_gesture, _gesture_conf
    global _pred_window, _last_auto_sent

    cap = cv2.VideoCapture(0)

    with mp_hands.Hands(
        model_complexity=0,
        max_num_hands=1,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5,
    ) as hands:
        while True:
            # ── Camera enabled / disabled ──────────────────────────────────
            with _state_lock:
                cam_on = _camera_on
            if not cam_on:
                time.sleep(0.1)
                continue

            success, image = cap.read()
            if not success:
                time.sleep(0.05)
                continue

            # Mirror (selfie view)
            image = cv2.flip(image, 1)
            debug_image = copy.deepcopy(image)

            image.flags.writeable = False
            rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = hands.process(rgb)
            image.flags.writeable = True

            gesture  = None
            conf     = 0.0
            detected = False

            if results.multi_hand_landmarks:
                detected = True
                for hand_lm, _ in zip(results.multi_hand_landmarks,
                                      results.multi_handedness):
                    # Draw skeleton
                    mp_drawing.draw_landmarks(
                        image, hand_lm, mp_hands.HAND_CONNECTIONS,
                        mp_drawing_styles.get_default_hand_landmarks_style(),
                        mp_drawing_styles.get_default_hand_connections_style(),
                    )

                    # Landmark → normalised feature vector
                    lm_list  = calc_landmark_list(debug_image, hand_lm)
                    features = pre_process_landmark(lm_list)
                    df       = pd.DataFrame(features).transpose()

                    preds     = model.predict(df, verbose=0)
                    pred_idx  = int(np.argmax(preds, axis=1)[0])
                    raw_conf  = float(preds[0][pred_idx])
                    label     = alphabet[pred_idx]

                    if raw_conf >= CONFIDENCE_THRESHOLD:
                        gesture = label
                        conf    = raw_conf
                        # Overlay text on frame
                        cv2.putText(
                            image,
                            f"{label}  {raw_conf*100:.0f}%",
                            (30, 60),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.8,
                            (0, 0, 255), 3,
                        )
                    break   # classify first hand only

            # ── Sliding-window majority-vote stability filter + auto-send ──
            with _state_lock:
                _hand_detected = detected

                if gesture:
                    _pred_window.append(gesture)
                else:
                    _pred_window.clear()
                    _current_gesture = None
                    _gesture_conf    = 0.0
                    _last_auto_sent  = None

                if len(_pred_window) >= STABILITY_FRAMES:
                    counts = Counter(_pred_window)
                    top_label, top_count = counts.most_common(1)[0]

                    if top_count / len(_pred_window) >= MAJORITY_RATIO:
                        # Switched to a new consensus gesture → allow auto-send again
                        if _current_gesture != top_label:
                            _last_auto_sent = None
                        _current_gesture = top_label
                        _gesture_conf    = conf

                        if conf >= AUTO_SEND_THRESHOLD and _last_auto_sent != top_label:
                            _last_auto_sent = top_label
                            entry = {
                                "type":       "gesture",
                                "content":    top_label,
                                "confidence": conf,
                                "timestamp":  _ts(),
                                "auto_sent":  True,
                            }
                            with _conv_lock:
                                _conversation.append(entry)
                            print(f"[AUTO] {top_label}  ({conf*100:.1f}%)")
                    else:
                        # No clear majority yet — hide the gesture
                        _current_gesture = None
                        _gesture_conf    = 0.0

            # ── Encode JPEG for MJPEG stream ───────────────────────────────
            ok, buf = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if ok:
                with _state_lock:
                    _current_frame = bytes(buf)

    cap.release()


# ── MJPEG generator ───────────────────────────────────────────────────────────
def _gen_mjpeg():
    while True:
        with _state_lock:
            frame = _current_frame
        if frame:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + frame
                + b"\r\n"
            )
        time.sleep(0.033)   # ~30 fps


# ─────────────────────────────────────────────────────────────────────────────
#  Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/video_feed")
def video_feed():
    return Response(
        _gen_mjpeg(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@app.route("/status")
def status():
    with _state_lock:
        return jsonify({
            "hand_detected": _hand_detected,
            "gesture":       _current_gesture,
            "confidence":    _gesture_conf,
        })


@app.route("/add_gesture", methods=["POST"])
def add_gesture():
    with _state_lock:
        g = _current_gesture
        c = _gesture_conf
    if not g:
        return jsonify({"success": False, "message": "No gesture currently detected."})
    with _conv_lock:
        _conversation.append({
            "type":       "gesture",
            "content":    g,
            "confidence": c,
            "timestamp":  _ts(),
            "auto_sent":  False,
        })
    return jsonify({"success": True, "message": f"Added '{g}'."})


@app.route("/send_message", methods=["POST"])
def send_message():
    data     = request.get_json(silent=True) or {}
    content  = (data.get("message") or "").strip()
    msg_type = data.get("type", "text")
    if not content:
        return jsonify({"success": False, "message": "Empty message."}), 400
    if msg_type not in ("voice", "text"):
        msg_type = "text"
    with _conv_lock:
        _conversation.append({
            "type":      msg_type,
            "content":   content,
            "timestamp": _ts(),
            "auto_sent": False,
        })
    return jsonify({"success": True})


@app.route("/get_conversation")
def get_conversation():
    with _conv_lock:
        return jsonify(list(_conversation))


@app.route("/clear_conversation", methods=["POST"])
def clear_conversation():
    with _conv_lock:
        _conversation.clear()
    return jsonify({"success": True})


@app.route("/export")
def export():
    lines = [
        "=" * 52,
        "  NECHO CONVERSATION EXPORT",
        f"  {datetime.now().strftime('%Y-%m-%d  %H:%M:%S')}",
        "=" * 52, "",
    ]
    with _conv_lock:
        entries = list(_conversation)
    for e in entries:
        ts, body = e.get("timestamp", ""), e.get("content", "")
        if e["type"] == "gesture":
            auto = "[AUTO] " if e.get("auto_sent") else ""
            conf = e.get("confidence", 0) * 100
            lines += [f"[{ts}] [GESTURE] {auto}{body}",
                      f"            Confidence: {conf:.1f}%", ""]
        else:
            lines += [f"[{ts}] [{e['type'].upper()}] {body}", ""]
    fname = f"necho_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    return Response(
        "\n".join(lines), mimetype="text/plain",
        headers={"Content-Disposition": f"attachment; filename={fname}"},
    )


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    t = threading.Thread(target=_camera_thread, daemon=True)
    t.start()
    print("\n" + "=" * 52)
    print("  Necho Local Backend  —  http://localhost:5000")
    print("  Open interpreter.html in your browser")
    print("=" * 52 + "\n")
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
