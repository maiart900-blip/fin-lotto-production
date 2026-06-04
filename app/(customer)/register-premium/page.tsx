"use client";

import React, { useState } from "react";
import { Shield, Gift, Phone, ChevronRight } from "lucide-react";

export default function RegisterPremiumPage() {
  const [step, setStep] = useState(1);
  const [phoneNumber, setPhoneNumber] = useState("");

  // ระบบแป้นพิมพ์เสมือนจริง (Virtual Keypad) แบบเดียวกับหน้าจอ
  const handleKeyPress = (num: string) => {
    if (phoneNumber.length < 10) {
      setPhoneNumber((prev) => prev + num);
    }
  };

  const handleBackspace = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPhoneNumber("");
  };

  return (
    <div className="relative min-h-screen w-full bg-[#0a0a0c] text-slate-200 flex items-center justify-center overflow-hidden font-sans">
      
      {/* BACKGROUND GRAPHICS: แสงและมิติด้านหลังแบบเว็บราคาแพง */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1c1917]/30 via-[#0a0a0c] to-[#020203] z-0" />
      
      {/* เส้นแสงสีทองพาดผ่านตัวเว็บแบบ Dynamic */}
      <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[40%] bg-gradient-to-br from-amber-500/10 to-transparent blur-[120px] rounded-full rotate-12" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-tl from-amber-600/5 to-transparent blur-[150px] rounded-full" />

      <div className="relative w-full max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10 py-12">
        
        {/* ฝั่งซ้าย: BRANDING & PREMIUM IDENTITY */}
        <div className="lg:col-span-6 space-y-8 text-center lg:text-left hidden lg:block">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold tracking-wider uppercase animate-pulse">
              Premium Membership v2.0
            </div>
            <h1 className="text-5xl lg:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100">
              FIN LOTTO <span className="text-amber-500">P+</span>
            </h1>
            <p className="text-slate-400 text-lg max-w-md leading-relaxed">
              สัมผัสประสบการณ์ระดับ High-End แพลตฟอร์มสลากพรีเมียมที่ปลอดภัย มั่นคง และทันสมัยที่สุดในเอเชีย
            </p>
          </div>

          {/* ฟีเจอร์ความพรีเมียมด้านล่าง */}
          <div className="grid grid-cols-2 gap-4 max-w-md">
            <div className="p-4 rounded-xl bg-gradient-to-b from-white/5 to-white/[0.01] border border-white/10 backdrop-blur-md">
              <Shield className="w-6 h-6 text-amber-500 mb-2" />
              <h4 className="text-sm font-bold text-amber-200">ปลอดภัย 100%</h4>
              <p className="text-xs text-slate-500">ระบบรักษาความปลอดภัย 2FA</p>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-b from-white/5 to-white/[0.01] border border-white/10 backdrop-blur-md">
              <Gift className="w-6 h-6 text-amber-500 mb-2" />
              <h4 className="text-sm font-bold text-amber-200">โบนัสต้อนรับใหม่</h4>
              <p className="text-xs text-slate-500">สิทธิพิเศษระดับ VIP ทันที</p>
            </div>
          </div>
        </div>

        {/* ฝั่งขวา: REGISTER CARD (ถอดแบบภาพหน้าจอแต่ดีไซน์หรูขึ้น) */}
        <div className="lg:col-span-6 flex justify-center">
          <div className="w-full max-w-[480px] bg-gradient-to-b from-[#16161a] to-[#0f0f12] rounded-3xl p-8 border border-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.08)] backdrop-blur-xl">
            
            {/* หัวข้อฟอร์ม */}
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-2xl font-extrabold text-white tracking-wide uppercase">สมัครสมาชิก</h2>
              <p className="text-xs text-amber-500/70 tracking-widest uppercase font-medium">Lotto Agent Network</p>
              
              {/* STEPS INDICATOR */}
              <div className="flex items-center justify-center gap-3 pt-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${step === 1 ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-slate-800 text-slate-400'}`}>1</div>
                <div className="w-10 h-[2px] bg-slate-800" />
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step === 2 ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-400'}`}>2</div>
                <div className="w-10 h-[2px] bg-slate-800" />
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${step === 3 ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-400'}`}>3</div>
              </div>
            </div>

            {/* STEP 1: ยืนยันเบอร์โทรศัพท์ */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="bg-amber-500/5 rounded-2xl p-4 border border-amber-500/10 flex items-start gap-3">
                  <Phone className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">ยืนยันเบอร์โทรศัพท์</h3>
                    <p className="text-xs text-slate-400">ใช้สำหรับเข้าสู่ระบบและรับรหัส OTP เพื่อความปลอดภัย</p>
                  </div>
                </div>

                {/* ช่องแสดงตัวเลขเบอร์โทรศัพท์ */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 tracking-wider">เบอร์โทรศัพท์ของคุณ</label>
                  <div className="flex justify-between gap-1 bg-[#0d0d11] p-3 rounded-2xl border border-white/5 min-h-[58px] items-center">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-7 h-9 rounded-lg flex items-center justify-center text-lg font-black tracking-tight border transition-all duration-200 ${phoneNumber[i] ? 'border-amber-500 text-amber-400 bg-amber-500/5 shadow-[0_0_8px_rgba(245,158,11,0.2)]' : 'border-white/10 text-slate-600 bg-transparent'}`}
                      >
                        {phoneNumber[i] || "•"}
                      </div>
                    ))}
                  </div>
                </div>

                {/* VIRTUAL KEYPAD (แป้นพิมพ์หรูหรา ปุ่มกดชัดเจน) */}
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleKeyPress(num)}
                      className="h-14 rounded-xl bg-gradient-to-b from-white/[0.06] to-transparent border border-white/5 flex items-center justify-center text-xl font-bold hover:from-white/10 hover:border-white/20 active:scale-95 transition-all text-slate-200"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleClear}
                    className="h-14 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-sm font-medium hover:bg-red-500/10 hover:border-red-500/20 text-slate-400 hover:text-red-400 transition-all"
                  >
                    ลบทั้งหมด
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeyPress("0")}
                    className="h-14 rounded-xl bg-gradient-to-b from-white/[0.06] to-transparent border border-white/5 flex items-center justify-center text-xl font-bold hover:from-white/10 hover:border-white/20 active:scale-95 transition-all text-slate-200"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleBackspace}
                    className="h-14 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-sm font-medium hover:bg-amber-500/10 hover:border-amber-500/20 text-amber-500 transition-all"
                  >
                    ⌫
                  </button>
                </div>

                {/* ปุ่มส่งข้อมูลสีทองแบบ Gradient ไล่สีอลังการ */}
                <button
                  type="button"
                  disabled={phoneNumber.length !== 10}
                  onClick={() => setStep(2)}
                  className="w-full h-14 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-500 rounded-xl text-black font-extrabold text-base tracking-wide flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] disabled:opacity-30 disabled:pointer-events-none transition-all shadow-[0_4px_20px_rgba(245,158,11,0.25)]"
                >
                  ยืนยันเบอร์โทรศัพท์ <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* STEP 2 & 3 สามารถเพิ่มฟิลด์รหัสผ่านและข้อกำหนดเพิ่มเติมได้ที่นี่ */}
            {step === 2 && (
              <div className="text-center py-8 space-y-4">
                <p className="text-sm text-slate-400">ระบบจำลองขั้นตอนถัดไปสำหรับการตั้งค่าบัญชี</p>
                <button onClick={() => setStep(1)} className="text-xs text-amber-500 underline">ย้อนกลับ</button>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
