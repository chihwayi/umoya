#!/usr/bin/env python3
"""
Simple script to create Android app icons with medical cross
Requires: PIL (Pillow) - pip install Pillow
"""

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("❌ PIL (Pillow) not installed. Install with: pip install Pillow")
    exit(1)

import os

# Icon sizes for Android
SIZES = {
    'mdpi': 48,
    'hdpi': 72,
    'xhdpi': 96,
    'xxhdpi': 144,
    'xxxhdpi': 192,
}

def create_medical_cross_icon(size):
    """Create a medical cross icon"""
    # Create image with blue background
    img = Image.new('RGB', (size, size), color='#3B82F6')
    draw = ImageDraw.Draw(img)
    
    # Calculate cross dimensions
    center = size // 2
    bar_width = size // 6
    bar_length = size // 2
    
    # Draw vertical bar
    v_x1 = center - bar_width // 2
    v_x2 = center + bar_width // 2
    v_y1 = center - bar_length // 2
    v_y2 = center + bar_length // 2
    draw.rectangle([v_x1, v_y1, v_x2, v_y2], fill='white')
    
    # Draw horizontal bar
    h_x1 = center - bar_length // 2
    h_x2 = center + bar_length // 2
    h_y1 = center - bar_width // 2
    h_y2 = center + bar_width // 2
    draw.rectangle([h_x1, h_y1, h_x2, h_y2], fill='white')
    
    return img

def main():
    print("🎨 Generating MediCore Android App Icons...")
    print("=" * 50)
    
    base_dir = "android/app/src/main/res"
    
    for density, size in SIZES.items():
        output_dir = f"{base_dir}/mipmap-{density}"
        os.makedirs(output_dir, exist_ok=True)
        
        print(f"  Creating {density} ({size}x{size})...")
        
        icon = create_medical_cross_icon(size)
        
        # Save square icon
        icon.save(f"{output_dir}/ic_launcher.png", "PNG")
        
        # Save round icon (same for now)
        icon.save(f"{output_dir}/ic_launcher_round.png", "PNG")
    
    print("\n✅ Icons generated successfully!")
    print(f"📍 Location: {base_dir}/mipmap-*/")
    print("\n🔨 Rebuild your app to see the new icon:")
    print("   npm run android")

if __name__ == "__main__":
    main()
