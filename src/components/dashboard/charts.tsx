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

export function AdherenceLineChart({
  data,
}: {
  data: { label: string; medication: number; meals: number; health: number }[];
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Wellbeing trends</CardTitle>
        <CardDescription>Completion rate across medication, meals, and health</CardDescription>
      </CardHeader>
      <CardContent className="h-[260px]">
        {data.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9DED7" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#5C6B64", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#5C6B64", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="medication" stroke="#1F4B45" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="meals" stroke="#5C8C6B" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="health" stroke="#E3A23C" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
        <p className="sr-only">
          Line chart of adherence percentages for medication, meals, and health over the selected period.
        </p>
      </CardContent>
    </Card>
  );
}

export function StatusPieChart({
  data,
  excludedCaption,
}: {
  data: { name: string; value: number; fill: string }[];
  /** e.g. "Excluded from this chart: 16 cancelled, 3 pending." */
  excludedCaption?: string;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Adherence composition</CardTitle>
        <CardDescription>
          Taken, delayed, and missed only — same universe as the adherence percentage
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[220px]">
          {data.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No scored check-ins in this period
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <ul className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {data.map((d) => (
            <li key={d.name} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: d.fill }} />
              {d.name} · {d.value}
            </li>
          ))}
        </ul>
        {excludedCaption ? (
          <p className="mt-2 text-xs text-muted-foreground">{excludedCaption}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function MealBarChart({
  data,
}: {
  data: { label: string; meals: number }[];
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Meal completion</CardTitle>
        <CardDescription>Daily meal check-in completion</CardDescription>
      </CardHeader>
      <CardContent className="h-[260px]">
        {data.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9DED7" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#5C6B64", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#5C6B64", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="meals" fill="#1F4B45" radius={[8, 8, 4, 4]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
