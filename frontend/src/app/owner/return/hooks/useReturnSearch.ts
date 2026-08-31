import { useState, useRef, useEffect, useCallback } from 'react';
import type { ReturnableSaleOrder } from '../../../../interface/return/return_interface';
import { returnService } from '../../../../service/http/return/return_service';

const SEARCH_DEBOUNCE_MS = 400;

export const useReturnSearch = () => {
  const [keyword, setKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<ReturnableSaleOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ReturnableSaleOrder | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const latestRequestId = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // รีเซ็ตไฮไลต์กลับไปที่รายการแรกทุกครั้งที่ผลการค้นหาเปลี่ยน
  useEffect(() => {
    setHighlightedIndex(searchResults.length > 0 ? 0 : -1);
  }, [searchResults]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // ฟังก์ชันค้นหาหลัก
  const runSearch = useCallback(async (searchKeyword: string, showError = false) => {
    const requestId = ++latestRequestId.current;
    setIsSearching(true);
    setSearchError(null);
        
    try {
      const results = await returnService.searchReturnableSaleOrders(searchKeyword);
      if (requestId === latestRequestId.current) {
        if (!results || results.length === 0) {
          if (showError) {
            setSearchError("ไม่พบใบเสร็จ/ใบขายที่ตรงกับคำค้นหา กรุณาตรวจสอบข้อมูลอีกครั้ง");
          }
          setSearchResults([]);
        } else {
          setSearchResults(results);
        }
      }
    } catch (error: any) {
      if (requestId === latestRequestId.current) {
      const message = error.response?.data?.message || error.message || "เกิดข้อผิดพลาดในการค้นหา";
        if (showError) {
          setSearchError(message);
        }
        setSearchResults([]);
      }
    } finally {
      if (requestId === latestRequestId.current) {
        setIsSearching(false);
      }
    }
  }, []);

  // 1. ฟังก์ชันค้นหาจากการพิมพ์ (มี Debounce กันยิง API รัวๆ)
  const handleSearchInput = (value: string) => {
    setKeyword(value);
    setSearchError(null);
        
    // ถ้าเคยเลือกใบเสร็จไปแล้ว แต่พิมพ์แก้ช่องค้นหา ให้เคลียร์ที่เลือกไว้
    if (selectedOrder && value !== selectedOrder.order_number) {
      setSelectedOrder(null);
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    const trimmed = value.trim();
    if (trimmed.length > 0) {
      debounceTimer.current = setTimeout(() => {
        runSearch(trimmed);
      }, SEARCH_DEBOUNCE_MS);
    } else {
      setSearchResults([]);
      latestRequestId.current++; 
    }
  };

  // 2. ฟังก์ชันเมื่อเลือกใบเสร็จจาก Dropdown หรือกด Enter
  const handleSelectOrder = (order: ReturnableSaleOrder) => {
    setSelectedOrder(order);
    setKeyword(order.order_number);
    setSearchResults([]);
    setSearchError(null);
  };

  // 3. ฟังก์ชันสำหรับปุ่ม "ค้นหา" (บังคับค้นหาทันทีไม่ต้องรอ Debounce)
  const handleForceSearch = () => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    runSearch(trimmed, true);
  };

  // 4. ฟังก์ชันดักปุ่มคีย์บอร์ดตอนอยู่ในช่องค้นหา
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % searchResults.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const selected = searchResults[highlightedIndex] ?? searchResults[0];
        handleSelectOrder(selected);
        setHighlightedIndex(-1);
        return;
      }
      if (e.key === 'Escape') {
        setSearchResults([]);
        setHighlightedIndex(-1);
        return;
      }
    }
          
    // ถ้าไม่มี Dropdown แล้วกด Enter ให้บังคับค้นหาเลย
    if (e.key === 'Enter') {
      e.preventDefault();
      handleForceSearch();
    }
  };

  return {
    keyword,
    searchResults,
    selectedOrder,
    isSearching,
    searchError,
    highlightedIndex,
    handleSearchInput,
    handleSelectOrder,
    handleSearchKeyDown,
    handleForceSearch
  };
};
