'use client';

/**
 * Professional Betting Input Parser
 * Supports shorthand syntax for fast entry
 * 
 * Examples:
 * "123 x 100 x 50" -> 3ตัวบน 100, โต๊ด 50
 * "12 x 100 r" -> 12, 21 ตัวละ 100
 * "5 r19" -> 19 ประตู: 05,15,25,35,45,50,51,52,53,54,55,56,57,58,59
 * "12 x 50 x 30" -> 2ตัวบน 50, 2ตัวล่าง 30
 * "123=100" -> 3ตัวบน 100
 * "12*50*30" -> 2ตัวบน 50, 2ตัวล่าง 30
 */

export interface ParsedBet {
  number: string;
  betType: '2top' | '2bot' | '3top' | '3tod' | '1top' | '1bot';
  amount: number;
}

export interface ParseResult {
  success: boolean;
  bets: ParsedBet[];
  error?: string;
  rawInput: string;
}

// Generate all permutations of 2 digits
function generateFlip2(num: string): string[] {
  if (num.length !== 2) return [num];
  const results = new Set<string>();
  results.add(num);
  results.add(num[1] + num[0]);
  return Array.from(results);
}

// Generate all permutations of 3 digits (for โต๊ด)
function generateFlip3(num: string): string[] {
  if (num.length !== 3) return [num];
  const results = new Set<string>();
  const [a, b, c] = num.split('');
  results.add(a + b + c);
  results.add(a + c + b);
  results.add(b + a + c);
  results.add(b + c + a);
  results.add(c + a + b);
  results.add(c + b + a);
  return Array.from(results);
}

// Generate 19 ประตู (running numbers with a digit)
function generate19Door(digit: string): string[] {
  const results: string[] = [];
  for (let i = 0; i <= 9; i++) {
    results.push(digit + i.toString()); // e.g., 50, 51, 52...
    if (i.toString() !== digit) {
      results.push(i.toString() + digit); // e.g., 05, 15, 25...
    }
  }
  return [...new Set(results)].sort();
}

// Tokenize input
function tokenize(input: string): string[] {
  // Normalize separators
  let normalized = input
    .replace(/\s+/g, ' ')
    .replace(/[=*]/g, 'x')
    .trim();
  
  return normalized.split(' ').filter(t => t.length > 0);
}

// Parse a single line of input
export function parseBetInput(input: string): ParseResult {
  const rawInput = input.trim();
  if (!rawInput) {
    return { success: false, bets: [], error: 'กรุณากรอกข้อมูล', rawInput };
  }

  const tokens = tokenize(rawInput);
  const bets: ParsedBet[] = [];

  try {
    // Check for 19 ประตู pattern: "5 r19" or "5r19"
    const door19Match = rawInput.match(/^(\d)\s*r\s*19$/i);
    if (door19Match) {
      const digit = door19Match[1];
      const numbers = generate19Door(digit);
      // Need amount - check if there's an amount specified
      return {
        success: true,
        bets: numbers.map(num => ({
          number: num,
          betType: '2top' as const,
          amount: 0, // Amount to be filled by user
        })),
        rawInput,
      };
    }

    // Check for flip pattern: "12 x 100 r" or "12x100r"
    const flipMatch = rawInput.match(/^(\d{2,3})\s*[x*=]\s*(\d+)\s*r$/i);
    if (flipMatch) {
      const num = flipMatch[1];
      const amount = parseInt(flipMatch[2]);
      const flipped = num.length === 2 ? generateFlip2(num) : generateFlip3(num);
      const betType = num.length === 2 ? '2top' : '3top';
      
      return {
        success: true,
        bets: flipped.map(n => ({
          number: n,
          betType: betType as '2top' | '3top',
          amount,
        })),
        rawInput,
      };
    }

    // Check for 3-digit pattern: "123 x 100 x 50" (บน + โต๊ด)
    const threeDigitMatch = rawInput.match(/^(\d{3})\s*[x*=]\s*(\d+)\s*[x*=]\s*(\d+)$/);
    if (threeDigitMatch) {
      const num = threeDigitMatch[1];
      const amountTop = parseInt(threeDigitMatch[2]);
      const amountTod = parseInt(threeDigitMatch[3]);
      
      const result: ParsedBet[] = [];
      if (amountTop > 0) {
        result.push({ number: num, betType: '3top', amount: amountTop });
      }
      if (amountTod > 0) {
        // Generate all permutations for โต๊ด
        generateFlip3(num).forEach(n => {
          result.push({ number: n, betType: '3tod', amount: amountTod });
        });
      }
      
      return { success: true, bets: result, rawInput };
    }

    // Check for 2-digit pattern: "12 x 50 x 30" (บน + ล่าง)
    const twoDigitMatch = rawInput.match(/^(\d{2})\s*[x*=]\s*(\d+)\s*[x*=]\s*(\d+)$/);
    if (twoDigitMatch) {
      const num = twoDigitMatch[1];
      const amountTop = parseInt(twoDigitMatch[2]);
      const amountBot = parseInt(twoDigitMatch[3]);
      
      const result: ParsedBet[] = [];
      if (amountTop > 0) {
        result.push({ number: num, betType: '2top', amount: amountTop });
      }
      if (amountBot > 0) {
        result.push({ number: num, betType: '2bot', amount: amountBot });
      }
      
      return { success: true, bets: result, rawInput };
    }

    // Check for simple pattern: "123 x 100" or "12 x 50"
    const simpleMatch = rawInput.match(/^(\d{1,3})\s*[x*=]\s*(\d+)$/);
    if (simpleMatch) {
      const num = simpleMatch[1];
      const amount = parseInt(simpleMatch[2]);
      
      let betType: ParsedBet['betType'];
      if (num.length === 1) {
        betType = '1top';
      } else if (num.length === 2) {
        betType = '2top';
      } else {
        betType = '3top';
      }
      
      return {
        success: true,
        bets: [{ number: num, betType, amount }],
        rawInput,
      };
    }

    // Check for multiple numbers with same amount: "12,13,14 x 100"
    const multiMatch = rawInput.match(/^([\d,]+)\s*[x*=]\s*(\d+)$/);
    if (multiMatch) {
      const numbers = multiMatch[1].split(',').map(n => n.trim()).filter(n => n.length > 0);
      const amount = parseInt(multiMatch[2]);
      
      const result: ParsedBet[] = [];
      numbers.forEach(num => {
        let betType: ParsedBet['betType'];
        if (num.length === 1) {
          betType = '1top';
        } else if (num.length === 2) {
          betType = '2top';
        } else if (num.length === 3) {
          betType = '3top';
        } else {
          return; // Skip invalid numbers
        }
        result.push({ number: num, betType, amount });
      });
      
      return { success: true, bets: result, rawInput };
    }

    // If no pattern matches, try to parse as just a number
    const justNumber = rawInput.match(/^(\d{1,3})$/);
    if (justNumber) {
      const num = justNumber[1];
      let betType: ParsedBet['betType'];
      if (num.length === 1) {
        betType = '1top';
      } else if (num.length === 2) {
        betType = '2top';
      } else {
        betType = '3top';
      }
      
      return {
        success: true,
        bets: [{ number: num, betType, amount: 0 }],
        rawInput,
      };
    }

    return { success: false, bets: [], error: 'รูปแบบไม่ถูกต้อง', rawInput };
  } catch (err) {
    return { success: false, bets: [], error: 'เกิดข้อผิดพลาดในการ parse', rawInput };
  }
}

// Parse multiple lines
export function parseMultipleInputs(inputs: string[]): ParseResult[] {
  return inputs.map(input => parseBetInput(input));
}

// Format bet type to Thai
export function formatBetType(betType: ParsedBet['betType']): string {
  const labels: Record<string, string> = {
    '2top': '2 ตัวบน',
    '2bot': '2 ตัวล่าง',
    '3top': '3 ตัวบน',
    '3tod': '3 ตัวโต๊ด',
    '1top': 'วิ่งบน',
    '1bot': 'วิ่งล่าง',
  };
  return labels[betType] || betType;
}

// Calculate total from parsed bets
export function calculateTotal(bets: ParsedBet[]): number {
  return bets.reduce((sum, bet) => sum + bet.amount, 0);
}

// Group bets by type for display
export function groupBetsByType(bets: ParsedBet[]): Record<string, ParsedBet[]> {
  const grouped: Record<string, ParsedBet[]> = {};
  bets.forEach(bet => {
    if (!grouped[bet.betType]) {
      grouped[bet.betType] = [];
    }
    grouped[bet.betType].push(bet);
  });
  return grouped;
}
