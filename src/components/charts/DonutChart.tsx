// 의존성 없는 순수 SVG 도넛 차트

import { fmtWon } from "@/lib/format";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  slices,
  size = 180,
  thickness = 28,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    return (
      <div className="py-6 text-center text-sm text-sand-500">데이터 없음</div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const innerR = r - thickness;
  const circ = 2 * Math.PI * r;

  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 md:flex-row md:items-start md:justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => {
          const len = (s.value / total) * circ;
          const stroke = thickness;
          const el = (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r - stroke / 2}
              fill="transparent"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          );
          offset += len;
          return el;
        })}
        {/* 중앙 마스크 */}
        <circle cx={cx} cy={cy} r={innerR} fill="#FAF7F2" />
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fontSize="11"
          fill="#8B7553"
        >
          총
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          fill="#544631"
        >
          {fmtWon(total)}
        </text>
      </svg>

      <ul className="space-y-1 text-xs">
        {slices.map((s, i) => {
          const pct = ((s.value / total) * 100).toFixed(1);
          return (
            <li key={i} className="flex items-center gap-2 tabular">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: s.color }}
              />
              <span className="text-sand-700">{s.label}</span>
              <span className="ml-auto font-semibold text-sand-800">
                {pct}%
              </span>
              <span className="text-sand-500">{fmtWon(s.value)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
