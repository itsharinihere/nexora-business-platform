import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { CHART_COLORS, CHART_PALETTE } from '../../utils/constants';
import { formatNumber } from '../../utils/formatters';
import { ChartLegend, ChartTooltip, chartAxisProps, chartGridProps, currencyTick } from './ChartPrimitives';

const AXIS_HEIGHT = 24;

/** Adds a gradient fade under an area series. */
function AreaFill({ id, color }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={0.28} />
        <stop offset="100%" stopColor={color} stopOpacity={0.02} />
      </linearGradient>
    </defs>
  );
}

/**
 * Lead volume / value over time. `data` is the API's `{ labels, new_leads,
 * won_value, pipeline_value }` shape.
 */
export function LeadTrendChart({ data, height = 260, showWonValue = true }) {
  const series = [
    { key: 'new_leads', label: 'New leads', color: CHART_COLORS.brand },
    showWonValue ? { key: 'won_value', label: 'Won value', color: CHART_COLORS.success } : null,
  ].filter(Boolean);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <AreaFill id="nx-lead-trend" color={CHART_COLORS.brand} />
        <CartesianGrid {...chartGridProps} />
        <XAxis dataKey="label" {...chartAxisProps} height={AXIS_HEIGHT} minTickGap={16} />
        <YAxis
          {...chartAxisProps}
          width={44}
          tickFormatter={showWonValue ? currencyTick : (value) => formatNumber(value)}
        />
        <Tooltip content={<ChartTooltip formatter={(value, entry) => (entry.dataKey === 'won_value' ? `₹${formatNumber(value)}` : formatNumber(value))} />} cursor={{ stroke: CHART_COLORS.grid }} />
        {series.map((item) => (
          <Area
            key={item.key}
            type="monotone"
            dataKey={item.key}
            name={item.label}
            stroke={item.color}
            strokeWidth={2}
            fill={item.key === 'new_leads' ? 'url(#nx-lead-trend)' : item.color}
            fillOpacity={item.key === 'new_leads' ? 1 : 0.12}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Created vs completed tasks. */
export function TaskCompletionChart({ data, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2}>
        <CartesianGrid {...chartGridProps} />
        <XAxis dataKey="label" {...chartAxisProps} height={AXIS_HEIGHT} minTickGap={16} />
        <YAxis {...chartAxisProps} width={36} tickFormatter={(value) => formatNumber(value)} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: CHART_COLORS.grid, fillOpacity: 0.35 }} />
        <Bar dataKey="created" name="Created" fill={CHART_COLORS.brand} radius={[3, 3, 0, 0]} maxBarSize={16} />
        <Bar dataKey="completed" name="Completed" fill={CHART_COLORS.success} radius={[3, 3, 0, 0]} maxBarSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Opened vs resolved support tickets. */
export function SupportTrendChart({ data, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid {...chartGridProps} />
        <XAxis dataKey="label" {...chartAxisProps} height={AXIS_HEIGHT} minTickGap={16} />
        <YAxis {...chartAxisProps} width={36} tickFormatter={(value) => formatNumber(value)} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART_COLORS.grid }} />
        <Line
          type="monotone"
          dataKey="created"
          name="Opened"
          stroke={CHART_COLORS.warning}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="resolved"
          name="Resolved"
          stroke={CHART_COLORS.success}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * Funnel / status breakdown. Accepts either `{ counts, conversion_rate }` or a
 * plain `{ label: value }` list so it can serve both the funnel and the
 * status-count panels.
 */
export function BreakdownChart({ data, height = 260, donut = true, colors = CHART_PALETTE, formatter }) {
  const rows = Array.isArray(data)
    ? data
    : Object.entries(data?.counts ?? {}).map(([label, value]) => ({ label, value }));

  const total = rows.reduce((sum, row) => sum + (Number(row.value) || 0), 0);

  if (!donut) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
          <CartesianGrid {...chartGridProps} horizontal={false} vertical />
          <XAxis type="number" {...chartAxisProps} tickFormatter={(value) => formatNumber(value)} />
          <YAxis type="category" dataKey="label" {...chartAxisProps} width={88} />
          <Tooltip content={<ChartTooltip formatter={formatter} />} cursor={{ fill: CHART_COLORS.grid, fillOpacity: 0.35 }} />
          <Bar dataKey="value" name="Count" radius={[0, 3, 3, 0]} maxBarSize={18}>
            {rows.map((row, index) => (
              <Cell key={row.label} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={rows}
            dataKey="value"
            nameKey="label"
            innerRadius="58%"
            outerRadius="86%"
            paddingAngle={rows.length > 1 ? 2 : 0}
            stroke="none"
          >
            {rows.map((row, index) => (
              <Cell key={row.label} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip formatter={formatter} />} />
        </PieChart>
      </ResponsiveContainer>
      <ChartLegend
        className="mt-2 justify-center"
        items={rows.map((row, index) => ({
          label: `${row.label} (${total ? Math.round(((row.value || 0) / total) * 100) : 0}%)`,
          color: colors[index % colors.length],
        }))}
      />
    </div>
  );
}

/** Single-series bar list, used for source/industry comparisons. */
export function ComparisonChart({ data, height = 280, valueKey = 'total', labelKey = 'source', color = CHART_COLORS.brand, formatter }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid {...chartGridProps} />
        <XAxis dataKey={labelKey} {...chartAxisProps} height={AXIS_HEIGHT} interval={0} />
        <YAxis {...chartAxisProps} width={40} />
        <Tooltip content={<ChartTooltip formatter={formatter} />} cursor={{ fill: CHART_COLORS.grid, fillOpacity: 0.35 }} />
        <Bar dataKey={valueKey} name="Leads" fill={color} radius={[3, 3, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Cumulative customer growth. */
export function CustomerGrowthChart({ data, height = 260 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <AreaFill id="nx-customer-growth" color={CHART_COLORS.info} />
        <CartesianGrid {...chartGridProps} />
        <XAxis dataKey="label" {...chartAxisProps} height={AXIS_HEIGHT} minTickGap={16} />
        <YAxis {...chartAxisProps} width={40} tickFormatter={(value) => formatNumber(value)} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART_COLORS.grid }} />
        <Area
          type="monotone"
          dataKey="new_customers"
          name="New customers"
          stroke={CHART_COLORS.info}
          strokeWidth={2}
          fill="url(#nx-customer-growth)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}