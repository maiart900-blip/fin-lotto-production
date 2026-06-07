import { NextResponse } from 'next/server';

// Thai PromptPay QR Code Generator
// Based on EMVCo QR Code Specification for PromptPay

function crc16(str: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
    crc &= 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatTLV(tag: string, value: string): string {
  const length = value.length.toString().padStart(2, '0');
  return `${tag}${length}${value}`;
}

function generatePromptPayPayload(target: string, amount?: number): string {
  // Determine if target is phone number or national ID
  const isPhoneNumber = target.length === 10 && target.startsWith('0');
  const isNationalId = target.length === 13;
  
  let formattedTarget = target;
  if (isPhoneNumber) {
    // Convert 0xxxxxxxxx to 66xxxxxxxxx
    formattedTarget = '66' + target.substring(1);
  }
  
  // AID for PromptPay
  const aid = '00' + '16' + 'A000000677010111';
  const targetType = isNationalId ? '02' : '01';
  const targetTLV = formatTLV(targetType, formattedTarget);
  
  // Merchant Account Information (Tag 29 for PromptPay)
  const merchantAccountInfo = aid + targetTLV;
  
  // Build payload
  let payload = '';
  payload += formatTLV('00', '01'); // Payload Format Indicator
  payload += formatTLV('01', amount ? '12' : '11'); // Point of Initiation (11=static, 12=dynamic)
  payload += formatTLV('29', merchantAccountInfo); // Merchant Account Info
  payload += formatTLV('53', '764'); // Currency (764 = THB)
  
  if (amount && amount > 0) {
    payload += formatTLV('54', amount.toFixed(2)); // Amount
  }
  
  payload += formatTLV('58', 'TH'); // Country Code
  payload += formatTLV('63', ''); // CRC placeholder
  
  // Calculate CRC
  const crcValue = crc16(payload);
  payload = payload.slice(0, -2) + crcValue;
  
  return payload;
}

function generateMerchantQRPayload(merchantId: string, amount?: number): string {
  // SCB Merchant QR (simplified format)
  // In production, this would use actual SCB API
  
  let payload = '';
  payload += formatTLV('00', '01'); // Payload Format Indicator
  payload += formatTLV('01', amount ? '12' : '11'); // Point of Initiation
  
  // Merchant Account Info with Merchant ID
  const merchantAccountInfo = formatTLV('00', 'A000000677010112') + formatTLV('02', merchantId);
  payload += formatTLV('30', merchantAccountInfo);
  
  payload += formatTLV('53', '764'); // Currency (THB)
  
  if (amount && amount > 0) {
    payload += formatTLV('54', amount.toFixed(2)); // Amount
  }
  
  payload += formatTLV('58', 'TH'); // Country Code
  payload += formatTLV('63', ''); // CRC placeholder
  
  // Calculate CRC
  const crcValue = crc16(payload);
  payload = payload.slice(0, -2) + crcValue;
  
  return payload;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, target, merchantId, amount, size = 300 } = body;

    let payload: string;
    
    if (type === 'promptpay') {
      if (!target) {
        return NextResponse.json({ error: 'กรุณาระบุเบอร์โทรหรือเลขบัตรประชาชน' }, { status: 400 });
      }
      // Clean target - remove dashes and spaces
      const cleanTarget = target.replace(/[-\s]/g, '');
      payload = generatePromptPayPayload(cleanTarget, amount);
    } else if (type === 'merchant_id') {
      if (!merchantId) {
        return NextResponse.json({ error: 'กรุณาระบุ Merchant ID' }, { status: 400 });
      }
      payload = generateMerchantQRPayload(merchantId, amount);
    } else {
      return NextResponse.json({ error: 'ประเภท QR ไม่ถูกต้อง' }, { status: 400 });
    }

    // Generate QR Code URL using public QR API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(payload)}&format=png&margin=10`;
    
    return NextResponse.json({
      success: true,
      payload,
      qrUrl,
      amount: amount || null,
    });
  } catch (err) {
    console.error('Generate QR error:', err);
    return NextResponse.json({ error: 'ไม่สามารถสร้าง QR Code ได้' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const target = searchParams.get('target');
  const merchantId = searchParams.get('merchantId');
  const amount = searchParams.get('amount');
  const size = searchParams.get('size') || '300';

  let payload: string;

  try {
    if (type === 'promptpay' && target) {
      const cleanTarget = target.replace(/[-\s]/g, '');
      payload = generatePromptPayPayload(cleanTarget, amount ? parseFloat(amount) : undefined);
    } else if (type === 'merchant_id' && merchantId) {
      payload = generateMerchantQRPayload(merchantId, amount ? parseFloat(amount) : undefined);
    } else {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(payload)}&format=png&margin=10`;

    return NextResponse.json({
      success: true,
      payload,
      qrUrl,
    });
  } catch (err) {
    console.error('Generate QR GET error:', err);
    return NextResponse.json({ error: 'ไม่สามารถสร้าง QR Code ได้' }, { status: 500 });
  }
}
