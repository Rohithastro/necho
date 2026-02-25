# Necho — Bridging Silence. Connecting Worlds.

Necho is an elite infrastructure for real-time sign language translation. Built with advanced neural cores, it dissolves communication barriers by translating sign language into text and voice in real-time.

## 🚀 Features

- **Real-time Interpretation**: High-speed gesture recognition using MediaPipe and TFLite.
- **Multi-modal Communication**: Supports Gesture, Voice, and Text input.
- **Modern Interface**: A "luxury minimalist" design with glassmorphism and smooth animations.
- **Accessibility First**: Built-in inclusive settings (grayscale, high contrast, reduced motion).
- **Regional Fluency**: Designed to support multiple dialects (ASL, BSL, and regional Indian sign languages).
- **Secure Authentication**: Integrated with Firebase for secure user management.

## 🛠 Tech Stack

- **Frontend**: HTML5, Vanilla CSS3, JavaScript (ES6+)
- **Backend**: Python (Flask)
- **AI/ML**: MediaPipe (Hand Tracking), TFLite (Gesture Classification)
- **Services**: Firebase (Auth & Database), Hugging Face Spaces (Deployment)

## 📁 Project Structure

```text
├── Model/              # ML Model and labels
│   ├── model.tflite   # TFLite Gesture Recognition model
│   └── labels.txt      # Gesture labels
├── app.py              # Flask Backend API
├── index.html          # Landing Page
├── interpreter.html    # Main Interpretation interface
├── blog.html           # Research and insights blog
├── about.html          # About the project
├── signin.html         # User authentication
├── style.css           # Global design system
└── requirements.txt    # Python dependencies
```

## ⚙️ Installation

### Backend Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Rohithastro/necho.git
   cd necho
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the backend**:
   ```bash
   python app.py
   ```
   The backend will start at `http://localhost:7860`.

### Frontend Setup

1. Simply open `index.html` in a modern web browser.
2. Ensure the `BACKEND` or `API` URL in `interpreter.js` and `interpreter.html` is pointed to your local backend:
   ```javascript
   const API = 'http://localhost:7860';
   ```

## 🧠 Behind the Neural Core

Necho uses a dual-engine approach:
1. **MediaPipe Hand Engine**: Detects 21 hand landmarks in real-time.
2. **TFLite Classification Core**: A lightweight neural network that classifies hand poses into gestures with high confidence.

## 📄 License

© 2026 NECHO. ALL RIGHTS RESERVED.