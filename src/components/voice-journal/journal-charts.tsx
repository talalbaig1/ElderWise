"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #D9DED7",
  background: "#FFFFFF",
  fontSize: 12,
};

export function MoodTrendChart({
  data,
}: {
  data: { label: string; score: number | null; entries: number }[];
}) {
  const chartData = data.map((d) => ({
    ...d,
    score: d.score ?? undefined,
  }));

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Mood trend</CardTitle>
        <CardDescription>Average mood score over recent days (1–5)</CardDescription>
      </CardHeader>
      <CardContent className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1F4B45" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#1F4B45" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#D9DED7" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#5C6B64", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis domain={[1, 5]} tick={{ fill: "#5C6B64", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name) => {
                if (name === "score") return [value ?? "—", "Avg mood"];
                return [value as number, "Entries"];
              }}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="#1F4B45"
              strokeWidth={2.5}
              fill="url(#moodFill)"
              connectNulls={false}
              activeDot={{ r: 5 }}
            />
            <Line type="monotone" dataKey="entries" stroke="#E3A23C" strokeWidth={1.5} dot={false} hide />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function WeeklySummaryChart({
  data,
}: {
  data: { label: string; entries: number; avgScore: number; attention: number }[];
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Weekly summary</CardTitle>
        <CardDescription>Entries and attention flags by week</CardDescription>
      </CardHeader>
      <CardContent className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#D9DED7" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#5C6B64", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "#5C6B64", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="entries" name="Entries" fill="#1F4B45" radius={[8, 8, 4, 4]} />
            <Bar dataKey="attention" name="Attention" fill="#B8433A" radius={[8, 8, 4, 4]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function MonthlySummaryChart({
  data,
}: {
  data: { label: string; entries: number; avgScore: number; attention: number }[];
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Monthly summary</CardTitle>
        <CardDescription>Volume and average mood score by month</CardDescription>
      </CardHeader>
      <CardContent className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#D9DED7" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#5C6B64", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" allowDecimals={false} tick={{ fill: "#5C6B64", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 5]}
              tick={{ fill: "#5C6B64", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar yAxisId="left" dataKey="entries" name="Entries" fill="#5C8C6B" radius={[8, 8, 4, 4]} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgScore"
              name="Avg mood"
              stroke="#1F4B45"
              strokeWidth={2.5}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function MoodMixPie({
  data,
}: {
  data: { name: string; value: number; fill: string }[];
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Mood mix</CardTitle>
        <CardDescription>Distribution for the current filter</CardDescription>
      </CardHeader>
      <CardContent className="h-[260px]">
        {data.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No mood data yet
          </p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {data.map((d) => (
                <li key={d.name} className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.fill }} />
                  {d.name} · {d.value}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
