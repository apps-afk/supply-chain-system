'use client';
import React, { useState } from 'react';
import { TwoLevelMasterPage } from '../lib/settings-two-level';

/*
  Settings → SubContract List
  2-level: Category (with Short Code) → Item (งานจ้างย่อย)
  Item code: SUB-[ShortCode]-NNNNN
*/

export const SUBCONTRACT_CATEGORIES = [
  { code:'SUBC-01', short:'STR', name:'งานโครงสร้าง',        desc:'ฐานราก เสา คาน', items:[
    { code:'SUB-STR-00001', name:'งานเสาเข็มเจาะ',           spec:'⌀60cm × 18m · รวมเหล็กเสริม', unit:'ต้น',         status:'Active' },
    { code:'SUB-STR-00002', name:'งานคอนกรีตเสา',             spec:'รวมไม้แบบ + เหล็กเสริม',     unit:'ลบ.ม.',       status:'Active' },
    { code:'SUB-STR-00003', name:'งานผูกเหล็กฐานราก',         spec:'รวมค่าแรง + ลวด',           unit:'ตัน',         status:'Active' },
  ] },
  { code:'SUBC-02', short:'BRK', name:'งานก่ออิฐ-ฉาบปูน',     desc:'ก่อ ฉาบ ตกแต่งผนัง', items:[
    { code:'SUB-BRK-00001', name:'ค่าแรงก่ออิฐมอญ',           spec:'รวมฉาบปูน 2 ด้าน',          unit:'ตร.ม.',       status:'Active' },
    { code:'SUB-BRK-00002', name:'ค่าแรงก่ออิฐมวลเบา',        spec:'รวมฉาบปูน 2 ด้าน',          unit:'ตร.ม.',       status:'Active' },
    { code:'SUB-BRK-00003', name:'งานฉาบเรียบ',                spec:'ผนังภายใน',                 unit:'ตร.ม.',       status:'Active' },
  ] },
  { code:'SUBC-03', short:'ROF', name:'งานหลังคา',             desc:'มุงและโครงหลังคา', items:[
    { code:'SUB-ROF-00001', name:'งานติดตั้งกระเบื้องหลังคา',  spec:'รวมโครงไม้',                unit:'ตร.ม.',       status:'Active' },
    { code:'SUB-ROF-00002', name:'งานติดตั้งเมทัลชีท',          spec:'รวมโครงเหล็ก',              unit:'ตร.ม.',       status:'Active' },
  ] },
  { code:'SUBC-04', short:'TIL', name:'งานพื้น-ผนัง',          desc:'ปูกระเบื้อง พื้นไม้', items:[
    { code:'SUB-TIL-00001', name:'ค่าแรงปูกระเบื้องพื้น',       spec:'รวมยาแนว',                  unit:'ตร.ม.',       status:'Active' },
    { code:'SUB-TIL-00002', name:'ค่าแรงปูกระเบื้องผนัง',       spec:'รวมยาแนว',                  unit:'ตร.ม.',       status:'Active' },
    { code:'SUB-TIL-00003', name:'ค่าแรงปูพื้นลามิเนต',         spec:'รวมรองพื้น',                unit:'ตร.ม.',       status:'Active' },
  ] },
  { code:'SUBC-05', short:'PNT', name:'งานสี',                  desc:'ทาภายในและภายนอก', items:[
    { code:'SUB-PNT-00001', name:'ค่าแรงทาสีภายใน',             spec:'รวมสี 2 รอบ + รองพื้น',     unit:'ตร.ม.',       status:'Active' },
    { code:'SUB-PNT-00002', name:'ค่าแรงทาสีภายนอก',             spec:'รวมสี 2 รอบ + รองพื้น',     unit:'ตร.ม.',       status:'Active' },
    { code:'SUB-PNT-00003', name:'งานพ่นสี Spray',                spec:'งานพิเศษ',                  unit:'ตร.ม.',       status:'Non-Active' },
  ] },
  { code:'SUBC-06', short:'ELE', name:'งานระบบไฟฟ้า',          desc:'เดินสาย ติดตั้งอุปกรณ์', items:[
    { code:'SUB-ELE-00001', name:'งานเดินท่อร้อยสาย',          spec:'PVC สีเหลือง ⌀20mm',         unit:'ม.',          status:'Active' },
    { code:'SUB-ELE-00002', name:'งานติดตั้งดวงโคม',             spec:'ทั่วไป · ติดเพดาน',         unit:'จุด',         status:'Active' },
  ] },
  { code:'SUBC-07', short:'SAN', name:'งานสุขาภิบาล',           desc:'ติดตั้งสุขภัณฑ์ ระบบน้ำ', items:[
    { code:'SUB-SAN-00001', name:'ติดตั้งโถสุขภัณฑ์',           spec:'รวมท่อต่อ',                  unit:'ชุด',         status:'Active' },
    { code:'SUB-SAN-00002', name:'งานเดินท่อน้ำดี PPR',          spec:'⌀1/2 นิ้ว',                 unit:'ม.',          status:'Active' },
  ] },
];

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
