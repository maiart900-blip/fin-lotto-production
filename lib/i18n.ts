// =============================================================================
// INTERNATIONALIZATION (i18n) SYSTEM - Production Ready
// =============================================================================
// รองรับภาษา: ไทย (th), อังกฤษ (en), ลาว (lo), เวียดนาม (vi)
// Database-backed translations with caching
// =============================================================================

import { createClient } from '@/lib/supabase/server';
import { redis } from '@/lib/redis';

export type SupportedLocale = 'th' | 'en' | 'lo' | 'vi';
export type TranslationNamespace = 'common' | 'betting' | 'wallet' | 'admin' | 'error' | 'notification';

export interface Translation {
  key: string;
  locale: SupportedLocale;
  namespace: TranslationNamespace;
  value: string;
}

// Default locale
export const DEFAULT_LOCALE: SupportedLocale = 'th';

// Supported locales config
export const LOCALES: Record<SupportedLocale, { name: string; nativeName: string; flag: string }> = {
  th: { name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
  en: { name: 'English', nativeName: 'English', flag: '🇬🇧' },
  lo: { name: 'Lao', nativeName: 'ລາວ', flag: '🇱🇦' },
  vi: { name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
};

// Cache TTL in seconds
const CACHE_TTL = 3600; // 1 hour

// =============================================================================
// TRANSLATION SERVICE
// =============================================================================

class TranslationService {
  private cache: Map<string, string> = new Map();
  private supabase: Awaited<ReturnType<typeof createClient>> | null = null;

  private async getSupabase() {
    if (!this.supabase) {
      this.supabase = await createClient();
    }
    return this.supabase;
  }

  // Get cache key
  private getCacheKey(key: string, locale: SupportedLocale, namespace: TranslationNamespace): string {
    return `i18n:${locale}:${namespace}:${key}`;
  }

  // Get translation
  async t(
    key: string, 
    locale: SupportedLocale = DEFAULT_LOCALE, 
    namespace: TranslationNamespace = 'common',
    params?: Record<string, string | number>
  ): Promise<string> {
    const cacheKey = this.getCacheKey(key, locale, namespace);

    // Check memory cache first
    if (this.cache.has(cacheKey)) {
      return this.interpolate(this.cache.get(cacheKey)!, params);
    }

    // Check Redis cache
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        this.cache.set(cacheKey, cached as string);
        return this.interpolate(cached as string, params);
      }
    } catch (e) {
      // Redis error, continue to database
    }

    // Fetch from database
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from('translations')
      .select('value')
      .eq('key', key)
      .eq('locale', locale)
      .eq('namespace', namespace)
      .single();

    if (error || !data) {
      // Fallback to default locale
      if (locale !== DEFAULT_LOCALE) {
        return this.t(key, DEFAULT_LOCALE, namespace, params);
      }
      // Return key as fallback
      return key;
    }

    // Cache the translation
    this.cache.set(cacheKey, data.value);
    try {
      await redis.set(cacheKey, data.value, { ex: CACHE_TTL });
    } catch (e) {
      // Redis error, ignore
    }

    return this.interpolate(data.value, params);
  }

  // Get multiple translations
  async tMany(
    keys: string[], 
    locale: SupportedLocale = DEFAULT_LOCALE, 
    namespace: TranslationNamespace = 'common'
  ): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    
    // Check cache first
    const uncachedKeys: string[] = [];
    for (const key of keys) {
      const cacheKey = this.getCacheKey(key, locale, namespace);
      if (this.cache.has(cacheKey)) {
        result[key] = this.cache.get(cacheKey)!;
      } else {
        uncachedKeys.push(key);
      }
    }

    if (uncachedKeys.length === 0) {
      return result;
    }

    // Fetch uncached from database
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from('translations')
      .select('key, value')
      .in('key', uncachedKeys)
      .eq('locale', locale)
      .eq('namespace', namespace);

    if (!error && data) {
      for (const row of data) {
        result[row.key] = row.value;
        const cacheKey = this.getCacheKey(row.key, locale, namespace);
        this.cache.set(cacheKey, row.value);
      }
    }

    // Fill missing keys with the key itself
    for (const key of uncachedKeys) {
      if (!result[key]) {
        result[key] = key;
      }
    }

    return result;
  }

  // Get all translations for a namespace
  async getNamespace(
    namespace: TranslationNamespace, 
    locale: SupportedLocale = DEFAULT_LOCALE
  ): Promise<Record<string, string>> {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from('translations')
      .select('key, value')
      .eq('locale', locale)
      .eq('namespace', namespace);

    if (error) throw error;

    const result: Record<string, string> = {};
    for (const row of data || []) {
      result[row.key] = row.value;
    }

    return result;
  }

  // Add or update translation
  async setTranslation(
    key: string,
    value: string,
    locale: SupportedLocale,
    namespace: TranslationNamespace = 'common'
  ): Promise<void> {
    const supabase = await this.getSupabase();
    
    const { error } = await supabase
      .from('translations')
      .upsert({
        key,
        locale,
        namespace,
        value,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key,locale,namespace',
      });

    if (error) throw error;

    // Clear cache
    const cacheKey = this.getCacheKey(key, locale, namespace);
    this.cache.delete(cacheKey);
    try {
      await redis.del(cacheKey);
    } catch (e) {
      // Redis error, ignore
    }
  }

  // Bulk add translations
  async setTranslations(translations: Translation[]): Promise<void> {
    const supabase = await this.getSupabase();
    
    const { error } = await supabase
      .from('translations')
      .upsert(
        translations.map(t => ({
          key: t.key,
          locale: t.locale,
          namespace: t.namespace,
          value: t.value,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'key,locale,namespace' }
      );

    if (error) throw error;

    // Clear cache for affected keys
    for (const t of translations) {
      const cacheKey = this.getCacheKey(t.key, t.locale, t.namespace);
      this.cache.delete(cacheKey);
    }
  }

  // Delete translation
  async deleteTranslation(
    key: string,
    locale: SupportedLocale,
    namespace: TranslationNamespace = 'common'
  ): Promise<void> {
    const supabase = await this.getSupabase();
    
    const { error } = await supabase
      .from('translations')
      .delete()
      .eq('key', key)
      .eq('locale', locale)
      .eq('namespace', namespace);

    if (error) throw error;

    // Clear cache
    const cacheKey = this.getCacheKey(key, locale, namespace);
    this.cache.delete(cacheKey);
    try {
      await redis.del(cacheKey);
    } catch (e) {
      // Redis error, ignore
    }
  }

  // Clear all cache
  async clearCache(): Promise<void> {
    this.cache.clear();
    try {
      const keys = await redis.keys('i18n:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (e) {
      // Redis error, ignore
    }
  }

  // Interpolate params into translation
  private interpolate(text: string, params?: Record<string, string | number>): string {
    if (!params) return text;
    
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key]?.toString() || match;
    });
  }
}

// Singleton instance
let translationService: TranslationService | null = null;

export function getTranslationService(): TranslationService {
  if (!translationService) {
    translationService = new TranslationService();
  }
  return translationService;
}

// Shorthand function
export async function t(
  key: string,
  locale: SupportedLocale = DEFAULT_LOCALE,
  namespace: TranslationNamespace = 'common',
  params?: Record<string, string | number>
): Promise<string> {
  return getTranslationService().t(key, locale, namespace, params);
}

// =============================================================================
// CLIENT HOOK (for use in React components)
// =============================================================================

export function createI18nClient(locale: SupportedLocale = DEFAULT_LOCALE) {
  const service = getTranslationService();
  
  return {
    t: (key: string, namespace: TranslationNamespace = 'common', params?: Record<string, string | number>) =>
      service.t(key, locale, namespace, params),
    tMany: (keys: string[], namespace: TranslationNamespace = 'common') =>
      service.tMany(keys, locale, namespace),
    getNamespace: (namespace: TranslationNamespace) =>
      service.getNamespace(namespace, locale),
    locale,
  };
}

// =============================================================================
// DEFAULT TRANSLATIONS (Fallback)
// =============================================================================

export const DEFAULT_TRANSLATIONS: Record<SupportedLocale, Record<string, string>> = {
  th: {
    'app.name': 'FIN LOTTO P+',
    'app.tagline': 'เว็บหวยอันดับ 1 จ่ายจริง โอนไว 100%',
    'nav.home': 'หน้าแรก',
    'nav.bet': 'แทงหวย',
    'nav.results': 'ผลรางวัล',
    'nav.history': 'ประวัติ',
    'nav.wallet': 'กระเป๋าเงิน',
    'nav.profile': 'โปรไฟล์',
    'wallet.deposit': 'เติมเงิน',
    'wallet.withdraw': 'ถอนเงิน',
    'wallet.balance': 'ยอดเงินคงเหลือ',
    'bet.place': 'แทงหวย',
    'bet.confirm': 'ยืนยัน',
    'bet.cancel': 'ยกเลิก',
    'common.loading': 'กำลังโหลด...',
    'common.error': 'เกิดข้อผิดพลาด',
    'common.success': 'สำเร็จ',
    'common.save': 'บันทึก',
    'common.edit': 'แก้ไข',
    'common.delete': 'ลบ',
    'common.search': 'ค้นหา',
    'common.filter': 'กรอง',
    'common.export': 'ส่งออก',
  },
  en: {
    'app.name': 'FIN LOTTO P+',
    'app.tagline': 'No.1 Lottery - 100% Real Payouts',
    'nav.home': 'Home',
    'nav.bet': 'Bet',
    'nav.results': 'Results',
    'nav.history': 'History',
    'nav.wallet': 'Wallet',
    'nav.profile': 'Profile',
    'wallet.deposit': 'Deposit',
    'wallet.withdraw': 'Withdraw',
    'wallet.balance': 'Balance',
    'bet.place': 'Place Bet',
    'bet.confirm': 'Confirm',
    'bet.cancel': 'Cancel',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.save': 'Save',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.export': 'Export',
  },
  lo: {
    'app.name': 'FIN LOTTO P+',
    'app.tagline': 'ຫວຍອັນດັບ 1 ຈ່າຍແທ້ ໂອນໄວ 100%',
    'nav.home': 'ໜ້າຫຼັກ',
    'nav.bet': 'ແທງຫວຍ',
    'nav.results': 'ຜົນລາງວັນ',
    'nav.history': 'ປະຫວັດ',
    'nav.wallet': 'ກະເປົາເງິນ',
    'nav.profile': 'ໂປຣໄຟລ໌',
    'wallet.deposit': 'ຝາກເງິນ',
    'wallet.withdraw': 'ຖອນເງິນ',
    'wallet.balance': 'ຍອດເງິນ',
    'bet.place': 'ແທງຫວຍ',
    'bet.confirm': 'ຢືນຢັນ',
    'bet.cancel': 'ຍົກເລີກ',
    'common.loading': 'ກຳລັງໂຫລດ...',
    'common.error': 'ເກີດຂໍ້ຜິດພາດ',
    'common.success': 'ສຳເລັດ',
  },
  vi: {
    'app.name': 'FIN LOTTO P+',
    'app.tagline': 'Xổ số số 1 - Thanh toán 100%',
    'nav.home': 'Trang chủ',
    'nav.bet': 'Đặt cược',
    'nav.results': 'Kết quả',
    'nav.history': 'Lịch sử',
    'nav.wallet': 'Ví tiền',
    'nav.profile': 'Hồ sơ',
    'wallet.deposit': 'Nạp tiền',
    'wallet.withdraw': 'Rút tiền',
    'wallet.balance': 'Số dư',
    'bet.place': 'Đặt cược',
    'bet.confirm': 'Xác nhận',
    'bet.cancel': 'Hủy bỏ',
    'common.loading': 'Đang tải...',
    'common.error': 'Lỗi',
    'common.success': 'Thành công',
  },
};
