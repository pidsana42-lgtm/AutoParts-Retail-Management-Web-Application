let counter = 0;
 
/**
 * สร้าง unique id ฝั่ง client สำหรับ item ที่ยังไม่ได้บันทึกลง backend
 * (แก้ปัญหาเดิมที่ใช้ Date.now() เฉย ๆ แล้วชนกันได้ถ้าเพิ่มรายการเร็วมาก
 *  เช่น สแกนบาร์โค้ดรัว ๆ หรือกดเพิ่มพรีออเดอร์ติด ๆ กัน)
 */
export const generateLocalId = (): number => {
    counter = (counter + 1) % 1000;
    return Date.now() * 1000 + counter;
};
 