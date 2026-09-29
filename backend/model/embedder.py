import os
import sys
import json
import hashlib
import numpy as np
import traceback

# จำนวนมิติของ embedding ที่ EmbeddingGemma-300m คืนออกมา — ใช้กำหนดชนิดคอลัมน์ vector(n)
# ในตาราง product_embeddings ถ้าเปลี่ยนโมเดล ต้องแก้ค่านี้แล้วสร้าง embedding ใหม่ทั้งหมด
EMBEDDING_DIM = 768


def resolve_onnx_file(base_dir):
    """
    หาไฟล์ .onnx ในโฟลเดอร์โมเดล — คลังบน Hugging Face วางไฟล์ไว้ใต้ onnx/ แต่โฟลเดอร์ที่
    คัดลอกมาเองมักวางไว้ที่ราก จึงต้องรองรับทั้งสองแบบ คืน None ถ้าไม่พบ
    """
    for candidate in (os.path.join(base_dir, "model.onnx"),
                      os.path.join(base_dir, "onnx", "model.onnx")):
        if os.path.exists(candidate):
            return candidate
    return None


def embedding_text(name, code):
    """
    ข้อความที่นำไปสร้างเวกเตอร์ — ใช้ "ชื่อสินค้า" อย่างเดียว ไม่รวมรหัสสินค้า

    เหตุผล: โมเดลภาษาไม่เข้าใจรหัสอย่าง IS-CMG-643A หรือ C7NN7227A มันมองเป็นตัวอักษรสุ่ม
    และรหัสฝั่งซัพพลายเออร์กับฝั่งร้านมักไม่ตรงกันอยู่แล้ว การใส่รหัสปนเข้าไปจึงเจือจางสัญญาณ
    ความหมายของชื่อ วัดกับข้อมูลจริงแล้วคะแนนคู่ที่ควรจับได้ตกลง 0.05-0.22 และช่องว่างระหว่าง
    คู่ถูกกับคู่ผิดแคบลงราว 4 เท่า

    รหัสสินค้ายังถูกใช้เต็มที่ในขั้นที่เหมาะกับมัน คือการเทียบแบบตรงตัวอักษรในขั้นที่ 1-3 ของ
    match_product() ซึ่งแม่นกว่าการเทียบเชิงความหมายอยู่แล้ว

    ถ้าไม่มีชื่อเลย ค่อยถอยไปใช้รหัสเป็นข้อความแทน ดีกว่าไม่มีอะไรให้เทียบ
    """
    return (name or "").strip() or (code or "").strip()

# Fallback TF-IDF text matcher in case transformers / onnxruntime loading fails
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
        self._onnx_input_names = []
        self._onnx_output_names = []
        self.use_onnx = False
        self.model_id = "none"
        self.product_data = []
        self.product_embeddings = None
        self.corrections = []
        self.combined_data = []
        self.persist_engine = None
        self.fallback_matcher = TFIDFMatcher()

        local_model_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "embeddinggemma-300m-ONNX"))

        # ถ้าตั้ง USE_TFIDF_ONLY=1 (เช่น VPS RAM น้อย) ให้ข้าม ONNX ไปเลย
        if os.environ.get("USE_TFIDF_ONLY", "0") == "1":
            print("USE_TFIDF_ONLY=1 detected — skipping ONNX model load, using TF-IDF only.")
            return

        # Try to initialize ONNX model
        try:
            # Disable noisy library warnings
            import warnings
            warnings.filterwarnings("ignore")

            import onnxruntime as ort
            from transformers import AutoTokenizer

            # Check if model exists locally
            onnx_file = resolve_onnx_file(local_model_path)
            if onnx_file is None:
                print(f"ONNX model not found locally in {local_model_path}. Downloading from Hugging Face Hub and saving locally...")
                from huggingface_hub import snapshot_download
                snapshot_download(
                    repo_id="onnx-community/embeddinggemma-300m-ONNX",
                    local_dir=local_model_path,
                    allow_patterns=["*.json", "*.txt", "*.model", "model.onnx*", "onnx/model.onnx*"],
                )
                onnx_file = resolve_onnx_file(local_model_path)
                if onnx_file is None:
                    raise FileNotFoundError(
                        f"ดาวน์โหลดเสร็จแล้วแต่ยังหา model.onnx ไม่เจอใน {local_model_path}")
                print(f"ONNX model saved successfully to: {local_model_path}")
            else:
                print(f"ONNX model found locally at: {onnx_file}")

            self.model_id = local_model_path
            print(f"Attempting to load ONNX embedding model from: {onnx_file}...")
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_id)

            # โหลดไฟล์ .onnx เข้า onnxruntime โดยตรง แทนการผ่าน optimum เพราะ
            #   1. optimum ผูกเวอร์ชันแน่นกับ transformers — พังทันทีเมื่อ transformers 5 ตัด is_offline_mode ออก
            #      ทำให้ระบบเงียบ ๆ ตกไปใช้ TF-IDF ทั้งที่ควรใช้ embedding
            #   2. ตัด optimum และ torch ออกจากเส้นทางอนุมานผลได้ทั้งคู่ เหลือแค่ onnxruntime + numpy
            #      ใช้หน่วยความจำประมาณ 1.2 GB ซึ่งรันบนเครื่องสเปกต่ำได้
            self.model = ort.InferenceSession(onnx_file, providers=["CPUExecutionProvider"])
            self._onnx_input_names = [i.name for i in self.model.get_inputs()]
            self._onnx_output_names = [o.name for o in self.model.get_outputs()]
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
                    if emb is None:
                        continue
                    # pgvector คืนคอลัมน์ vector มาเป็นสตริงรูปแบบ '[0.1,0.2,...]'
                    if isinstance(emb, str):
                        emb = json.loads(emb)
                    stored[key] = (chash, np.array(emb, dtype=np.float32))
        return stored

    def _save_embeddings(self, persist_engine, rows):
        """Upsert newly computed embeddings into the DB."""
        from sqlalchemy import text as sql_text
        upsert_sql = sql_text("""
            INSERT INTO product_embeddings (target_key, content_hash, target_type, target_id, supplier_id, embedding)
            VALUES (:key, :chash, :ttype, :tid, :sid, CAST(:emb AS vector))
            ON CONFLICT (target_key) DO UPDATE SET
                content_hash = EXCLUDED.content_hash,
                target_type = EXCLUDED.target_type,
                target_id = EXCLUDED.target_id,
                supplier_id = EXCLUDED.supplier_id,
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

    def fit(self, products, corrections=[], persist_engine=None, skip_embed_ids=None):
        """
        Calculates embeddings for all active products and corrected mappings.
        If persist_engine is given, reuses vectors stored in product_embeddings and
        only embeds products/corrections that are new or whose text changed.

        skip_embed_ids: product ids that must NOT get a *new* embedding computed/persisted
        this round (e.g. products only ever referenced by a bill still saved as a draft —
        the name may still get corrected before the draft is finalized). They still take
        part in this fit() call with a placeholder zero vector so the matrix shapes stay
        consistent and — critically — so they still count as "current" for the stale-cleanup
        below, instead of being excluded from the whole query (which was tried and reverted:
        excluding them from the query made cleanup think they were deleted and wipe out any
        embedding they'd already earned from an earlier, non-draft bill). A product that
        already has a valid cached embedding is unaffected either way — the cache check below
        runs before this ever applies.
        """
        skip_embed_ids = set(skip_embed_ids or [])
        self.product_data = products
        self.corrections = corrections
        self.persist_engine = persist_engine
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
            corpus.append(embedding_text(p.get("product_name", ""), p.get("product_code", "")))
            
        # 2. User corrected mappings
        for c in corrections:
            self.combined_data.append({
                "type": "correction",
                "id": c.get("product_id"),
                "name": c.get("company_product_name", ""),
                "code": c.get("company_product_code", ""),
                "supplier_id": c.get("supplier_id")
            })
            corpus.append(embedding_text(c.get("company_product_name", ""), c.get("company_product_code", "")))

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

            def _is_skippable(idx):
                item = self.combined_data[idx]
                return item.get("type") == "product" and item.get("id") in skip_embed_ids

            # 1. Reuse vectors that are already persisted and unchanged
            cached_count = 0
            skipped_count = 0
            need_embed_idx = [i for i in range(len(corpus)) if not _is_skippable(i)]
            for i in range(len(corpus)):
                if _is_skippable(i):
                    vectors[i] = np.zeros(EMBEDDING_DIM, dtype=np.float32)
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
                        elif _is_skippable(i):
                            # ยังไม่เคย embed จริงมาก่อน และตอนนี้ผูกกับบิลร่างล้วนๆ — ใส่เวกเตอร์
                            # ศูนย์ไปก่อนเฉยๆ (ไม่เรียกโมเดล ไม่บันทึกลง DB) กันไม่ให้ชื่อที่ยังไม่ได้
                            # ตรวจสอบไปมีผลจับคู่กับบิลอื่นก่อนเวลา
                            vectors[i] = np.zeros(EMBEDDING_DIM, dtype=np.float32)
                            skipped_count += 1
                        else:
                            need_embed_idx.append(i)
                    print(f"[EmbeddingCache] Reused {cached_count}/{len(corpus)} vectors from DB, "
                          f"skipped {skipped_count} draft-only products, embedding {len(need_embed_idx)} new/changed items.")
                except Exception as cache_err:
                    print(f"[EmbeddingCache] Load failed — embedding everything this round: {cache_err}")
                    need_embed_idx = [i for i in range(len(corpus)) if not _is_skippable(i)]
                    for i in range(len(corpus)):
                        if _is_skippable(i):
                            vectors[i] = np.zeros(EMBEDDING_DIM, dtype=np.float32)
                        else:
                            vectors[i] = None

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
                            supplier_id = item.get("supplier_id")
                            rows.append({
                                "key": keys[i],
                                "chash": self._content_hash(corpus[i]),
                                "ttype": item.get("type", "product"),
                                "tid": int(item.get("id") or 0),
                                # สินค้าทั่วไปไม่ผูกกับซัพพลายเออร์เจ้าใดเจ้าหนึ่ง จึงเก็บเป็น NULL
                                "sid": int(supplier_id) if supplier_id is not None else None,
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
        
        # Tokenize (numpy tensors — onnxruntime รับ numpy โดยตรง ไม่ต้องผ่าน torch)
        encoded_input = self.tokenizer(texts, padding=True, truncation=True, max_length=128, return_tensors="np")
        feed = {name: encoded_input[name].astype(np.int64)
                for name in self._onnx_input_names if name in encoded_input}
        model_output = self.model.run(None, feed)

        # โมเดลคืน last_hidden_state (เวกเตอร์ราย token) — เลือกมาทำ mean pooling เอง
        if "last_hidden_state" in self._onnx_output_names:
            token_embeddings = model_output[self._onnx_output_names.index("last_hidden_state")]
        else:
            token_embeddings = model_output[0]

        # Mean Pooling to get sentence embeddings (นับเฉพาะ token จริง ไม่นับ padding)
        attention_mask = encoded_input["attention_mask"][..., None].astype(np.float32)
        sum_embeddings = (token_embeddings * attention_mask).sum(axis=1)
        sum_mask = np.clip(attention_mask.sum(axis=1), 1e-9, None)
        embeddings = sum_embeddings / sum_mask

        # Normalize L2 — ทำให้ dot product เท่ากับ cosine similarity พอดี
        norms = np.clip(np.linalg.norm(embeddings, axis=1, keepdims=True), 1e-12, None)
        return (embeddings / norms).astype(np.float32)

    # ลำดับความน่าเชื่อถือของเป้าหมายที่นำมาเทียบเวกเตอร์ ไล่จากเชื่อถือได้มากไปน้อย
    # ให้ตรงกับขั้นที่ 2-3 ของ match_product() ที่เทียบแบบตรงตัวอักษร:
    #   1. คู่ที่พนักงานเคยยืนยันไว้ "ของซัพพลายเออร์เจ้าที่กำลังนำเข้า" — แม่นที่สุดเพราะแต่ละเจ้า
    #      เรียกอะไหล่ตัวเดียวกันคนละชื่อ และชื่อเดียวกันของคนละเจ้าอาจหมายถึงคนละสินค้า
    #   2. คู่ที่เคยยืนยันของซัพพลายเออร์เจ้าอื่น — ใช้เป็นตัวช่วยข้ามเจ้า
    #   3. สินค้าในคลังตามชื่อที่ร้านตั้งเอง
    _SEARCH_TIERS = ("own_correction", "any_correction", "product")

    def _search_via_pgvector(self, query_vec, threshold, current_supplier_id=None):
        """
        หาเป้าหมายที่ใกล้เคียงที่สุดโดยให้ PostgreSQL คำนวณ cosine distance ด้วยตัวดำเนินการ <=>
        ของ pgvector ผ่าน HNSW index แทนการดึงเวกเตอร์ทั้งตารางขึ้นมาคูณเมทริกซ์ในหน่วยความจำ

        เวกเตอร์ถูก normalize แบบ L2 มาแล้วตั้งแต่ _get_embeddings_batch ค่า 1 - distance จึงเท่ากับ
        cosine similarity พอดี ผลลัพธ์ตรงกับการคำนวณด้วย np.dot แบบเดิมทุกประการ

        คืนค่า:
            (product_id, score) เมื่อเจอและผ่าน threshold
            (None, best_score)  เมื่อค้นเจอแต่คะแนนไม่ถึงเกณฑ์
            None                เมื่อค้นในฐานข้อมูลไม่ได้/ตารางว่าง เพื่อให้ผู้เรียกไปใช้วิธีคำนวณในหน่วยความจำแทน
        """
        if self.persist_engine is None:
            return None

        from sqlalchemy import text as sql_text
        literal = "[" + ",".join(f"{float(v):.6f}" for v in query_vec) + "]"
        conditions = {
            "own_correction": "target_type = 'correction' AND supplier_id = :sid",
            "any_correction": "target_type = 'correction'",
            "product": "target_type = 'product'",
        }

        try:
            best = {}
            with self.persist_engine.connect() as conn:
                for tier in self._SEARCH_TIERS:
                    if tier == "own_correction" and current_supplier_id is None:
                        best[tier] = (None, -1.0)
                        continue
                    row = conn.execute(sql_text(f"""
                        SELECT target_id, 1 - (embedding <=> CAST(:q AS vector)) AS score
                        FROM product_embeddings
                        WHERE {conditions[tier]}
                        ORDER BY embedding <=> CAST(:q AS vector)
                        LIMIT 1
                    """), {"q": literal, "sid": current_supplier_id}).fetchone()
                    best[tier] = (row[0], float(row[1])) if row else (None, -1.0)
        except Exception as e:
            print(f"[pgvector] Search failed — falling back to in-memory matching: {e}")
            return None

        # ตารางว่าง (ยังไม่เคยสร้าง embedding) — ให้ผู้เรียกไปใช้วิธีเดิม
        if all(target_id is None for target_id, _ in best.values()):
            return None

        for tier in self._SEARCH_TIERS:
            target_id, score = best[tier]
            if target_id is not None and score >= threshold:
                print(f"[pgvector] {tier} match -> product ID {target_id} (score {score:.4f})")
                return target_id, score

        best_score = max(score for _, score in best.values())
        print(f"[pgvector] Best score {best_score:.4f} is below threshold {threshold}. Product unmatched.")
        return None, best_score

    def _search_in_memory(self, query_vec, threshold, current_supplier_id=None):
        """
        เส้นทางสำรองเมื่อฐานข้อมูลใช้ไม่ได้ — คูณเมทริกซ์ในหน่วยความจำ
        ใช้ลำดับชั้นเดียวกับ _search_via_pgvector เป๊ะ ๆ เพื่อให้ผลลัพธ์ไม่ต่างกัน
        """
        similarities = np.dot(self.product_embeddings, query_vec)
        return self._pick_best_by_tier(similarities, threshold, current_supplier_id)

    def _search_tfidf(self, query_text, threshold, current_supplier_id=None, correction_threshold=None):
        """
        เส้นทางสำรองสุดท้าย — เทียบความคล้ายของ "ตัวอักษร" ด้วย TF-IDF เมื่อโมเดล embedding ใช้ไม่ได้
        ใช้ลำดับชั้นเดียวกับเส้นทางเวกเตอร์ เพื่อให้พฤติกรรมไม่ต่างกันเวลาระบบถอยมาใช้ทางนี้

        correction_threshold: ผ่อนเกณฑ์เฉพาะคู่ที่พนักงานเคยยืนยัน ใช้ตอนที่โมเดลพังกลางคันเท่านั้น
        """
        if not self.fallback_matcher.fitted:
            return None, 0.0
        try:
            from sklearn.metrics.pairwise import cosine_similarity
            query_vector = self.fallback_matcher.vectorizer.transform([query_text])
            similarities = cosine_similarity(query_vector, self.fallback_matcher.product_vectors)[0]
        except Exception as e:
            print(f"Error during TF-IDF search: {e}")
            return None, 0.0
        return self._pick_best_by_tier(similarities, threshold, current_supplier_id,
                                       correction_threshold=correction_threshold, label="TF-IDF")

    def _pick_best_by_tier(self, similarities, threshold, current_supplier_id=None,
                           correction_threshold=None, label="in-memory"):
        """
        เลือกผู้ชนะจากคะแนนความคล้ายที่คำนวณมาแล้ว โดยไล่ตามลำดับชั้นใน _SEARCH_TIERS
        ใช้ร่วมกันระหว่างเส้นทางคำนวณในหน่วยความจำกับเส้นทาง TF-IDF
        """
        best = {tier: (None, -1.0) for tier in self._SEARCH_TIERS}
        for idx, score in enumerate(similarities):
            item = self.combined_data[idx]
            score = float(score)
            if item.get("type") == "correction":
                tiers = ["any_correction"]
                if current_supplier_id is not None and item.get("supplier_id") == current_supplier_id:
                    tiers.insert(0, "own_correction")
            else:
                tiers = ["product"]
            for tier in tiers:
                if score > best[tier][1]:
                    best[tier] = (item.get("id"), score)

        for tier in self._SEARCH_TIERS:
            target_id, score = best[tier]
            limit = threshold
            if correction_threshold is not None and tier != "product":
                limit = correction_threshold
            if target_id is not None and score >= limit:
                print(f"[{label}] {tier} match -> product ID {target_id} (score {score:.4f})")
                return target_id, score
        return None, max(score for _, score in best.values())

    def match_product(self, company_product_name, company_product_code, current_supplier_id=None, threshold=0.85):
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

        query_text = embedding_text(company_product_name, company_product_code)
        if not query_text:
            return None, 0.0

        # โมเดล embedding ใช้ไม่ได้ (ถูกปิดด้วย USE_TFIDF_ONLY หรือโหลดไม่สำเร็จ) — ถอยไปใช้ TF-IDF
        if not self.use_onnx or self.product_embeddings is None:
            return self._search_tfidf(query_text, threshold, current_supplier_id)

        try:
            query_emb = self._get_embeddings_batch([query_text])
            if query_emb is None:
                return self._search_tfidf(query_text, threshold, current_supplier_id)

            # ค้นด้วย pgvector ในฐานข้อมูลก่อน
            db_match = self._search_via_pgvector(query_emb[0], threshold, current_supplier_id)
            if db_match is not None:
                return db_match

            # สำรอง: คำนวณในหน่วยความจำ เผื่อฐานข้อมูลใช้ไม่ได้หรือยังไม่มีเวกเตอร์ในตาราง
            return self._search_in_memory(query_emb[0], threshold, current_supplier_id)
        except Exception as e:
            print(f"Error matching product via ONNX embeddings: {e}")
            return self._search_tfidf(query_text, threshold, current_supplier_id, correction_threshold=0.80)
