import requests
import io
from PIL import Image

import os

def create_dummy_image():
    # Create a 100x100 RGB image (red)
    img = Image.new('RGB', (100, 100), color = 'red')
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='JPEG')
    img_byte_arr.seek(0)
    return img_byte_arr

def test_analyze_image():
    base_url = os.getenv("CDSS_SERVICE_URL")
    if not base_url:
        print("Error: CDSS_SERVICE_URL environment variable not set")
        sys.exit(1)
    url = f"{base_url}/analyze-image"
    print(f"Testing {url}...")
    
    try:
        image_data = create_dummy_image()
        files = {'file': ('test.jpg', image_data, 'image/jpeg')}
        
        response = requests.post(url, files=files)
        
        if response.status_code == 200:
            print("✅ Success!")
            print("Response:", response.json())
        else:
            print(f"❌ Failed with status {response.status_code}")
            print("Response:", response.text)
            
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to server. Is it running on port 8000?")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_analyze_image()
