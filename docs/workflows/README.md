# Backup workflow — ติดตั้งด้วยมือ 1 ครั้ง

`backup.yml` คือ workflow สำรองข้อมูลอัตโนมัติรายสัปดาห์ (dump ทุกตาราง →
เก็บเป็น artifact 90 วัน ใช้ secrets เดิมที่มีอยู่แล้ว ไม่ต้องตั้งอะไรเพิ่ม)

Push token ปัจจุบันไม่มี `workflow` scope จึงวางไฟล์ไว้ที่นี่ก่อน — วิธีเปิดใช้:

1. เปิด GitHub → repo นี้ → สร้างไฟล์ `.github/workflows/backup.yml`
   (Add file → Create new file บนเว็บ ทำได้เลย ไม่ติด scope)
2. คัดลอกเนื้อหาจาก `docs/workflows/backup.yml` ทั้งไฟล์ → Commit
3. เสร็จ — รันเองครั้งแรกได้ที่ Actions → "Weekly Data Backup" → Run workflow

ระหว่างนี้ยังสำรองข้อมูลด้วยมือได้จากในแอป:
ตั้งค่าพื้นที่ทำงาน → "ดาวน์โหลด Backup (JSON)"
