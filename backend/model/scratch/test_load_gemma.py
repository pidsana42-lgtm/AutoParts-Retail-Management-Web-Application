import os
import base64
import io
from huggingface_hub import hf_hub_download
from llama_cpp import Llama
from llama_cpp.llama_chat_format import Llava15ChatHandler

print("Step 1: Downloading GGUF files from HF Hub...")
try:
    model_path = hf_hub_download(repo_id="Phonsiri/Gemma-4-E4B-it-PARL-GGUF", filename="Gemma-4-E4B-it-PARL-Q4_K_M.gguf")
    clip_path = hf_hub_download(repo_id="Phonsiri/Gemma-4-E4B-it-PARL-GGUF", filename="Gemma-4-E4B-it-PARL-mmproj.gguf")
    print("Download completed!")
    print("Model path:", model_path)
    print("Clip path:", clip_path)
except Exception as e:
    print("Download failed:", e)
    exit(1)

print("Step 2: Initializing Llava15ChatHandler and Llama...")
try:
    chat_handler = Llava15ChatHandler(clip_model_path=clip_path)
    llm = Llama(
        model_path=model_path,
        chat_handler=chat_handler,
        n_ctx=2048,
        n_gpu_layers=-1
    )
    print("Llama model initialized successfully!")
except Exception as e:
    print("Initialization failed:", e)
