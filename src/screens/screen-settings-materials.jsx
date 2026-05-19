'use client';
import React, { useState } from 'react';
import { TwoLevelMasterPage } from '../lib/settings-two-level';

/*
  Settings → Material List
  2-level: Category (with Short Code) → Item
  Item code: MAT-[ShortCode]-NNNNN
*/

export const MATERIAL_CATEGORIES = [];

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

export function ScreenSettingsMaterials({ go }) {
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
