import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Avatar } from '../../../components/ui/Avatar';
import { Card } from '../../../components/ui/Card';
import { SparklineChart } from '../../../components/charts/SparklineChart';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { formatPercent } from '../../../lib/format';
import type { PatrimoineRow } from '../../../hooks/usePatrimoineRows';

const MAX_CARDS = 10;

function MoverCard({ row, rank }: { row: PatrimoineRow; rank: number }) {
  const { formatCents } = useFormatCurrency();
  const gainPct = row.allTimeGainPct ?? row.ytdVariationPct;
  const gainAmount = row.allTimeGain ?? row.ytdVariation;
  const positive = (gainAmount ?? 0) >= 0;

  const body = (
    <Card className="flex w-[190px] shrink-0 flex-col gap-3 p-4">
      <div className="flex items-start justify-between">
        <Avatar name={row.name} src={row.logoUrl} size={28} />
        <span className="rounded-full bg-bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
          #{rank}
        </span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-text-primary">{row.name}</p>
        {row.subtitle && <p className="truncate text-xs text-text-muted">{row.subtitle}</p>}
      </div>
      <div>
        <p className="font-mono text-sm font-semibold text-text-primary">{formatCents(row.value)}</p>
        {gainPct !== null && (
          <p className={`font-mono text-xs ${positive ? 'text-accent-2' : 'text-accent-3'}`}>
            {gainAmount !== null && `${positive ? '+' : ''}${formatCents(gainAmount)} `}
            {positive ? '▲' : '▼'} {formatPercent(Math.abs(gainPct))}
          </p>
        )}
      </div>
      {row.sparkline.length > 1 && (
        <SparklineChart data={row.sparkline} height={36} />
      )}
    </Card>
  );

  return row.linkTo ? (
    <Link to={row.linkTo} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

export function TopMoversCarousel({ rows, isLoading }: { rows: PatrimoineRow[]; isLoading: boolean }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const ranked = [...rows]
    .filter((r) => !r.isLiability && r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, MAX_CARDS);

  function scrollBy(delta: number) {
    scrollerRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  }

  if (isLoading || ranked.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-muted">Ma performance</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => scrollBy(-220)}
            className="rounded-md p-1 text-text-muted hover:bg-bg-elevated hover:text-text-primary"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(220)}
            className="rounded-md p-1 text-text-muted hover:bg-bg-elevated hover:text-text-primary"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div ref={scrollerRef} className="flex gap-3 overflow-x-auto pb-1">
        {ranked.map((row, i) => (
          <MoverCard key={row.id} row={row} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}
