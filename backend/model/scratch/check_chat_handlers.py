import llama_cpp.llama_chat_format as lcf
print("Attributes in llama_cpp.llama_chat_format:")
for attr in dir(lcf):
    if "Handler" in attr or "handler" in attr.lower():
        print("-", attr)
