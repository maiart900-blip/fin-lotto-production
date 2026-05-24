import { ENV } from './env';
import { createClient } from './supabase/server';

// Email templates
const templates = {
  otp: (data: { otp: string }) => ({
    subject: `[FIN LOTTO] รหัส OTP ของคุณ: ${data.otp}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1D9BF0;">FIN LOTTO</h2>
        <p>รหัส OTP ของคุณคือ:</p>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
          ${data.otp}
        </div>
        <p>รหัสนี้จะหมดอายุใน 5 นาที</p>
        <p style="color: #666; font-size: 12px;">หากคุณไม่ได้ร้องขอรหัสนี้ กรุณาเพิกเฉยอีเมลนี้</p>
      </div>
    `,
  }),
  
  topupApproved: (amount: number) => ({
    subject: '[FIN LOTTO] การเติมเงินสำเร็จ',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10B981;">เติมเงินสำเร็จ!</h2>
        <p>ยอดเงิน <strong>${amount.toLocaleString()}</strong> บาท ถูกเพิ่มเข้าบัญชีของคุณแล้ว</p>
        <a href="${ENV.BASE_URL}/c" style="display: inline-block; background: #1D9BF0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 16px;">
          เข้าสู่ระบบ
        </a>
      </div>
    `,
  }),

  withdrawApproved: (amount: number) => ({
    subject: '[FIN LOTTO] การถอนเงินสำเร็จ',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10B981;">ถอนเงินสำเร็จ!</h2>
        <p>ยอดเงิน <strong>${amount.toLocaleString()}</strong> บาท ถูกโอนไปยังบัญชีของคุณแล้ว</p>
      </div>
    `,
  }),

  winNotification: (amount: number, lottery: string) => ({
    subject: '[FIN LOTTO] ยินดีด้วย! คุณถูกรางวัล',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #FFD700;">ยินดีด้วย!</h2>
        <p>คุณถูกรางวัล <strong>${lottery}</strong></p>
        <p style="font-size: 24px; color: #10B981; font-weight: bold;">${amount.toLocaleString()} บาท</p>
        <p>เงินรางวัลถูกเพิ่มเข้าบัญชีของคุณแล้ว</p>
      </div>
    `,
  }),

  securityAlert: (action: string, ip: string) => ({
    subject: '[FIN LOTTO] แจ้งเตือนความปลอดภัย',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #EF4444;">แจ้งเตือนความปลอดภัย</h2>
        <p>มีการเข้าสู่ระบบใหม่จากอุปกรณ์ที่ไม่รู้จัก:</p>
        <ul>
          <li>การกระทำ: ${action}</li>
          <li>IP Address: ${ip}</li>
          <li>เวลา: ${new Date().toLocaleString('th-TH')}</li>
        </ul>
        <p>หากไม่ใช่คุณ กรุณาเปลี่ยนรหัสผ่านทันที</p>
      </div>
    `,
  }),
};

// Send email (mock implementation - replace with real SMTP in production)
export async function sendEmail(
  to: string,
  template: keyof typeof templates,
  data: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    // Log email attempt
    const supabase = await createClient();
    try {
      await supabase.from('email_logs').insert({
        to_email: to,
        template,
        data,
        status: 'pending',
      });
    } catch {
      // Ignore if table doesn't exist
    }

    // Check if SMTP is configured
    if (!ENV.SMTP_HOST || !ENV.SMTP_USER) {
      console.log('[Email] SMTP not configured, skipping email:', { to, template });
      return { success: true }; // Return success in dev mode
    }

    // Get template
    const templateFn = templates[template];
    if (!templateFn) {
      return { success: false, error: 'Invalid template' };
    }

    // Generate email content
    const { subject, html } = (templateFn as (data: any) => { subject: string; html: string })(data);

    // In production, use nodemailer or similar
    // For now, just log
    console.log('[Email] Would send:', { to, subject });

    return { success: true };
  } catch (error) {
    console.error('[Email] Error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Email send failed' 
    };
  }
}

// Generate OTP
export function generateOTP(length: number = 6): string {
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += Math.floor(Math.random() * 10).toString();
  }
  return otp;
}

// Send OTP via email
export async function sendOTPEmail(
  email: string,
  purpose: 'login' | 'transaction' | 'recovery' = 'login'
): Promise<{ success: boolean; error?: string }> {
  const otp = generateOTP();
  
  // Store OTP in database (hashed)
  const supabase = await createClient();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await supabase.from('two_factor_codes').insert({
    code_hash: otp, // In production, hash this
    purpose,
    expires_at: expiresAt.toISOString(),
  });

  // Send email
  return sendEmail(email, 'otp', { otp });
}
