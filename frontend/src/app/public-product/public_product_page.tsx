import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Barcode, Boxes, Building2, Car, CircleDollarSign, MapPin, Package, Tag } from "lucide-react";
import apiClient from "../../service/http/apiClient";

type ProductModel = {
  id: number;
  model_name: string;
  brand_name: string;
};

// PublicProductSupplier: ผู้จำหน่าย 1 รายที่สินค้านี้รับมาจาก — VariantCode ใช้จับคู่กับพารามิเตอร์ ?variant=
// ใน URL (มาจาก QR ที่พิมพ์แยกตามบริษัท) เพื่อโชว์ให้ตรงว่าชิ้นที่สแกนนี้มาจากบริษัทไหนเจาะจง
type PublicProductSupplier = {
  supplier_id: number;
  supplier_name: string;
  quantity: number;
  company_product_code?: string;
  variant_code?: string;
  barcode?: string;
};

type PublicProduct = {
  id: number;
  product_code: string;
  part_number: string;
  product_name: string;
  quantity: number;
  sale_price: number;
  is_active: boolean;
  models?: ProductModel[];
  category_name: string;
  sub_category_name: string;
  sub_sub_category_name: string;
  grade_name: string;
  unit_name: string;
  shelf_name: string;
  shelf_level_name: string;
  thumbnail_url: string;
  supplier_name: string;
  suppliers?: PublicProductSupplier[];
  note: string;
};

const getApiOrigin = () => {
  const baseURL = apiClient.defaults.baseURL || "";
  try {
    return new URL(baseURL).origin;
  } catch {
    return "";
  }
};

const resolveImageUrl = (url: string) => {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const normalized = url.startsWith("/") ? url : `/${url}`;
  return `${getApiOrigin()}${normalized}`;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(value || 0);

export default function PublicProductPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const variantCode = searchParams.get("variant") || "";
  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    const loadProduct = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await apiClient.get<PublicProduct>(`/wms/products/${id}`);
        if (alive) setProduct(response.data);
      } catch {
        if (alive) setError("ไม่พบข้อมูลสินค้า หรือไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadProduct();

    return () => {
      alive = false;
    };
  }, [id]);

  const modelText = useMemo(() => {
    const models = product?.models || [];
    if (!models.length) return "-";
    return models
      .map((model) => [model.brand_name, model.model_name].filter(Boolean).join(" "))
      .filter(Boolean)
      .join(", ");
  }, [product]);

  // บริษัทที่นำเข้าสินค้าชิ้นนี้: ถ้า URL มี ?variant= (มาจาก QR ที่พิมพ์แยกตามบริษัท) ให้จับคู่ Supplier
  // ที่ตรงกับ variant code นั้นเจาะจง ไม่งั้น fallback ไปใช้ supplier_name รวม (คั่นด้วย ", " ถ้ามีหลายเจ้า)
  const importerName = useMemo(() => {
    if (variantCode) {
      const matched = product?.suppliers?.find((s) => s.variant_code === variantCode);
      if (matched?.supplier_name) return matched.supplier_name;
    }
    return product?.supplier_name || "";
  }, [product, variantCode]);

  // บาร์โค้ด: ไม่มีบาร์โค้ดกลางของสินค้าเองแล้ว (ผูกกับ Supplier แต่ละเจ้าแทน) — ถ้าสแกนมาจากคิวอาร์ของบริษัทไหน
  // เจาะจง ใช้รหัสของบริษัทนั้น ไม่งั้นใช้ของเจ้าแรกที่มี แล้วค่อย fallback เป็นรหัสสินค้า
  const displayCode = useMemo(() => {
    const matched = variantCode ? product?.suppliers?.find((s) => s.variant_code === variantCode) : undefined;
    const supplier = matched || product?.suppliers?.[0];
    return supplier?.variant_code || supplier?.barcode || product?.product_code || "";
  }, [product, variantCode]);

  const imageUrl = resolveImageUrl(product?.thumbnail_url || "");

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8 text-gray-900">
        <section className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
          <div className="mt-4 h-10 w-3/4 animate-pulse rounded bg-gray-200" />
          <div className="mt-6 h-48 animate-pulse rounded bg-gray-200" />
        </section>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8 text-gray-900">
        <section className="mx-auto max-w-2xl rounded-lg border border-red-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-red-600">Product unavailable</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-950">{error || "ไม่พบข้อมูลสินค้า"}</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <section className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-red-700">
                {product.product_code || displayCode || `ID ${product.id}`}
              </p>
              <h1 className="mt-2 text-2xl font-bold leading-tight text-gray-950 sm:text-3xl">
                {product.product_name}
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                หมวดหมู่: {[
                  product.category_name,
                  product.sub_category_name,
                  product.sub_sub_category_name
                ].filter(Boolean).join(" > ") || "-"}
              </p>
            </div>
            <div className="rounded-md border border-gray-200 px-4 py-3 text-left sm:text-right">
              <p className="text-sm text-gray-500">ราคาขาย</p>
              <p className="text-xl font-bold text-gray-950">{formatMoney(product.sale_price)}</p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={product.product_name}
                className="aspect-square w-full rounded-md object-cover"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-md bg-gray-100 text-gray-400">
                <Package className="h-16 w-16" aria-hidden="true" />
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoItem icon={<Barcode />} label="Barcode" value={displayCode || "-"} />
              <InfoItem icon={<Tag />} label="Part No." value={product.part_number || "-"} />
              {importerName ? (
                <InfoItem icon={<Building2 />} label="บริษัทที่นำเข้า" value={importerName} />
              ) : null}
              <InfoItem icon={<Boxes />} label="คงเหลือ" value={`${product.quantity || 0} ${product.unit_name || ""}`} />
              <InfoItem icon={<CircleDollarSign />} label="เกรดสินค้า" value={product.grade_name || "-"} />
              <InfoItem icon={<MapPin />} label="ตำแหน่งจัดเก็บ" value={[product.shelf_name, product.shelf_level_name].filter(Boolean).join(" / ") || "-"} />
              <InfoItem icon={<Car />} label="รุ่นที่ใช้ได้" value={modelText} />
            </div>

            {product.note ? (
              <div className="mt-5 rounded-md bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-700">หมายเหตุ</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{product.note}</p>
              </div>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactElement; label: string; value: string }) {
  return (
    <div className="flex min-h-20 gap-3 rounded-md border border-gray-100 bg-gray-50 p-3">
      <span className="mt-0.5 text-red-700 [&_svg]:h-5 [&_svg]:w-5" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-normal text-gray-500">{label}</p>
        <p className="mt-1 break-words text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}
