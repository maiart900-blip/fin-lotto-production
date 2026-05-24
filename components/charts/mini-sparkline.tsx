'use client';

interface MiniSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  gradientId?: string;
  showDot?: boolean;
  trend?: 'up' | 'down' | 'neutral';
}

export function MiniSparkline({
  data,
  width = 80,
  height = 30,
  color = '#EAB308',
  gradientId = 'sparkline-gradient',
  showDot = true,
  trend,
}: MiniSparklineProps) {
  if (!data || data.length < 2) {
    return (
      <div 
        className="flex items-center justify-center text-[#94A3B8] text-xs"
        style={{ width, height }}
      >
        --
      </div>
    );
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  // Calculate trend if not provided
  const calculatedTrend = trend || (data[data.length - 1] > data[0] ? 'up' : data[data.length - 1] < data[0] ? 'down' : 'neutral');
  const trendColor = calculatedTrend === 'up' ? '#10B981' : calculatedTrend === 'down' ? '#EF4444' : color;

  // Generate SVG path
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * (width - 10) + 5;
    const y = height - 5 - ((value - min) / range) * (height - 15);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  
  // Area path for gradient fill
  const areaD = `${pathD} L ${width - 5},${height - 2} L 5,${height - 2} Z`;

  const lastPoint = points[points.length - 1].split(',');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={trendColor} stopOpacity={0.3} />
          <stop offset="100%" stopColor={trendColor} stopOpacity={0.05} />
        </linearGradient>
      </defs>
      
      {/* Area fill */}
      <path
        d={areaD}
        fill={`url(#${gradientId})`}
      />
      
      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={trendColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Last point dot */}
      {showDot && (
        <>
          <circle
            cx={parseFloat(lastPoint[0])}
            cy={parseFloat(lastPoint[1])}
            r={4}
            fill={trendColor}
            className="animate-pulse"
          />
          <circle
            cx={parseFloat(lastPoint[0])}
            cy={parseFloat(lastPoint[1])}
            r={2}
            fill="white"
          />
        </>
      )}
    </svg>
  );
}

// Trend badge component
export function TrendBadge({ 
  value, 
  previousValue,
  format = 'percent',
}: { 
  value: number; 
  previousValue: number;
  format?: 'percent' | 'number';
}) {
  if (previousValue === 0) return null;
  
  const change = ((value - previousValue) / previousValue) * 100;
  const isPositive = change > 0;
  const isNeutral = change === 0;

  const displayValue = format === 'percent' 
    ? `${isPositive ? '+' : ''}${change.toFixed(1)}%`
    : `${isPositive ? '+' : ''}${(value - previousValue).toLocaleString()}`;

  return (
    <span 
      className={`
        inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full
        ${isNeutral 
          ? 'bg-[#F1F5F9] text-[#64748B]' 
          : isPositive 
            ? 'bg-[#10B981]/10 text-[#10B981]' 
            : 'bg-[#EF4444]/10 text-[#EF4444]'
        }
      `}
    >
      {!isNeutral && (
        <svg 
          width="10" 
          height="10" 
          viewBox="0 0 10 10" 
          className={isPositive ? '' : 'rotate-180'}
        >
          <path 
            d="M5 2L8 6H2L5 2Z" 
            fill="currentColor"
          />
        </svg>
      )}
      {displayValue}
    </span>
  );
}
