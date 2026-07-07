from huggingface_hub import hf_hub_download
import os
try:
    path = hf_hub_download(repo_id="Phonsiri/Gemma-4-E4B-it-PARL-GGUF", filename="README.md")
    with open(path, "r") as f:
        print(f.read()[:1500]) # print first 1500 chars of README
except Exception as e:
    print("Error:", e)
