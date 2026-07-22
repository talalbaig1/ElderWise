"use client";

import {
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
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #D9DED7",
  background: "#FFFFFF",
  fontSize: 12,
};

export function ReportTrendChart({
  data,
  title = "Adherence over time",
  description = "Interactive completion rates across routines",
}: {
  data: { label: string; medication: number; meals: number; health: number }[];
  title?: string;
  description?: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#D9DED7" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#5C6B64", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: "#5C6B64", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="medication" name="Medication" stroke="#1F4B45" strokeWidth={2.5} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="meals" name="Meals" stroke="#5C8C6B" strokeWidth={2.5} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="health" name="Health" stroke="#E3A23C" strokeWidth={2.5} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function ReportStatusPie({
  data,
  title = "Status mix",
  description = "Hover a slice for counts",
}: {
  data: { name: string; value: number; fill: string }[];
  title?: string;
  description?: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="h-[280px]">
        {data.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No status data in this range
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        )}
        <ul className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {data.map((d) => (
            <li key={d.name} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: d.fill }} />
              {d.name} · {d.value}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ReportBarChart({
  data,
  title,
  description,
  valueLabel = "Value",
  maxDomain,
}: {
  data: { label: string; value: number }[];
  title: string;
  description?: string;
  valueLabel?: string;
  maxDomain?: number;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="h-[280px]">
        {data.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No chart data in this range
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9DED7" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#5C6B64", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                domain={maxDomain != null ? [0, maxDomain] : [0, "auto"]}
                tick={{ fill: "#5C6B64", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v as number, valueLabel]} />
              <Bar dataKey="value" name={valueLabel} fill="#1F4B45" radius={[8, 8, 4, 4]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
