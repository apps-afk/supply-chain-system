# Backup workflow

ติดตั้งแล้วที่ `.github/workflows/backup.yml` — สำรองข้อมูลอัตโนมัติทุกวันจันทร์
03:00 น. (เวลาไทย) เก็บเป็น artifact 90 วัน

- ดูผล/สั่งรันเอง: GitHub → Actions → "Weekly Data Backup" → Run workflow
- สำรองด้วยมือจากในแอป: ตั้งค่าพื้นที่ทำงาน → "ดาวน์โหลด Backup (JSON)"
