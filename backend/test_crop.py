import sys
from PIL import Image
from model.catalog_extractor import crop_box

img = Image.open("/Users/phonsirithabunsri/Desktop/Desktop/AutoParts-Retail-Management-Web-Application/backend/model/image copy 6.png").convert("RGB")
b64 = crop_box(img, [530, 175, 555, 720])
print(len(b64))
