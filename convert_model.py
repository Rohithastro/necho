"""
Run this ONCE on your local Mac to convert keras_model.h5 → model.tflite
Usage: python convert_model.py
"""
import os
import tensorflow as tf

# ── Update INPUT_MODEL to the full path of your keras_model.h5 ───────────────
INPUT_MODEL = "/Users/sree-zsbch1590/PycharmProjects/Necho/SLR PROJ/CODINGS/Model_old/keras_model.h5"

# Output goes into your Necho Website/Model/ folder
OUTPUT_DIR  = "/Users/sree-zsbch1590/Downloads/HTML/Necho Website/Model"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "model.tflite")

# ─────────────────────────────────────────────────────────────────────────────
os.makedirs(OUTPUT_DIR, exist_ok=True)   # create Model/ folder if missing

print("Loading keras_model.h5 ...")
model = tf.keras.models.load_model(INPUT_MODEL)
print(f"   Input shape: {model.input_shape}")

print("Converting to TFLite ...")
converter = tf.lite.TFLiteConverter.from_keras_model(model)
tflite_model = converter.convert()

with open(OUTPUT_FILE, "wb") as f:
    f.write(tflite_model)

print(f"\n✅ Saved to: {OUTPUT_FILE}")
print(f"   Size: {len(tflite_model) // 1024} KB")
print("\nNow upload Model/model.tflite to your HF Space.")
