'use client';

interface BodyFatGaugeProps {
  percentage: number;
  sex: 'male' | 'female';
}

// Body fat categories by sex
const categories = {
  male: [
    { label: 'Essential', max: 5, color: '#EF4444' },
    { label: 'Athletic', max: 13, color: '#00FF87' },
    { label: 'Fitness', max: 17, color: '#3B82F6' },
    { label: 'Average', max: 24, color: '#FF6B35' },
    { label: 'Obese', max: 50, color: '#EF4444' },
  ],
  female: [
    { label: 'Essential', max: 13, color: '#EF4444' },
    { label: 'Athletic', max: 20, color: '#00FF87' },
    { label: 'Fitness', max: 24, color: '#3B82F6' },
    { label: 'Average', max: 31, color: '#FF6B35' },
    { label: 'Obese', max: 50, color: '#EF4444' },
  ],
};

export function BodyFatGauge({ percentage, sex }: BodyFatGaugeProps) {
  const cats = categories[sex];
  const current = cats.find((c) => percentage <= c.max) || cats[cats.length - 1];

  // Position on gauge (0-50% range → 0-100% of bar)
  const position = Math.min(100, (percentage / 50) * 100);

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-medium text-text-dim uppercase tracking-wider">Body Fat</span>
        <span className="text-xs font-medium" style={{ color: current.color }}>
          {current.label}
        </span>
      </div>

      <div className="text-center mb-4">
        <span className="font-display text-4xl font-bold" style={{ color: current.color }}>
          {percentage}
        </span>
        <span className="text-lg text-text-muted">%</span>
      </div>

      {/* Gauge bar */}
      <div className="relative h-2 rounded-full overflow-hidden mb-2">
        <div className="absolute inset-0 flex">
          {cats.map((cat, i) => {
            const prevMax = i > 0 ? cats[i - 1].max : 0;
            const width = ((cat.max - prevMax) / 50) * 100;
            return (
              <div
                key={cat.label}
                className="h-full"
                style={{ width: `${width}%`, backgroundColor: cat.color, opacity: 0.3 }}
              />
            );
          })}
        </div>
        {/* Marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-bg"
          style={{
            left: `${position}%`,
            transform: `translateX(-50%) translateY(-50%)`,
            backgroundColor: current.color,
          }}
        />
      </div>

      {/* Legend */}
      <div className="flex justify-between text-[10px] text-text-dim">
        {cats.slice(0, -1).map((cat) => (
          <span key={cat.label}>{cat.max}%</span>
        ))}
      </div>
    </div>
  );
}
