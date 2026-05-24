import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'

// ขนาดไฟล์สูงสุด 2MB
const MAX_FILE_SIZE = 2 * 1024 * 1024

// ประเภทไฟล์ที่อนุญาต
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

// ขนาดภาพที่แนะนำ
const RECOMMENDED_MIN_SIZE = 300 // px
const RECOMMENDED_MAX_SIZE = 1024 // px

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const baseUrl = new URL(request.url).origin

    if (!file) {
      return NextResponse.json({ 
        error: 'กรุณาเลือกไฟล์ QR Code',
        code: 'NO_FILE'
      }, { status: 400 })
    }

    // ตรวจสอบประเภทไฟล์
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ 
        error: 'รองรับเฉพาะไฟล์ PNG, JPG, JPEG หรือ WebP เท่านั้น',
        code: 'INVALID_TYPE',
        allowedTypes: ALLOWED_TYPES
      }, { status: 400 })
    }

    // ตรวจสอบขนาดไฟล์
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: `ไฟล์ใหญ่เกินไป ขนาดสูงสุด ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        code: 'FILE_TOO_LARGE',
        maxSize: MAX_FILE_SIZE,
        currentSize: file.size
      }, { status: 400 })
    }

    // สร้างชื่อไฟล์ unique
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const extension = file.name.split('.').pop() || 'png'
    const filename = `qr-codes/${timestamp}-${randomStr}.${extension}`

    // อัปโหลดไปยัง Vercel Blob
    const blob = await put(filename, file, {
      access: 'private',
      contentType: file.type,
    })

    // Convert to proxied URL for display
    const proxiedUrl = `${baseUrl}/api/image?pathname=${encodeURIComponent(blob.pathname)}`

    return NextResponse.json({ 
      success: true,
      url: proxiedUrl,
      originalUrl: blob.url,
      pathname: blob.pathname,
      size: file.size,
      type: file.type,
      message: 'อัปโหลด QR Code สำเร็จ'
    })
  } catch (error) {
    console.error('QR Upload error:', error)
    return NextResponse.json({ 
      error: 'อัปโหลดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
      code: 'UPLOAD_FAILED'
    }, { status: 500 })
  }
}

// GET - ข้อมูลข้อกำหนดการอัปโหลด
export async function GET() {
  return NextResponse.json({
    requirements: {
      maxFileSize: MAX_FILE_SIZE,
      maxFileSizeMB: MAX_FILE_SIZE / 1024 / 1024,
      allowedTypes: ALLOWED_TYPES,
      recommendedSize: {
        min: RECOMMENDED_MIN_SIZE,
        max: RECOMMENDED_MAX_SIZE,
        unit: 'px',
        description: `ขนาดแนะนำ ${RECOMMENDED_MIN_SIZE}x${RECOMMENDED_MIN_SIZE} ถึง ${RECOMMENDED_MAX_SIZE}x${RECOMMENDED_MAX_SIZE} พิกเซล`
      },
      tips: [
        'ใช้รูป QR Code ที่ชัดเจน ไม่เบลอ',
        'พื้นหลังควรเป็นสีขาวหรือสีอ่อน',
        'หลีกเลี่ยงรูปที่มีข้อความซ้อนทับ QR Code',
        'ขนาดไฟล์ไม่เกิน 2MB',
        'รองรับไฟล์ PNG, JPG, JPEG, WebP'
      ]
    }
  })
}
