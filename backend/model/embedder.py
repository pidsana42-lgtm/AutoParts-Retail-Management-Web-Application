import os
import sys
import json
import numpy as np
import traceback

# Fallback TF-IDF text matcher in case torch / transformers / onnxruntime loading fails
class TFIDFMatcher:
    def __init__(self):
        from sklearn.feature_extraction.text import TfidfVectorizer
        self.vectorizer = TfidfVectorizer(token_pattern=r'(?u)\b\w+\b')
        self.fitted = False
        self.product_data = []
        self.product_vectors = None
        print("TF-IDF Product Matcher Initialized as fallback.")

    def fit(self, products):
        if not products:
            return
        self.product_data = products
        corpus = [f"{p.get('product_name', '')} {p.get('product_code', '')}".strip() for p in products]
        try:
            self.product_vectors = self.vectorizer.fit_transform(corpus)
            self.fitted = True
            print(f"TF-IDF Matcher fitted successfully with {len(products)} products.")
        except Exception as e:
            print(f"Error fitting TF-IDF matcher: {e}")

    def find_best_match(self, query_text):
        if not self.fitted or not self.product_data:
            return None, 0.0
        
        try:
            query_vector = self.vectorizer.transform([query_text])
            from sklearn.metrics.pairwise import cosine_similarity
            similarities = cosine_similarity(query_vector, self.product_vectors)[0]
            best_idx = np.argmax(similarities)
            best_score = float(similarities[best_idx])
            return self.product_data[best_idx], best_score
        except Exception as e:
            print(f"Error during TF-IDF similarity search: {e}")
            return None, 0.0

class ProductMatcher:
    def __init__(self):
        self.model_id = "onnx-community/embeddinggemma-300m-ONNX"
        self.model = None
        self.tokenizer = None
        self.use_onnx = False
        self.product_data = []
        self.product_embeddings = None
        self.fallback_matcher = TFIDFMatcher()

        # Try to initialize ONNX model
        try:
            print(f"Attempting to load ONNX embedding model: {self.model_id}...")
            # Disable torch warnings
            import warnings
            warnings.filterwarnings("ignore")

            import torch
            from transformers import AutoTokenizer
            from optimum.onnxruntime import ORTModelForFeatureExtraction

            self.tokenizer = AutoTokenizer.from_pretrained(self.model_id)
            self.model = ORTModelForFeatureExtraction.from_pretrained(
                self.model_id, 
                provider="CPUExecutionProvider"
            )
            self.use_onnx = True
            print("ONNX Embedding model loaded successfully! CPU Acceleration enabled.")
        except Exception as e:
            print(f"Could not load ONNX model {self.model_id}: {e}")
            print("Falling back to local TF-IDF text similarity matcher.")

    def fit(self, products, corrections=[]):
        """
        Calculates embeddings for all active products and corrected mappings.
        """
        self.product_data = products
        self.corrections = corrections
        self.fallback_matcher.fit(products)

        # Build combined corpus of products + corrections
        self.combined_data = []
        corpus = []
        
        # 1. Base products
        for p in products:
            self.combined_data.append({
                "type": "product",
                "id": p.get("id"),
                "name": p.get("product_name", ""),
                "code": p.get("product_code", "")
            })
            corpus.append(f"{p.get('product_name', '')} {p.get('product_code', '')}".strip())
            
        # 2. User corrected mappings
        for c in corrections:
            self.combined_data.append({
                "type": "correction",
                "id": c.get("product_id"),
                "name": c.get("company_product_name", ""),
                "code": c.get("company_product_code", "")
            })
            corpus.append(f"{c.get('company_product_name', '')} {c.get('company_product_code', '')}".strip())

        if not corpus:
            return

        # Fit fallback matcher on combined corpus
        self.fallback_matcher.product_data = self.combined_data
        fallback_corpus = [f"{x.get('name', '')} {x.get('code', '')}".strip() for x in self.combined_data]
        try:
            self.fallback_matcher.product_vectors = self.fallback_matcher.vectorizer.fit_transform(fallback_corpus)
            self.fallback_matcher.fitted = True
            print(f"TF-IDF Matcher fitted successfully with {len(self.combined_data)} total mapping targets.")
        except Exception as e:
            print(f"Error fitting fallback matcher: {e}")

        if not self.use_onnx:
            return

        try:
            self.product_embeddings = self._get_embeddings_batch(corpus)
            print(f"Successfully generated Gemma ONNX embeddings for {len(products)} products and {len(corrections)} corrections.")
        except Exception as e:
            print(f"Failed to generate ONNX embeddings during fit: {e}")
            tb = traceback.format_exc()
            print(tb)

    def _get_embeddings_batch(self, texts):
        if not self.use_onnx or self.model is None or self.tokenizer is None:
            return None
        
        import torch
        # Tokenize
        encoded_input = self.tokenizer(texts, padding=True, truncation=True, max_length=128, return_tensors="pt")
        with torch.no_grad():
            model_output = self.model(**encoded_input)
        
        # Mean Pooling to get sentence embeddings
        token_embeddings = model_output[0]
        # Check type of token_embeddings (if it's numpy array or torch tensor)
        if hasattr(token_embeddings, "numpy"):
            token_embeddings = torch.from_numpy(token_embeddings)
        
        attention_mask = encoded_input['attention_mask']
        if hasattr(attention_mask, "numpy"):
            attention_mask = torch.from_numpy(attention_mask)

        input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
        sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
        sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)
        embeddings = sum_embeddings / sum_mask
        
        # Normalize L2
        embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)
        return embeddings.numpy()

    def match_product(self, company_product_name, company_product_code, threshold=0.90):
        """
        Finds the closest database product matching the scanned invoice item.
        Returns:
            matched_product_id (int or None), similarity_score (float)
        """
        # 1. Exact match on user-corrected mappings (highest priority, case-insensitive)
        comp_name_lower = company_product_name.strip().lower()
        comp_code_lower = company_product_code.strip().lower()
        
        for c in self.corrections:
            c_name = c.get("company_product_name", "").strip().lower()
            c_code = c.get("company_product_code", "").strip().lower()
            if c_name == comp_name_lower and c_code == comp_code_lower:
                print(f"[Direct Correction Match] Exact match found: '{company_product_name}' -> DB Product ID {c.get('product_id')}")
                return c.get("product_id"), 1.0

        query_text = f"{company_product_name} {company_product_code}".strip()
        if not query_text:
            return None, 0.0

        # Fallback to TF-IDF if ONNX is disabled or failed
        if not self.use_onnx or self.product_embeddings is None:
            match, score = self.fallback_matcher.find_best_match(query_text)
            if match:
                req_threshold = 0.80 if match.get("type") == "correction" else threshold
                if score >= req_threshold:
                    return match.get("id"), score
            return None, score

        try:
            # Get query embedding
            query_emb = self._get_embeddings_batch([query_text])
            if query_emb is None:
                match, score = self.fallback_matcher.find_best_match(query_text)
                if match:
                    req_threshold = 0.80 if match.get("type") == "correction" else threshold
                    if score >= req_threshold:
                        return match.get("id"), score
                return None, score

            # Calculate cosine similarities against combined targets
            similarities = np.dot(self.product_embeddings, query_emb[0])
            best_idx = np.argmax(similarities)
            best_score = float(similarities[best_idx])
            matched_item = self.combined_data[best_idx]

            print(f"[Embedding Match] Scanned: '{query_text}' matches {matched_item.get('type')}: '{matched_item.get('name')}' with score: {best_score:.4f}")
            req_threshold = 0.80 if matched_item.get("type") == "correction" else threshold
            if best_score >= req_threshold:
                return matched_item.get("id"), best_score
            else:
                print(f"[Embedding Match] Score {best_score:.4f} is below threshold {req_threshold}. Product unmatched.")
                return None, best_score
        except Exception as e:
            print(f"Error matching product via ONNX embeddings: {e}")
            # Try TF-IDF fallback
            match, score = self.fallback_matcher.find_best_match(query_text)
            if match:
                req_threshold = 0.80 if match.get("type") == "correction" else threshold
                if score >= req_threshold:
                    return match.get("id"), score
            return None, score
