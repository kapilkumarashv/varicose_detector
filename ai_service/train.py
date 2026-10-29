import os
import sys
from roboflow import Roboflow
from ultralytics import YOLO

def main():
    print("=== Step 1: Downloading Varicose Dataset from Roboflow ===")
    api_key = os.environ.get("ROBOFLOW_API_KEY", "pzB4selwhZCELzXullfu")
    rf = Roboflow(api_key=api_key)
    project = rf.workspace("project-lwkmy").project("detection-of-varicose-veins")
    version = project.version(4)
    dataset = version.download("yolov8")
    
    print(f"Dataset downloaded to: {dataset.location}")
    yaml_path = os.path.join(dataset.location, "data.yaml")
    
    print("=== Step 2: Training Custom YOLOv8 Model ===")
    model = YOLO("yolov8n.pt")
    
    # Train on dataset
    results = model.train(
        data=yaml_path,
        epochs=30,  # 30 epochs for fast and solid convergence
        imgsz=640,
        batch=8,
        name="varicose_custom_model",
        project="training_runs"
    )
    
    print("=== Step 3: Training Complete! ===")
    best_weights = os.path.join("training_runs", "varicose_custom_model", "weights", "best.pt")
    print(f"Trained model saved at: {best_weights}")

if __name__ == "__main__":
    main()
