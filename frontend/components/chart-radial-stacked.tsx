"use client"

import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from "recharts"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer } from "@/components/ui/chart"

export const description = "A radial chart with stacked sections"

type ChartRadialStackedProps = {
  avg: number
  min: number
  max: number
  optimalMin?: number
  optimalMax?: number
  cap?: number
  title?: string
  description?: string
  footerPrimary?: string
  footerSecondary?: string
  withinCard?: boolean
  single?: boolean
  barColor?: string
}

export function ChartRadialStacked({
  avg,
  min,
  max,
  optimalMin = 130,
  optimalMax = 170,
  cap = 220,
  title,
  description,
  footerPrimary,
  footerSecondary,
  withinCard = false,
  single = false,
  barColor = "#94a3b8",
}: ChartRadialStackedProps) {
  const below = Math.min(avg, optimalMin)
  const within = Math.max(0, Math.min(avg - optimalMin, optimalMax - optimalMin))
  const above = Math.max(0, avg - optimalMax)

  const chartData = single
    ? [{ value: avg }]
    : [{ bucket: "wpm", below, within, above }]

  const chartConfig: ChartConfig = single
    ? { value: { label: "WPM", color: barColor } }
    : {
        below: { label: "Below", color: "#94a3b8" },
        within: { label: "Optimal", color: "#10b981" },
        above: { label: "Above", color: "#ef4444" },
      }

  const ChartCore = (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square w-full max-w-[280px]">
      <RadialBarChart data={chartData as any} endAngle={180} innerRadius={80} outerRadius={130}>
        {single ? (
          <defs>
            <linearGradient id="wpmGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        ) : null}
        <PolarRadiusAxis tick={false} tickLine={false} axisLine={false} domain={[0, cap]} />
        {single ? (
          <RadialBar dataKey="value" background cornerRadius={5} fill="url(#wpmGradient)" className="stroke-transparent stroke-2" />
        ) : (
          <>
            <RadialBar dataKey="below" stackId="a" cornerRadius={5} fill="var(--color-below)" className="stroke-transparent stroke-2" />
            <RadialBar dataKey="within" stackId="a" cornerRadius={5} fill="var(--color-within)" className="stroke-transparent stroke-2" />
            <RadialBar dataKey="above" stackId="a" cornerRadius={5} fill="var(--color-above)" className="stroke-transparent stroke-2" />
          </>
        )}
        <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
          <Label
            content={({ viewBox }) => {
              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                return (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
                    <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 4} className="fill-foreground text-3xl font-bold">
                      {avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </tspan>
                    <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 18} className="fill-muted-foreground">
                      WPM
                    </tspan>
                  </text>
                )
              }
            }}
          />
        </PolarRadiusAxis>
      </RadialBarChart>
    </ChartContainer>
  )

  if (withinCard) {
    return ChartCore
  }

  return (
    <Card className="flex flex-col">
      {(title || description) && (
        <CardHeader className="items-center pb-0">
          {title ? <CardTitle>{title}</CardTitle> : null}
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
      )}
      <CardContent className="flex flex-1 items-center pb-0">{ChartCore}</CardContent>
      {(footerPrimary || footerSecondary) && (
        <CardFooter className="flex-col gap-2 text-sm">
          {footerPrimary ? <div className="leading-none font-medium">{footerPrimary}</div> : null}
          {footerSecondary ? <div className="text-muted-foreground leading-none">{footerSecondary}</div> : null}
        </CardFooter>
      )}
    </Card>
  )
}
