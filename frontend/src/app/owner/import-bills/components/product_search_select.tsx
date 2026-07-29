import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Check, ChevronDown, X } from 'lucide-react';
import type { Product } from '../../../../interface/import';

interface ProductSearchSelectProps {
  value: number | null;
  onChange: (productId: number | null) => void;
  products: Product[];
  companyProductCode?: string;
  companyProductName?: string;
}

// Calculate similarity score between 0 and 1
function calculateSimilarity(targetCode: string, targetName: string, prod: Product): number {
  const code = (targetCode || '').toLowerCase().trim();
  const name = (targetName || '').toLowerCase().trim();

  const pCode = (prod.product_code || '').toLowerCase().trim();
  const pName = (prod.product_name || '').toLowerCase().trim();

  if (!code && !name) return 0;

  // Exact code match
  if (code && pCode && code === pCode) return 1.0;
  // Code contains match
  if (code && pCode && (pCode.includes(code) || code.includes(pCode))) return 0.9;

  // Exact name match
  if (name && pName && name === pName) return 0.95;
  // Name contains match
  if (name && pName && (pName.includes(name) || name.includes(pName))) return 0.8;

  // Word token overlap match
  const nameTokens = name.split(/[\s\-_/]+/).filter(t => t.length > 1);
  const prodTokens = `${pCode} ${pName}`.split(/[\s\-_/]+/).filter(t => t.length > 1);

  if (nameTokens.length === 0 || prodTokens.length === 0) return 0;

  let matchedTokens = 0;
  nameTokens.forEach(nt => {
    if (prodTokens.some(pt => pt.includes(nt) || nt.includes(pt))) {
      matchedTokens++;
    }
  });

  return matchedTokens / Math.max(nameTokens.length, 1);
}

export default function ProductSearchSelect({
  value,
  onChange,
  products,
  companyProductCode = '',
  companyProductName = ''
}: ProductSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 320 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Update position when opening or scrolling
  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Position dropdown directly below the button using fixed coords
      setCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 360)
      });
    }
  };

  const handleToggle = () => {
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  // Close dropdown on click outside or scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === Number(value));
  }, [products, value]);

  // Compute similarity ranked products
  const rankedProducts = useMemo(() => {
    const scored = products.map(prod => ({
      product: prod,
      score: calculateSimilarity(companyProductCode, companyProductName, prod)
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }, [products, companyProductCode, companyProductName]);

  // Filter products based on search query
  const filteredList = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      return rankedProducts.slice(0, 30);
    }

    return rankedProducts
      .filter(({ product }) => {
        const pCode = (product.product_code || '').toLowerCase();
        const pName = (product.product_name || '').toLowerCase();
        const pCat = (product.category_name || '').toLowerCase();
        return pCode.includes(query) || pName.includes(query) || pCat.includes(query);
      })
      .slice(0, 40);
  }, [rankedProducts, searchQuery]);

  return (
    <div className="relative w-full">
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`w-full text-left bg-white border rounded-none px-3 py-1.5 text-sm flex items-center justify-between transition-all cursor-pointer ${
          selectedProduct 
            ? 'border-[#259b24] text-[#1C1B1B]' 
            : 'border-gray-300 text-gray-600 hover:border-gray-400'
        }`}
      >
        <div className="truncate pr-2 font-medium">
          {selectedProduct ? (
            <span className="font-bold text-[#1C1B1B]">
              [{selectedProduct.product_code}] {selectedProduct.product_name}
            </span>
          ) : (
            <span className="text-[#e51c23] font-semibold">สินค้าใหม่</span>
          )}
        </div>
        <ChevronDown size={16} className="text-gray-400 shrink-0" />
      </button>

      {/* Popover Dropdown Panel via Portal */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
            zIndex: 99999
          }}
          className="bg-white border border-gray-300 shadow-2xl rounded-none py-2 text-sm animate-in fade-in duration-100"
        >
          {/* Search Bar Input */}
          <div className="px-3 pb-2 border-b border-gray-100 flex items-center gap-2">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="พิมพ์ชื่อ, รหัสสินค้า หรือหมวดหมู่"
              className="w-full bg-gray-50 border border-gray-200 rounded-none px-2.5 py-1.5 text-xs text-[#1C1B1B] focus:outline-none focus:border-[#e51c23]"
            />
            {searchQuery && (
              <button 
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Option List Area */}
          <div className="max-h-[260px] overflow-y-auto divide-y divide-gray-50">
            {/* Unmatch / New Product Option */}
            <div
              onClick={() => {
                onChange(null);
                setIsOpen(false);
              }}
              className={`px-3 py-2 cursor-pointer hover:bg-gray-100 transition-colors flex items-center justify-between text-xs ${
                !value ? 'bg-red-50 font-bold text-[#e51c23]' : 'text-gray-600'
              }`}
            >
              <span>สินค้าใหม่ (ยังไม่ได้จับคู่ในร้าน)</span>
              {!value && <Check size={14} className="text-[#e51c23]" />}
            </div>

            {/* Smart Suggested Matches Header if auto score > 0.3 */}
            {!searchQuery && rankedProducts.some(r => r.score > 0.3) && (
              <div className="bg-blue-50/70 px-3 py-1 text-[11px] font-bold text-blue-700">
                <span>รายการที่ระบบวิเคราะห์ว่าตรงกันมากที่สุด</span>
              </div>
            )}

            {filteredList.map(({ product, score }) => {
              const isSelected = value === product.id;
              const isHighMatch = score >= 0.4;

              return (
                <div
                  key={product.id}
                  onClick={() => {
                    onChange(product.id);
                    setIsOpen(false);
                  }}
                  className={`px-3 py-2 cursor-pointer transition-colors flex items-center justify-between text-xs hover:bg-gray-100 ${
                    isSelected ? 'bg-green-50 text-[#259b24] font-bold' : 'text-[#1C1B1B]'
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono font-bold text-gray-800">[{product.product_code}]</span>
                      <span className="font-medium truncate">{product.product_name}</span>
                    </div>
                  </div>
                  {isSelected && <Check size={14} className="text-[#259b24] shrink-0" />}
                </div>
              );
            })}

            {filteredList.length === 0 && (
              <div className="p-4 text-center text-xs text-gray-400">
                ไม่พบสินค้าในระบบที่ตรงกับคำค้นหา "{searchQuery}"
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
