# Varicose Disease Detector: Technical Knowledge Transfer

## 1. System Architecture Overview
The Varicose Disease Detector is a high-performance clinical diagnostic application.

*   **Framework**: Next.js 15 (App Router)
*   **UI/UX**: Tailwind CSS for styling, Framer Motion for state-driven animations.
*   **State Management**: React `useState` and `useRef` for real-time camera handling.
*   **AI Pipelines**: 
    *   **Gemini 1.5 Flash**: Primary diagnostic pipeline used for both Image Scanning and Live Stream Analysis.
    *   **Anatomical Mapping**: Custom logic for high-precision localization based on AI bounding boxes.

---

## 2. Core Workflows

### A. Clinical Diagnostic Scanner (Image Upload)
**Path**: `src/components/ScannerUpload.tsx` -> `src/lib/gemini.ts`

1.  **Selection**: User selects "Image" mode.
2.  **Upload & Preview**: The user uploads an image which is stored as a `File` object and displayed using `URL.createObjectURL`.
3.  **Analysis Trigger**: `runScan()` is called.
4.  **The AI Process**:
    *   The image is converted to a Base64 string.
    *   It is sent to the **Gemini 1.5 Flash** model with a "Surgical Grade" system instruction.
    *   **Output**: Gemini returns a structured JSON object containing detected veins, their 2D bounding boxes (normalized to 1000), a CEAP classification, and a detailed medical report.
5.  **Result Display**: The data is mapped to the `ResultCard` component.

### B. Live Clinical Stream (Camera Feed)
**Path**: `src/components/LiveScanner.tsx` -> `src/lib/roboflow.ts`

1.  **Hardware Connection**: User connects an ESP32-CAM via an IP URL.
2.  **Real-time Feed**: The camera stream is rendered directly in an `<img>` tag.
3.  **Frame Freeze**: When "Analyze" is clicked, the app "freezes" the feed by capturing the current frame into a hidden `<canvas>`.
4.  **The AI Process**:
    *   The canvas content is sent to **Gemini 1.5 Flash** (via `analyzeBase64WithGemini`).
    *   The model performs a full clinical assessment (Varicose/Spider/Reticular veins).
    *   **Structured Output**: Includes anatomical localization, CEAP class, and a detailed medical report.
5.  **Anatomy Overlay**: The `AnatomyOverlay.tsx` component calculates the relative position of the findings and draws glowing markers over the leg imagery in real-time on the frozen frame.

---

## 3. Deep Analysis: Each Section Explained

### Section 1: Anatomical Mapping (`lib/anatomy.ts`)
This is the "medical brain" of the UI. It takes raw X/Y coordinates from the AI and translates them into clinical terminology:
- **Vertical Zones**: Thigh, Knee, Calf, Ankle/Foot.
- **Horizontal Zones**: Medial (Inside), Lateral (Outside), Anterior (Front), Posterior (Back).
- **Result**: Instead of saying "Box at 0.5, 0.2", the app says **"Varicose vein detected in the Medial Proximal Thigh"**.

### Section 2: AI Multi-Modal Diagnosis (`lib/gemini.ts`)
Unlike standard object detection, Gemini provides a **Surgical-Grade Report**:
- **Scenario**: Hypothesizes the cause (e.g., "Venous hypertension resulting from valvular incompetence").
- **Medical Facts**: Provides educational context for the doctor.
- **Precision**: We use a `responseSchema` to force the AI to return valid JSON, preventing UI crashes.

### Section 3: Live Monitoring & Latency (`LiveScanner.tsx`)
- **System Logs**: Tracks connection speed and API response times.
- **Latency Tracker**: Measures the "Round Trip Time" (RTT) from clicking "Analyze" to receiving results, ensuring the system is fast enough for clinical use.

---

## 4. Dashboard & Results (`ResultCard.tsx`)
This is the final output screen. It aggregates data into several key areas:
1.  **Risk Level**: Derived from the density and size of detected veins.
2.  **CEAP Grade**: Automatically calculated based on the presence of specific markers (e.g., C2 for varicose, C4 for skin changes).
3.  **Findings Table**: An interactive list of every detection with confidence scores and anatomical locations.
4.  **Downloadable Report**: (Planned/Implemented) A summary that can be exported for patient records.

---

## 5. Fail-Safe Architecture (Hybrid AI)
The system employs a multi-tier analysis strategy to ensure 100% uptime in clinical environments:
1.  **Tier 1: Gemini 1.5 Flash (Primary)**: Provides high-reasoning multimodal analysis and comprehensive surgical reports.
2.  **Tier 2: Roboflow Edge (Fallback)**: Automatically engaged if Gemini is unreachable (API issues, token limits). It provides essential object detection and risk assessment.

**Workflow Logic**:
`Try Gemini` -> `On Error` -> `Log Issue` -> `Switch to Roboflow` -> `Mark Result as Fallback` -> `Update UI Dashboard`

---

## 6. Summary of Data Workflow
`Input` -> `Preprocessing (Base64)` -> `AI Inference (Primary/Fallback)` -> `Coordinate Translation` -> `Clinical Categorization` -> `UI Dashboard`
