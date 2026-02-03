
import os
import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel
import pydicom
import io
import numpy as np

class MedicalVisionService:
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model_name = "openai/clip-vit-base-patch32" # Using standard CLIP for speed/memory, can swap for microsoft/BiomedCLIP-PubMedBERT_256-vit_base_patch16_224
        
        self.mock_mode = os.getenv("MOCK_VISION_AI", "false").lower() == "true"
        if self.mock_mode:
            print("WARNING: Running Medical Vision Service in MOCK MODE")
            self.model = "MOCK"
            self.processor = None
            self.labels = [
                "normal chest x-ray",
                "pneumonia",
                "tuberculosis",
                "pleural effusion",
                "pneumothorax",
                "fracture"
            ]
            return

        print(f"Loading Vision Model: {self.model_name} on {self.device}...")
        try:
            self.model = CLIPModel.from_pretrained(self.model_name).to(self.device)
            self.processor = CLIPProcessor.from_pretrained(self.model_name)
            self.labels = [
                "normal chest x-ray",
                "pneumonia",
                "tuberculosis",
                "pleural effusion",
                "pneumothorax",
                "fracture"
            ]
            print("Vision Model loaded successfully.")
        except Exception as e:
            print(f"Failed to load Vision Model: {e}")
            self.model = None

    def process_dicom(self, file_bytes):
        """Convert DICOM bytes to PIL Image"""
        try:
            dicom = pydicom.dcmread(io.BytesIO(file_bytes))
            pixel_array = dicom.pixel_array
            # Normalize to 0-255
            pixel_array = pixel_array.astype(float)
            pixel_array = (np.maximum(pixel_array, 0) / pixel_array.max()) * 255.0
            pixel_array = np.uint8(pixel_array)
            return Image.fromarray(pixel_array).convert("RGB")
        except Exception as e:
            print(f"Error processing DICOM: {e}")
            return None

    def analyze_image(self, file_bytes, filename=""):
        if not self.model:
            return {"error": "Model not loaded"}

        if self.mock_mode:
            import random
            results = []
            for label in self.labels:
                results.append({"label": label, "score": random.random()})
            results.sort(key=lambda x: x["score"], reverse=True)
            # Normalize to sum to 1 roughly (optional but nice)
            total = sum(r["score"] for r in results)
            for r in results:
                r["score"] /= total
                
            return {
                "top_finding": results[0]["label"],
                "confidence": results[0]["score"],
                "all_findings": results,
                "note": "MOCK RESULT"
            }

        try:
            # Load Image
            if filename.lower().endswith('.dcm'):
                image = self.process_dicom(file_bytes)
            else:
                image = Image.open(io.BytesIO(file_bytes)).convert("RGB")
            
            if image is None:
                return {"error": "Failed to process image"}

            # Prepare inputs
            inputs = self.processor(
                text=self.labels, 
                images=image, 
                return_tensors="pt", 
                padding=True
            ).to(self.device)

            # Inference
            with torch.no_grad():
                outputs = self.model(**inputs)
                logits_per_image = outputs.logits_per_image
                probs = logits_per_image.softmax(dim=1)

            # Format results
            results = []
            for i, label in enumerate(self.labels):
                score = probs[0][i].item()
                results.append({"label": label, "score": score})

            # Sort by score
            results.sort(key=lambda x: x["score"], reverse=True)

            return {
                "top_finding": results[0]["label"],
                "confidence": results[0]["score"],
                "all_findings": results
            }

        except Exception as e:
            print(f"Error during analysis: {e}")
            return {"error": str(e)}
