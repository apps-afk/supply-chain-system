'use client';
import React, { useState } from 'react';
import { TwoLevelMasterPage } from '../lib/settings-two-level';

/*
  Settings → SubContract List
  2-level: Category (with Short Code) → Item (งานจ้างย่อย)
  Item code: SUB-[ShortCode]-NNNNN
*/

export const SUBCONTRACT_CATEGORIES = [];

const SUB_UNITS = ['ตร.ม.','ลบ.ม.','ม.','ต้น','ตัน','จุด','ชุด','คน·วัน','ชั่วโมง','งวด'];

const SUB_BULK_COLUMNS = [
  { key:'catShort', name:'หมวด Short Code', required:true },
  { key:'name',     name:'ชื่องานจ้าง',     required:true },
  { key:'spec',     name:'Spec',           required:false },
  { key:'unit',     name:'หน่วย',           required:true },
  { key:'status',   name:'สถานะ',          required:false },
];

const SUB_BULK_SAMPLES = [
  { catShort:'STR', name:'งานเสาเข็มตอก', spec:'I-22 × 18m',         unit:'ต้น',   status:'Active' },
  { catShort:'TIL', name:'งานปูพื้นยาง',  spec:'พื้นภายใน',           unit:'ตร.ม.', status:'Active' },
  { catShort:'PNT', name:'งานทาสีไม้',    spec:'รวมแล็คเกอร์',        unit:'ตร.ม.', status:'Active' },
];

export function ScreenSettingsSubcontracts({ go }) {
  return (
    <TwoLevelMasterPage
      prefix="SUB"
      pageTitle="งานจ้างเหมา (SubContract List)"
      eyebrowAbove="Settings · Master Data"
      intro="งานจ้างผู้รับเหมาแยกตามประเภทงาน 2 ระดับ — หมวด (มี Short Code) และงานย่อย"
      categoryNoun="ประเภทงาน"
      itemNoun="งานจ้าง"
      categories={SUBCONTRACT_CATEGORIES}
      unitOptions={SUB_UNITS}
      bulkEntity="งานจ้าง"
      bulkColumns={SUB_BULK_COLUMNS}
      bulkSamples={SUB_BULK_SAMPLES}
    />
  );
}
