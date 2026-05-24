import { BetType } from '@/types/lottery';

export interface ParsedEntry {
  number: string;
  amount: number;
  betType: BetType;
  isFlip?: boolean;
  originalInput?: string;
}

export interface ParsedLine {
  entries: ParsedEntry[];
  error?: string;
  originalLine: string;
}

// Generate all permutations of a number string
function getPermutations(str: string): string[] {
  if (str.length <= 1) return [str];
  
  const result: Set<string> = new Set();
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const remaining = str.slice(0, i) + str.slice(i + 1);
    const perms = getPermutations(remaining);
    for (const perm of perms) {
      result.add(char + perm);
    }
  }
  
  return Array.from(result);
}

// Generate flip numbers (กลับ)
export function generateFlipNumbers(number: string): string[] {
  return getPermutations(number);
}

// Determine bet type based on number length and modifiers
function determineBetType(number: string, isTop: boolean, isFlip: boolean): BetType {
  const len = number.length;
  
  if (len === 1) {
    return isTop ? '1top' : '1bot';
  } else if (len === 2) {
    if (isFlip) return '2flip';
    return isTop ? '2top' : '2bot';
  } else if (len === 3) {
    if (isFlip) return '3flip';
    return isTop ? '3top' : '3tod';
  }
  
  return '3top'; // default
}

// Parse a single line of input
// Supported formats:
// - 12=50 or 12*50 or 12x50 (number=amount)
// - 12=50/30 (number=top/bottom)
// - !12=50 or 12!=50 (flip number)
// - 123บ50 or 123ล50 (บ=บน, ล=ล่าง)
export function parseLine(line: string): ParsedLine {
  const trimmed = line.trim();
  if (!trimmed) {
    return { entries: [], originalLine: line };
  }

  const entries: ParsedEntry[] = [];
  
  // Check for flip modifier
  const isFlip = trimmed.startsWith('!') || trimmed.includes('!');
  const cleanLine = trimmed.replace(/!/g, '');
  
  // Match patterns: number separator amount
  // Separators: = * x บ ล /
  const match = cleanLine.match(/^(\d+)\s*([=*xXบล])\s*(\d+)(?:\s*[/]\s*(\d+))?$/);
  
  if (!match) {
    // Try simple format: just number and amount separated by space
    const simpleMatch = cleanLine.match(/^(\d+)\s+(\d+)$/);
    if (simpleMatch) {
      const [, number, amount] = simpleMatch;
      const betType = determineBetType(number, true, isFlip);
      
      if (isFlip && number.length >= 2) {
        const flips = generateFlipNumbers(number);
        for (const flipNum of flips) {
          entries.push({
            number: flipNum,
            amount: parseInt(amount),
            betType: number.length === 2 ? '2top' : '3top',
            isFlip: true,
            originalInput: trimmed,
          });
        }
      } else {
        entries.push({
          number,
          amount: parseInt(amount),
          betType,
          originalInput: trimmed,
        });
      }
      
      return { entries, originalLine: line };
    }
    
    return { entries: [], error: 'รูปแบบไม่ถูกต้อง', originalLine: line };
  }
  
  const [, number, separator, amount1, amount2] = match;
  
  // Validate number length (1-3 digits)
  if (number.length < 1 || number.length > 3) {
    return { entries: [], error: 'เลขต้องมี 1-3 หลัก', originalLine: line };
  }
  
  const isTop = separator !== 'ล';
  const isBottom = separator === 'ล' || !!amount2;
  
  // Handle flip numbers
  if (isFlip && number.length >= 2) {
    const flips = generateFlipNumbers(number);
    const baseType = number.length === 2 ? '2top' : '3top';
    
    for (const flipNum of flips) {
      if (amount1) {
        entries.push({
          number: flipNum,
          amount: parseInt(amount1),
          betType: baseType,
          isFlip: true,
          originalInput: trimmed,
        });
      }
      if (amount2 && number.length === 2) {
        entries.push({
          number: flipNum,
          amount: parseInt(amount2),
          betType: '2bot',
          isFlip: true,
          originalInput: trimmed,
        });
      }
    }
  } else {
    // Normal entry
    if (isTop && amount1) {
      entries.push({
        number,
        amount: parseInt(amount1),
        betType: determineBetType(number, true, false),
        originalInput: trimmed,
      });
    }
    
    if (isBottom && (amount2 || separator === 'ล')) {
      entries.push({
        number,
        amount: parseInt(amount2 || amount1),
        betType: determineBetType(number, false, false),
        originalInput: trimmed,
      });
    }
  }
  
  return { entries, originalLine: line };
}

// Parse multiple lines
export function parseMultipleLines(text: string): ParsedLine[] {
  const lines = text.split('\n');
  return lines.map(line => parseLine(line));
}

// Calculate total from parsed entries
export function calculateTotal(parsedLines: ParsedLine[]): number {
  return parsedLines.reduce((sum, line) => {
    return sum + line.entries.reduce((lineSum, entry) => lineSum + entry.amount, 0);
  }, 0);
}

// Count total entries
export function countEntries(parsedLines: ParsedLine[]): number {
  return parsedLines.reduce((count, line) => count + line.entries.length, 0);
}

// Get all errors
export function getErrors(parsedLines: ParsedLine[]): string[] {
  return parsedLines
    .filter(line => line.error)
    .map(line => `"${line.originalLine}": ${line.error}`);
}
