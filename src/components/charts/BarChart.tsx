// 의존성 없는 순수 SVG 막대 차트

import { fmtWonShort } from "@/lib/format";

export interface BarDatum {
  label: string;
  value: number;
}

export function BarChart({
  data,
  height = 160,
  color = "#A26F54",
}: {
  data: BarDatum[];
  height?: number;
  color?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-sand-500">데이터 없음</div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = 24;
  const gap = 6;
  const padX = 16;
  const padY = 24;
  const innerH = height - padY * 2;
  const totalW = padX * 2 + data.length * (barW + gap);

  return (
    <div className="overflow-x-auto">
      <svg
        width={totalW}
        height={height}
        viewBox={`0 0 ${totalW} ${height}`}
        className="block"
      >
        {data.map((d, i) => {
          const h = (d.value / max) * innerH;
          const x = padX + i * (barW + gap);
          const y = padY + innerH - h;
          return (
            <g key={i}>
              {d.value > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 4}
                  fontSize="9"
                  textAnchor="middle"
                  fill="#6E5C42"
                >
                  {fmtWonShort(d.value)}
                </text>
              )}
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={3}
                fill={color}
                opacity={d.value === 0 ? 0.15 : 0.85}
              />
              <text
                x={x + barW / 2}
                y={height - 6}
                fontSize="9"
                textAnchor="middle"
                fill="#8B7553"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
