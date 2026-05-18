/* global React, TwoLevelMasterPage */
/*
  Settings → Material List
  2-level: Category (with Short Code) → Item
  Item code: MAT-[ShortCode]-NNNNN
*/

const MATERIAL_CATEGORIES = [
  { code:'MATC-01', short:'STR', name:'งานโครงสร้าง',     desc:'เหล็ก ปูน คอนกรีต', items:[
    { code:'MAT-STR-00001', name:'ปูนซีเมนต์ ตราช้าง',   spec:'ปอร์ตแลนด์ ประเภท 1',                       unit:'ถุง 50 กก.', status:'Active' },
    { code:'MAT-STR-00002', name:'ปูนซีเมนต์ ตรา TPI',    spec:'ปอร์ตแลนด์ ประเภท 1',                       unit:'ถุง 50 กก.', status:'Active' },
    { code:'MAT-STR-00003', name:'เหล็กเส้น DB12',        spec:'มอก. 24-2559 · ข้ออ้อย ⌀12mm × 10m',         unit:'เส้น',       status:'Active' },
    { code:'MAT-STR-00004', name:'เหล็กเส้น DB16',        spec:'มอก. 24-2559 · ข้ออ้อย ⌀16mm × 10m',         unit:'เส้น',       status:'Active' },
    { code:'MAT-STR-00005', name:'เหล็กเส้น DB20',        spec:'มอก. 24-2559 · ข้ออ้อย ⌀20mm × 10m',         unit:'เส้น',       status:'Active' },
    { code:'MAT-STR-00006', name:'เหล็กเส้น DB25',        spec:'มอก. 24-2559 · ข้ออ้อย ⌀25mm × 10m',         unit:'เส้น',       status:'Active' },
    { code:'MAT-STR-00007', name:'ลวดผูกเหล็ก เบอร์ 22',  spec:'ลวดอบดำ',                                  unit:'กก.',        status:'Active' },
    { code:'MAT-STR-00008', name:'เหล็กรูปพรรณ H-Beam 200',spec:'200×200 × 12m',                            unit:'เส้น',       status:'Non-Active' },
  ] },
  { code:'MATC-02', short:'BRK', name:'งานก่ออิฐ-ฉาบปูน',  desc:'อิฐและปูนฉาบสำเร็จรูป', items:[
    { code:'MAT-BRK-00001', name:'อิฐมวลเบา Q-CON',       spec:'7.5×20×60 cm · มอก. 1505',                  unit:'ก้อน',       status:'Active' },
    { code:'MAT-BRK-00002', name:'อิฐมอญ',                 spec:'ขนาดมาตรฐาน',                              unit:'ก้อน',       status:'Active' },
    { code:'MAT-BRK-00003', name:'ปูนฉาบสำเร็จรูป',         spec:'ฉาบทั่วไป',                                 unit:'ถุง 50 กก.', status:'Active' },
  ] },
  { code:'MATC-03', short:'ROF', name:'งานหลังคา',          desc:'กระเบื้องและเมทัลชีท', items:[
    { code:'MAT-ROF-00001', name:'กระเบื้องหลังคา CPAC โมเนียร์',spec:'33×42 cm · สีเทา',                  unit:'แผ่น',       status:'Active' },
    { code:'MAT-ROF-00002', name:'กระเบื้องหลังคา CPAC ExcellaPro',spec:'33×42 cm · สีแดง',                unit:'แผ่น',       status:'Active' },
    { code:'MAT-ROF-00003', name:'แผ่นเมทัลชีท หนา 0.35mm',spec:'มอก. · เคลือบ Galvalume',                  unit:'ตร.ม.',      status:'Active' },
  ] },
  { code:'MATC-04', short:'TIL', name:'งานพื้น-ผนัง',       desc:'กระเบื้องและปูนยาแนว', items:[
    { code:'MAT-TIL-00001', name:'กระเบื้องเซรามิค 60×60 cm',spec:'Grade A · ผิวด้าน',                       unit:'ตร.ม.',      status:'Active' },
    { code:'MAT-TIL-00002', name:'กระเบื้องพอร์ซเลน 120×60 cm',spec:'Grade A · ผิวเงา',                     unit:'ตร.ม.',      status:'Active' },
    { code:'MAT-TIL-00003', name:'ปูนยาแนวกระเบื้อง',        spec:'สีขาว',                                    unit:'กก.',        status:'Active' },
  ] },
  { code:'MATC-05', short:'SAN', name:'งานสุขภัณฑ์',        desc:'โถ อ่าง ก๊อก', items:[
    { code:'MAT-SAN-00001', name:'โถสุขภัณฑ์ COTTO Simply', spec:'C13017 · 1 ชิ้น 4.5L',                     unit:'ชุด',         status:'Active' },
    { code:'MAT-SAN-00002', name:'อ่างล้างหน้า COTTO ลอย',  spec:'C00027 พร้อมก๊อก',                         unit:'ชุด',         status:'Active' },
  ] },
  { code:'MATC-06', short:'PNT', name:'งานสี',              desc:'สีน้ำพลาสติกและสีรองพื้น', items:[
    { code:'MAT-PNT-00001', name:'สีน้ำพลาสติก TOA SuperShield',spec:'ภายนอก · กึ่งเงา',                    unit:'แกลลอน',     status:'Active' },
    { code:'MAT-PNT-00002', name:'สีน้ำพลาสติก TOA Beyond',  spec:'ภายใน · ด้าน',                             unit:'แกลลอน',     status:'Active' },
    { code:'MAT-PNT-00003', name:'สีรองพื้นปูน',              spec:'อะคริลิค',                                  unit:'แกลลอน',     status:'Active' },
  ] },
  { code:'MATC-07', short:'ELE', name:'งานระบบไฟฟ้า',       desc:'สายไฟ เบรกเกอร์', items:[
    { code:'MAT-ELE-00001', name:'สายไฟ THW 2.5 sq.mm.',     spec:'BCC ทองแดง · 100 ม.',                      unit:'ม้วน',        status:'Active' },
    { code:'MAT-ELE-00002', name:'สายไฟ THW 4.0 sq.mm.',     spec:'BCC ทองแดง · 100 ม.',                      unit:'ม้วน',        status:'Active' },
    { code:'MAT-ELE-00003', name:'เซอร์กิตเบรกเกอร์ 32A',     spec:'Schneider · 2P',                           unit:'ตัว',         status:'Active' },
  ] },
];

// Expose globally for Supplier multi-select to consume
window.MATERIAL_CATEGORIES = MATERIAL_CATEGORIES;

const MAT_UNITS = ['ถุง 50 กก.','เส้น','ก้อน','แผ่น','ตร.ม.','ลบ.ม.','ม.','กก.','ตัน','ลิตร','แกลลอน','ม้วน','ชุด','ชิ้น','ตัว','อัน','ลูก','หลอด'];

const MAT_BULK_COLUMNS = [
  { key:'catShort', name:'หมวด Short Code', required:true },
  { key:'name',     name:'ชื่อวัสดุ',        required:true },
  { key:'spec',     name:'Spec',           required:false },
  { key:'unit',     name:'หน่วย',           required:true },
  { key:'status',   name:'สถานะ',          required:false },
];

const MAT_BULK_SAMPLES = [
  { catShort:'STR', name:'ปูนซีเมนต์ ตรา SCG',      spec:'ปอร์ตแลนด์ ประเภท 1',           unit:'ถุง 50 กก.', status:'Active' },
  { catShort:'TIL', name:'กระเบื้องแกรนิตโต้ 80×80', spec:'Grade A · ผิวเงา',              unit:'ตร.ม.',      status:'Active' },
  { catShort:'PNT', name:'สีน้ำพลาสติก TOA Shield+', spec:'ภายนอก · ป้องกัน UV',          unit:'แกลลอน',     status:'Active' },
  { catShort:'ELE', name:'สายไฟ THW 6.0 sq.mm.',     spec:'BCC · 100 ม.',                  unit:'ม้วน',        status:'Active' },
];

function ScreenSettingsMaterials({ go }) {
  return (
    <TwoLevelMasterPage
      prefix="MAT"
      pageTitle="วัสดุ (Material List)"
      eyebrowAbove="Settings · Master Data"
      intro="คลังกลางของวัสดุทุกประเภท แบ่งเป็น 2 ระดับ — หมวด (มี Short Code) และวัสดุย่อย"
      categoryNoun="หมวดงาน"
      itemNoun="วัสดุ"
      categories={MATERIAL_CATEGORIES}
      unitOptions={MAT_UNITS}
      bulkEntity="วัสดุ"
      bulkColumns={MAT_BULK_COLUMNS}
      bulkSamples={MAT_BULK_SAMPLES}
    />
  );
}

window.ScreenSettingsMaterials = ScreenSettingsMaterials;
