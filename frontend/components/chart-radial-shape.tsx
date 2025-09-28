"use client"
import {
  Label,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer } from "@/components/ui/chart"

export const description = "A radial chart with a custom shape"

type ChartRadialShapeProps = {
  value: number
  caption?: string
  title?: string
  description?: string
  footerPrimary?: string
  footerSecondary?: string
  color?: string
  valueUnit?: string
  endAngle?: number
  innerRadius?: number
  outerRadius?: number
  withinCard?: boolean
}

export function ChartRadialShape({
  value,
  caption = "Value",
  title,
  description,
  footerPrimary,
  footerSecondary,
  color = "var(--chart-2)",
  valueUnit,
  endAngle = 100,
  innerRadius = 80,
  outerRadius = 140,
  withinCard = false,
}: ChartRadialShapeProps) {
  const chartData = [{ metric: value, fill: "var(--color-metric)" }]

  const chartConfig = {
    metric: { label: caption, color },
  } satisfies ChartConfig

  const ChartCore = (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[250px]">
      <RadialBarChart data={chartData} endAngle={endAngle} innerRadius={innerRadius} outerRadius={outerRadius}>
        <PolarGrid
          gridType="circle"
          radialLines={false}
          stroke="none"
          className="first:fill-muted last:fill-background"
          polarRadius={[86, 74]}
        />
        <RadialBar dataKey="metric" background />
        <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
          <Label
            content={({ viewBox }) => {
              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                return (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-4xl font-bold">
                      {typeof value === "number"
                        ? `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${valueUnit ?? ""}`
                        : "--"}
                    </tspan>
                    <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground">
                      {caption}
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
      <CardContent className="flex-1 pb-0">{ChartCore}</CardContent>
      {(footerPrimary || footerSecondary) && (
        <CardFooter className="flex-col gap-2 text-sm">
          {footerPrimary ? (
            <div className="flex items-center gap-2 leading-none font-medium">{footerPrimary}</div>
          ) : null}
          {footerSecondary ? (
            <div className="text-muted-foreground leading-none">{footerSecondary}</div>
          ) : null}
        </CardFooter>
      )}
    </Card>
  )
}
