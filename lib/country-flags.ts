// Country code to flag emoji mapping
export const COUNTRY_FLAGS: Record<string, string> = {
  // Asian Countries
  TH: '🇹🇭', // Thailand
  LA: '🇱🇦', // Laos
  VN: '🇻🇳', // Vietnam
  MY: '🇲🇾', // Malaysia
  SG: '🇸🇬', // Singapore
  HK: '🇭🇰', // Hong Kong
  CN: '🇨🇳', // China
  TW: '🇹🇼', // Taiwan
  JP: '🇯🇵', // Japan
  KR: '🇰🇷', // South Korea
  IN: '🇮🇳', // India
  ID: '🇮🇩', // Indonesia
  PH: '🇵🇭', // Philippines
  MM: '🇲🇲', // Myanmar
  KH: '🇰🇭', // Cambodia
  
  // Western Countries
  US: '🇺🇸', // USA
  GB: '🇬🇧', // UK
  DE: '🇩🇪', // Germany
  FR: '🇫🇷', // France
  AU: '🇦🇺', // Australia
  
  // Default
  WORLD: '🌐',
};

// Country names in Thai
export const COUNTRY_NAMES: Record<string, string> = {
  TH: 'ไทย',
  LA: 'ลาว',
  VN: 'เวียดนาม',
  MY: 'มาเลเซีย',
  SG: 'สิงคโปร์',
  HK: 'ฮ่องกง',
  CN: 'จีน',
  TW: 'ไต้หวัน',
  JP: 'ญี่ปุ่น',
  KR: 'เกาหลี',
  IN: 'อินเดีย',
  ID: 'อินโดนีเซีย',
  PH: 'ฟิลิปปินส์',
  MM: 'เมียนมา',
  KH: 'กัมพูชา',
  US: 'สหรัฐ',
  GB: 'อังกฤษ',
  DE: 'เยอรมัน',
  FR: 'ฝรั่งเศส',
  AU: 'ออสเตรเลีย',
  WORLD: 'สากล',
};

// Auto-detect country code from lottery name
export function detectCountryCode(lotteryName: string): string {
  const name = lotteryName.toLowerCase();
  
  // Thailand
  if (name.includes('รัฐบาล') || name.includes('ไทย') || name.includes('หุ้นไทย') || 
      name.includes('thai') || name.includes('thailand') || name.includes('กรุงเทพ') ||
      name.includes('set') || name.includes('mai')) {
    return 'TH';
  }
  
  // Laos
  if (name.includes('ลาว') || name.includes('laos') || name.includes('vientiane')) {
    return 'LA';
  }
  
  // Vietnam
  if (name.includes('ฮานอย') || name.includes('hanoi') || name.includes('vietnam') ||
      name.includes('เวียดนาม') || name.includes('โฮจิมินห์') || name.includes('ไซง่อน') ||
      name.includes('vn') || name.includes('saigon')) {
    return 'VN';
  }
  
  // Malaysia
  if (name.includes('มาเลย์') || name.includes('malay') || name.includes('magnum') ||
      name.includes('damacai') || name.includes('toto') || name.includes('กัวลา')) {
    return 'MY';
  }
  
  // Singapore
  if (name.includes('สิงคโปร์') || name.includes('singapore') || name.includes('sgp')) {
    return 'SG';
  }
  
  // Hong Kong
  if (name.includes('ฮั่งเส็ง') || name.includes('hongkong') || name.includes('hong kong') ||
      name.includes('hk') || name.includes('ฮ่องกง') || name.includes('hang seng')) {
    return 'HK';
  }
  
  // China
  if (name.includes('จีน') || name.includes('china') || name.includes('shanghai') ||
      name.includes('shenzhen') || name.includes('เซี่ยงไฮ้') || name.includes('ปักกิ่ง')) {
    return 'CN';
  }
  
  // Taiwan
  if (name.includes('ไต้หวัน') || name.includes('taiwan') || name.includes('taipei')) {
    return 'TW';
  }
  
  // Japan
  if (name.includes('นิเคอิ') || name.includes('nikkei') || name.includes('japan') ||
      name.includes('ญี่ปุ่น') || name.includes('โตเกียว') || name.includes('tokyo')) {
    return 'JP';
  }
  
  // Korea
  if (name.includes('เกาหลี') || name.includes('korea') || name.includes('kospi') ||
      name.includes('โซล') || name.includes('seoul')) {
    return 'KR';
  }
  
  // USA
  if (name.includes('ดาวโจนส์') || name.includes('dow') || name.includes('jones') ||
      name.includes('nasdaq') || name.includes('อเมริกา') || name.includes('usa') ||
      name.includes('us') || name.includes('ny') || name.includes('new york')) {
    return 'US';
  }
  
  // UK
  if (name.includes('อังกฤษ') || name.includes('uk') || name.includes('london') ||
      name.includes('ftse') || name.includes('britain')) {
    return 'GB';
  }
  
  // Germany
  if (name.includes('เยอรมัน') || name.includes('german') || name.includes('dax')) {
    return 'DE';
  }
  
  // India
  if (name.includes('อินเดีย') || name.includes('india') || name.includes('mumbai') ||
      name.includes('sensex') || name.includes('nifty')) {
    return 'IN';
  }
  
  // Indonesia
  if (name.includes('อินโด') || name.includes('indo') || name.includes('jakarta')) {
    return 'ID';
  }
  
  // Default
  return 'WORLD';
}

// Get flag emoji from lottery name
export function getFlagEmoji(lotteryName: string, countryCode?: string): string {
  const code = countryCode || detectCountryCode(lotteryName);
  return COUNTRY_FLAGS[code] || COUNTRY_FLAGS.WORLD;
}

// Get country name from code
export function getCountryName(countryCode: string): string {
  return COUNTRY_NAMES[countryCode] || 'ไม่ระบุ';
}

// Get all countries for dropdown
export function getAllCountries(): { code: string; name: string; flag: string }[] {
  return Object.keys(COUNTRY_FLAGS).map(code => ({
    code,
    name: COUNTRY_NAMES[code] || code,
    flag: COUNTRY_FLAGS[code],
  }));
}
