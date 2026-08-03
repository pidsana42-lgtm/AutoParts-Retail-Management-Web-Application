import { useState, useRef } from 'react';
import { Camera, ImageUp, CheckCircle2, RotateCcw, X, Loader2, AlertCircle } from 'lucide-react';
import apiClient from '../../service/http/apiClient';

export default function MobileScanPage() {
  const session = new URLSearchParams(window.location.search).get('session') || '';

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
        <div className="text-center space-y-3">
          <AlertCircle size={48} className="text-red-400 mx-auto" />
          <p className="text-red-600 font-bold text-lg">ลิงก์ไม่ถูกต้อง</p>
          <p className="text-gray-500 text-sm">กรุณาสแกน QR Code ใหม่จากคอมพิวเตอร์</p>
        </div>
      </div>
    );
  }

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploaded(false);
    setError(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
    e.target.value = '';
  };

  const handleSend = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('image', selectedFile);
      await apiClient.post(`/mobile/upload-image?session=${session}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploaded(true);
      setUploadCount(prev => prev + 1);
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch {
      setError('อัปโหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setUploaded(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      {/* Header */}
      <div className="bg-[#e51c23] text-white px-5 py-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
          <Camera size={18} className="text-[#e51c23]" />
        </div>
        <div>
          <p className="font-extrabold text-base leading-tight">ส่งรูปบิลให้ระบบ</p>
          <p className="text-red-100 text-xs">ถ่ายหรืออัปรูป แล้วรูปจะขึ้นบนคอมทันที</p>
        </div>
        {uploadCount > 0 && (
          <span className="ml-auto bg-white text-[#e51c23] font-extrabold text-xs px-2.5 py-1 rounded-full">
            ส่งแล้ว {uploadCount} รูป
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">

        {/* Success state */}
        {uploaded && !selectedFile && (
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-green-100 p-8 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
              <CheckCircle2 size={36} className="text-green-500" />
            </div>
            <div>
              <p className="font-extrabold text-[#1C1B1B] text-lg">ส่งสำเร็จ!</p>
              <p className="text-gray-500 text-sm mt-1">รูปกำลังขึ้นบนหน้าจอคอมพิวเตอร์แล้ว</p>
            </div>
            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 bg-[#e51c23] text-white font-bold py-3.5 rounded-xl text-sm active:bg-[#c9181f] transition-colors"
            >
              <RotateCcw size={16} />
              ส่งรูปอีกภาพ
            </button>
          </div>
        )}

        {/* Preview + send state */}
        {selectedFile && previewUrl && (
          <div className="w-full max-w-sm flex flex-col gap-4">
            <div className="relative bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <img
                src={previewUrl}
                alt="preview"
                className="w-full object-contain max-h-72"
              />
              <button
                onClick={handleReset}
                className="absolute top-3 right-3 bg-black/40 text-white rounded-full p-1.5 active:bg-black/60"
              >
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 bg-[#e51c23] text-white font-bold py-4 rounded-xl text-base active:bg-[#c9181f] transition-colors disabled:bg-gray-300"
            >
              {uploading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  กำลังส่ง...
                </>
              ) : (
                <>
                  <Camera size={20} />
                  ส่งรูปนี้ขึ้นคอม
                </>
              )}
            </button>
          </div>
        )}

        {/* Default state: choose action */}
        {!selectedFile && !uploaded && (
          <div className="w-full max-w-sm flex flex-col gap-4">
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            {/* Take photo */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-3 bg-white border-2 border-[#e51c23] text-[#e51c23] font-bold py-10 rounded-2xl shadow-sm active:bg-red-50 transition-colors"
            >
              <Camera size={48} strokeWidth={1.5} />
              <span className="text-xl">ถ่ายรูปบิล</span>
              <span className="text-xs text-gray-400 font-normal">เปิดกล้องมือถือ</span>
            </button>

            {/* Upload from gallery */}
            <button
              onClick={() => galleryInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-600 font-bold py-8 rounded-2xl shadow-sm active:bg-gray-50 transition-colors"
            >
              <ImageUp size={36} strokeWidth={1.5} />
              <span className="text-base">เลือกรูปจากอัลบัม</span>
            </button>
          </div>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={handleInputChange}
      />

      <p className="text-center text-xs text-gray-400 pb-6">
        รูปจะขึ้นบนหน้าสแกนบิลในคอมพิวเตอร์ทันที
      </p>
    </div>
  );
}
