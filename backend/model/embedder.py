import os
import sys
import json
import hashlib
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
        import os
        self.model = None
        self.tokenizer = None
        self.use_onnx = False
        self.model_id = "none"
        self.product_data = []
        self.product_embeddings = None
        self.fallback_matcher = TFIDFMatcher()

        local_model_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "embeddinggemma-300m-ONNX"))

        # ถ้าตั้ง USE_TFIDF_ONLY=1 (เช่น VPS RAM น้อย) ให้ข้าม ONNX ไปเลย
        if os.environ.get("USE_TFIDF_ONLY", "0") == "1":
            print("USE_TFIDF_ONLY=1 detected — skipping ONNX model load, using TF-IDF only.")
            return

        # Try to initialize ONNX model
        try:
            # Disable torch warnings
            import warnings
            warnings.filterwarnings("ignore")

            import torch
            from transformers import AutoTokenizer
            from optimum.onnxruntime import ORTModelForFeatureExtraction

            # Check if model exists locally
            if os.path.exists(local_model_path):
                self.model_id = local_model_path
                print(f"ONNX model found locally at: {local_model_path}")
            else:
                self.model_id = "onnx-community/embeddinggemma-300m-ONNX"
                print(f"ONNX model not found locally in {local_model_path}. Downloading from Hugging Face Hub and saving locally...")
                
                # Download and save locally
                temp_tokenizer = AutoTokenizer.from_pretrained(self.model_id)
                temp_model = ORTModelForFeatureExtraction.from_pretrained(self.model_id, provider="CPUExecutionProvider")
                
                os.makedirs(local_model_path, exist_ok=True)
                temp_tokenizer.save_pretrained(local_model_path)
                temp_model.save_pretrained(local_model_path)
                
                self.model_id = local_model_path
                print(f"ONNX model saved successfully to: {local_model_path}")

            print(f"Attempting to load ONNX embedding model from: {self.model_id}...")
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_id)
            self.model = ORTModelForFeatureExtraction.from_pretrained(
                self.model_id, 
                provider="CPUExecutionProvider"
            )
            self.use_onnx = True
            print("ONNX Embedding model loaded successfully! CPU Acceleration enabled.")
        except Exception as e:
            print(f"Could not load ONNX model: {e}")
            print("Falling back to local TF-IDF text similarity matcher.")

    def _content_hash(self, text):
        """Hash of the embedded text + model id — changing the model invalidates the cache automatically."""
        raw = f"{self.model_id}|{text}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def _target_key(self, item):
        """Stable key per corpus item: products keyed by id, corrections by supplier+content."""
        if item.get("type") == "product":
            return f"product:{item.get('id')}"
        raw = f"{item.get('supplier_id')}|{item.get('name', '')}|{item.get('code', '')}"
        return "correction:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]

    def _load_cached_embeddings(self, persist_engine, keys):
        """Load {target_key: (content_hash, vector)} rows from DB for the current corpus."""
        stored = {}
        from sqlalchemy import text as sql_text
        chunk_size = 500
        with persist_engine.connect() as conn:
            for start in range(0, len(keys), chunk_size):
                chunk = keys[start:start + chunk_size]
                rows = conn.execute(
                    sql_text("SELECT target_key, content_hash, embedding FROM product_embeddings WHERE target_key = ANY(:keys)"),
                    {"keys": chunk}
                ).fetchall()
                for key, chash, emb in rows:
                    if emb is not None:
                        stored[key] = (chash, np.array(emb, dtype=np.float32))
        return stored

    def _save_embeddings(self, persist_engine, rows):
        """Upsert newly computed embeddings into the DB."""
        from sqlalchemy import text as sql_text
        upsert_sql = sql_text("""
            INSERT INTO product_embeddings (target_key, content_hash, target_type, target_id, embedding)
            VALUES (:key, :chash, :ttype, :tid, CAST(:emb AS JSONB))
            ON CONFLICT (target_key) DO UPDATE SET
                content_hash = EXCLUDED.content_hash,
                target_type = EXCLUDED.target_type,
                target_id = EXCLUDED.target_id,
                embedding = EXCLUDED.embedding,
                updated_at = CURRENT_TIMESTAMP
        """)
        with persist_engine.begin() as conn:
            for row in rows:
                conn.execute(upsert_sql, row)

    def _cleanup_stale_embeddings(self, persist_engine, current_keys):
        """Delete cached rows that no longer belong to any active product/correction."""
        if not current_keys:
            return
        from sqlalchemy import text as sql_text
        with persist_engine.begin() as conn:
            conn.execute(
                sql_text("DELETE FROM product_embeddings WHERE target_key != ALL(:keys)"),
                {"keys": list(current_keys)}
            )

    def fit(self, products, corrections=[], persist_engine=None):
        """
        Calculates embeddings for all active products and corrected mappings.
        If persist_engine is given, reuses vectors stored in product_embeddings and
        only embeds products/corrections that are new or whose text changed.
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
                "code": c.get("company_product_code", ""),
                "supplier_id": c.get("supplier_id")
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
            vectors = [None] * len(corpus)
            keys = [self._target_key(item) for item in self.combined_data]

            # 1. Reuse vectors that are already persisted and unchanged
            cached_count = 0
            need_embed_idx = list(range(len(corpus)))
            if persist_engine is not None:
                try:
                    stored = self._load_cached_embeddings(persist_engine, keys)
                    need_embed_idx = []
                    for i, item in enumerate(self.combined_data):
                        chash = self._content_hash(corpus[i])
                        entry = stored.get(keys[i])
                        if entry and entry[0] == chash:
                            vectors[i] = entry[1]
                            cached_count += 1
                        else:
                            need_embed_idx.append(i)
                    print(f"[EmbeddingCache] Reused {cached_count}/{len(corpus)} vectors from DB, embedding {len(need_embed_idx)} new/changed items.")
                except Exception as cache_err:
                    print(f"[EmbeddingCache] Load failed — embedding everything this round: {cache_err}")
                    need_embed_idx = list(range(len(corpus)))
                    vectors = [None] * len(corpus)

            # 2. Embed only what is missing/changed
            if need_embed_idx:
                new_embs = self._get_embeddings_batch([corpus[i] for i in need_embed_idx])
                for j, i in enumerate(need_embed_idx):
                    vectors[i] = new_embs[j]

                # 3. Persist newly computed vectors
                if persist_engine is not None:
                    try:
                        rows = []
                        for j, i in enumerate(need_embed_idx):
                            item = self.combined_data[i]
                            rows.append({
                                "key": keys[i],
                                "chash": self._content_hash(corpus[i]),
                                "ttype": item.get("type", "product"),
                                "tid": int(item.get("id") or 0),
                                "emb": json.dumps([round(float(v), 6) for v in vectors[i]]),
                            })
                        self._save_embeddings(persist_engine, rows)
                        try:
                            self._cleanup_stale_embeddings(persist_engine, keys)
                        except Exception as clean_err:
                            print(f"[EmbeddingCache] Stale cleanup skipped: {clean_err}")
                        print(f"[EmbeddingCache] Persisted {len(rows)} embeddings to DB.")
                    except Exception as save_err:
                        print(f"[EmbeddingCache] Save failed (non-fatal): {save_err}")

            self.product_embeddings = np.vstack(vectors)
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
        
        import numpy as np
        # Mean Pooling to get sentence embeddings
        token_embeddings = model_output[0]
        # Check type of token_embeddings (if it's numpy array or torch tensor)
        if isinstance(token_embeddings, np.ndarray):
            token_embeddings = torch.from_numpy(token_embeddings)
        
        attention_mask = encoded_input['attention_mask']
        if isinstance(attention_mask, np.ndarray):
            attention_mask = torch.from_numpy(attention_mask)

        input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
        sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, 1)
        sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)
        embeddings = sum_embeddings / sum_mask
        
        # Normalize L2
        embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)
        return embeddings.numpy()

    def match_product(self, company_product_name, company_product_code, current_supplier_id=None, threshold=0.90):
        """
        Finds the closest database product matching the scanned invoice item.
        Returns:
            matched_product_id (int or None), similarity_score (float)
        """
        comp_name_lower = company_product_name.strip().lower()
        comp_code_lower = company_product_code.strip().lower()

        # 0. Exact code or barcode match check (first priority)
        if comp_code_lower:
            for p in self.product_data:
                db_code = p.get("product_code", "").strip().lower()
                db_barcode = p.get("barcode", "").strip().lower()
                if comp_code_lower == db_code or comp_code_lower == db_barcode:
                    print(f"[Code/Barcode Match] Exact match found: '{company_product_code}' -> DB Product ID {p.get('id')}")
                    return p.get("id"), 1.0

        # 1. Exact match on user-corrected mappings (highest priority, case-insensitive)
        # Prioritize matching corrections from the current supplier first
        if current_supplier_id is not None:
            for c in self.corrections:
                if c.get("supplier_id") == current_supplier_id:
                    c_name = c.get("company_product_name", "").strip().lower()
                    c_code = c.get("company_product_code", "").strip().lower()
                    if c_name == comp_name_lower and c_code == comp_code_lower:
                        print(f"[Direct Supplier Correction Match] Exact match found: '{company_product_name}' -> DB Product ID {c.get('product_id')}")
                        return c.get("product_id"), 1.0

        # Fallback to any supplier's exact correction match
        for c in self.corrections:
            c_name = c.get("company_product_name", "").strip().lower()
            c_code = c.get("company_product_code", "").strip().lower()
            if c_name == comp_name_lower and c_code == comp_code_lower:
                print(f"[Direct Cross-Supplier Correction Match] Exact match found: '{company_product_name}' -> DB Product ID {c.get('product_id')}")
                return c.get("product_id"), 1.0

        query_text = f"{company_product_name} {company_product_code}".strip()
        if not query_text:
            return None, 0.0

        # Fallback to TF-IDF if ONNX is disabled or failed
        if not self.use_onnx or self.product_embeddings is None:
            if not self.fallback_matcher.fitted:
                return None, 0.0
            try:
                query_vector = self.fallback_matcher.vectorizer.transform([query_text])
                from sklearn.metrics.pairwise import cosine_similarity
                similarities = cosine_similarity(query_vector, self.fallback_matcher.product_vectors)[0]
                
                best_corr_idx = -1
                best_corr_score = -1.0
                best_prod_idx = -1
                best_prod_score = -1.0
                
                for idx, score in enumerate(similarities):
                    item = self.combined_data[idx]
                    if item.get("type") == "correction":
                        if score > best_corr_score:
                            best_corr_score = score
                            best_corr_idx = idx
                    else:
                        if score > best_prod_score:
                            best_prod_score = score
                            best_prod_idx = idx
                            
                # Check user corrections with threshold first
                if best_corr_idx != -1 and best_corr_score >= threshold:
                    return self.combined_data[best_corr_idx].get("id"), best_corr_score
                if best_prod_idx != -1 and best_prod_score >= threshold:
                    return self.combined_data[best_prod_idx].get("id"), best_prod_score
                    
                return None, max(best_corr_score, best_prod_score)
            except Exception as e:
                print(f"Error during TF-IDF search: {e}")
                return None, 0.0

        try:
            # Get query embedding
            query_emb = self._get_embeddings_batch([query_text])
            if query_emb is None:
                if not self.fallback_matcher.fitted:
                    return None, 0.0
                query_vector = self.fallback_matcher.vectorizer.transform([query_text])
                from sklearn.metrics.pairwise import cosine_similarity
                similarities = cosine_similarity(query_vector, self.fallback_matcher.product_vectors)[0]
                
                best_corr_idx = -1
                best_corr_score = -1.0
                best_prod_idx = -1
                best_prod_score = -1.0
                
                for idx, score in enumerate(similarities):
                    item = self.combined_data[idx]
                    if item.get("type") == "correction":
                        if score > best_corr_score:
                            best_corr_score = score
                            best_corr_idx = idx
                    else:
                        if score > best_prod_score:
                            best_prod_score = score
                            best_prod_idx = idx
                            
                if best_corr_idx != -1 and best_corr_score >= threshold:
                    return self.combined_data[best_corr_idx].get("id"), best_corr_score
                if best_prod_idx != -1 and best_prod_score >= threshold:
                    return self.combined_data[best_prod_idx].get("id"), best_prod_score
                return None, max(best_corr_score, best_prod_score)

            # Calculate cosine similarities against combined targets
            similarities = np.dot(self.product_embeddings, query_emb[0])
            
            best_corr_idx = -1
            best_corr_score = -1.0
            best_prod_idx = -1
            best_prod_score = -1.0
            
            for idx, score in enumerate(similarities):
                item = self.combined_data[idx]
                if item.get("type") == "correction":
                    if score > best_corr_score:
                        best_corr_score = score
                        best_corr_idx = idx
                else:
                    if score > best_prod_score:
                        best_prod_score = score
                        best_prod_idx = idx
                        
            if best_corr_idx != -1 and best_corr_score >= threshold:
                print(f"[Embedding Match] Found correction match: '{self.combined_data[best_corr_idx].get('name')}' with score: {best_corr_score:.4f}")
                return self.combined_data[best_corr_idx].get("id"), best_corr_score
            if best_prod_idx != -1 and best_prod_score >= threshold:
                print(f"[Embedding Match] Found product match: '{self.combined_data[best_prod_idx].get('name')}' with score: {best_prod_score:.4f}")
                return self.combined_data[best_prod_idx].get("id"), best_prod_score
                
            best_score = max(best_corr_score, best_prod_score)
            print(f"[Embedding Match] Score {best_score:.4f} is below threshold. Product unmatched.")
            return None, best_score
        except Exception as e:
            print(f"Error matching product via ONNX embeddings: {e}")
            # Try TF-IDF fallback
            if not self.fallback_matcher.fitted:
                return None, 0.0
            query_vector = self.fallback_matcher.vectorizer.transform([query_text])
            from sklearn.metrics.pairwise import cosine_similarity
            similarities = cosine_similarity(query_vector, self.fallback_matcher.product_vectors)[0]
            
            best_corr_idx = -1
            best_corr_score = -1.0
            best_prod_idx = -1
            best_prod_score = -1.0
            
            for idx, score in enumerate(similarities):
                item = self.combined_data[idx]
                if item.get("type") == "correction":
                    if score > best_corr_score:
                        best_corr_score = score
                        best_corr_idx = idx
                else:
                    if score > best_prod_score:
                        best_prod_score = score
                        best_prod_idx = idx
                        
            if best_corr_idx != -1 and best_corr_score >= 0.80:
                return self.combined_data[best_corr_idx].get("id"), best_corr_score
            if best_prod_idx != -1 and best_prod_score >= threshold:
                return self.combined_data[best_prod_idx].get("id"), best_prod_score
            return None, max(best_corr_score, best_prod_score)
