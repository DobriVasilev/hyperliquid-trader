"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  Time,
  SeriesMarker,
  ColorType,
} from "lightweight-charts";

export interface ChartCandle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ChartMarker {
  id: string;
  time: number;
  position: "aboveBar" | "belowBar" | "inBar";
  color: string;
  shape: "circle" | "square" | "arrowUp" | "arrowDown";
  text?: string;
  size?: number;
}

interface CandlestickChartProps {
  candles: ChartCandle[];
  markers?: ChartMarker[];
  onCandleClick?: (candle: ChartCandle, index: number) => void;
  onMarkerClick?: (marker: ChartMarker) => void;
  onChartClick?: (time: number, price: number) => void;
  onMarkerDrag?: (marker: ChartMarker, newTime: number, newPrice: number) => void;
  onMarkerContextMenu?: (marker: ChartMarker, x: number, y: number) => void;
  height?: number;
  className?: string;
}

export function CandlestickChart({
  candles,
  markers = [],
  onCandleClick,
  onMarkerClick,
  onChartClick,
  onMarkerDrag,
  onMarkerContextMenu,
  height = 500,
  className = "",
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Snap indicator state
  const [snapIndicator, setSnapIndicator] = useState<{
    price: number;
    y: number;
    level: string;
    color: string;
  } | null>(null);
  const [isModifierHeld, setIsModifierHeld] = useState(false);

  // Drag state
  const [draggingMarker, setDraggingMarker] = useState<ChartMarker | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0a0a0f" },
        textColor: "#d1d4dc",
      },
      grid: {
        vertLines: { color: "#1a1a2e" },
        horzLines: { color: "#1a1a2e" },
      },
      crosshair: {
        mode: 0, // Normal (free cursor movement)
        vertLine: {
          color: "#4a4a6a",
          width: 1,
          style: 2,
          labelBackgroundColor: "#2a2a4a",
        },
        horzLine: {
          color: "#4a4a6a",
          width: 1,
          style: 2,
          labelBackgroundColor: "#2a2a4a",
        },
      },
      rightPriceScale: {
        borderColor: "#2a2a4a",
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
        autoScale: true,
      },
      timeScale: {
        borderColor: "#2a2a4a",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    // v4 API - addCandlestickSeries
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderDownColor: "#ef5350",
      borderUpColor: "#26a69a",
      wickDownColor: "#ef5350",
      wickUpColor: "#26a69a",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    // Handle resize
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  // Update candle data
  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return;

    const chartData: CandlestickData<Time>[] = candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeriesRef.current.setData(chartData);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  // Update markers
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    const seriesMarkers: SeriesMarker<Time>[] = markers.map((m) => ({
      time: m.time as Time,
      position: m.position,
      color: m.color,
      shape: m.shape,
      text: m.text,
      size: m.size || 1,
    }));

    // Sort markers by time
    seriesMarkers.sort((a, b) => (a.time as number) - (b.time as number));

    candleSeriesRef.current.setMarkers(seriesMarkers);
  }, [markers]);

  // Track modifier key (Cmd/Ctrl) for snap mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        setIsModifierHeld(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) {
        setIsModifierHeld(false);
        setSnapIndicator(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Handle crosshair move for snap indicator
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;

    const chart = chartRef.current;
    const series = candleSeriesRef.current;

    const handleCrosshairMove = (param: { time?: Time; point?: { x: number; y: number }; seriesData?: Map<unknown, unknown> }) => {
      if (!isModifierHeld || !param.time || !param.point) {
        setSnapIndicator(null);
        return;
      }

      // Find the candle at this time
      const candle = candles.find((c) => c.time === param.time);
      if (!candle) {
        setSnapIndicator(null);
        return;
      }

      // Get mouse Y coordinate and find closest price level
      const y = param.point.y;
      const hoveredPrice = series.coordinateToPrice(y);
      if (hoveredPrice === null || hoveredPrice === undefined) {
        setSnapIndicator(null);
        return;
      }

      const priceLevels = [
        { price: candle.high, name: "HIGH", color: "#26a69a" },
        { price: candle.low, name: "LOW", color: "#ef5350" },
        { price: candle.open, name: "OPEN", color: "#9e9e9e" },
        { price: candle.close, name: "CLOSE", color: "#ffffff" },
      ];

      const closest = priceLevels.reduce((best, level) =>
        Math.abs(level.price - (hoveredPrice as number)) < Math.abs(best.price - (hoveredPrice as number)) ? level : best
      );

      const snapY = series.priceToCoordinate(closest.price);
      if (snapY !== null && snapY !== undefined) {
        setSnapIndicator({
          price: closest.price,
          y: snapY,
          level: closest.name,
          color: closest.color,
        });
      }
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
    };
  }, [candles, isModifierHeld]);

  // Find marker at position
  const findMarkerAtPosition = useCallback((x: number, y: number): ChartMarker | null => {
    if (!chartRef.current || !candleSeriesRef.current) return null;

    const timeScale = chartRef.current.timeScale();

    for (const marker of markers) {
      const markerX = timeScale.timeToCoordinate(marker.time as Time);
      if (markerX === null) continue;

      // X must be close (within 20px)
      if (Math.abs(markerX - x) > 20) continue;

      // Get the marker's candle to check vertical position
      const markerCandle = candles.find(c => c.time === marker.time);
      if (!markerCandle) continue;

      // Calculate marker's Y coordinate based on position
      let markerPrice: number;
      if (marker.position === "aboveBar") {
        markerPrice = markerCandle.high;
      } else if (marker.position === "belowBar") {
        markerPrice = markerCandle.low;
      } else {
        markerPrice = (markerCandle.high + markerCandle.low) / 2;
      }

      const markerY = candleSeriesRef.current.priceToCoordinate(markerPrice);
      if (markerY === null || markerY === undefined) continue;

      // Y must also be close (within 30px for marker area)
      if (Math.abs(markerY - y) < 30) {
        return marker;
      }
    }

    return null;
  }, [candles, markers]);

  // Handle mouse down for drag start
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !onMarkerDrag) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const marker = findMarkerAtPosition(x, y);
    if (marker) {
      event.preventDefault();
      setDraggingMarker(marker);
      setDragPosition({ x, y });
    }
  }, [findMarkerAtPosition, onMarkerDrag]);

  // Handle mouse move for dragging
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingMarker || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setDragPosition({ x, y });
  }, [draggingMarker]);

  // Handle mouse up for drag end
  const handleMouseUp = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingMarker || !dragPosition || !chartRef.current || !candleSeriesRef.current || !onMarkerDrag) {
      setDraggingMarker(null);
      setDragPosition(null);
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Get new time and price
    const timeScale = chartRef.current.timeScale();
    const newTime = timeScale.coordinateToTime(x);
    let newPrice = candleSeriesRef.current.coordinateToPrice(y);

    if (newTime !== null && newPrice !== null) {
      // Snap to candle level if modifier held
      let finalPrice = newPrice as number;
      if (isModifierHeld) {
        const candle = candles.find(c => c.time === newTime);
        if (candle) {
          const priceLevels = [candle.high, candle.low, candle.open, candle.close];
          finalPrice = priceLevels.reduce((closest, level) =>
            Math.abs(level - finalPrice) < Math.abs(closest - finalPrice) ? level : closest
          );
        }
      }

      onMarkerDrag(draggingMarker, newTime as number, finalPrice);
    }

    setDraggingMarker(null);
    setDragPosition(null);
  }, [draggingMarker, dragPosition, candles, isModifierHeld, onMarkerDrag]);

  // Handle context menu (right-click)
  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !onMarkerContextMenu) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const marker = findMarkerAtPosition(x, y);
    if (marker) {
      event.preventDefault();
      onMarkerContextMenu(marker, event.clientX, event.clientY);
    }
  }, [findMarkerAtPosition, onMarkerContextMenu]);

  // Handle click events
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // Don't handle click if we just finished dragging
      if (draggingMarker) return;

      if (!chartRef.current || !candleSeriesRef.current) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const shouldSnap = event.metaKey || event.ctrlKey;

      // Get time and price from coordinates
      const timeScale = chartRef.current.timeScale();
      const time = timeScale.coordinateToTime(x);
      const clickedPrice = candleSeriesRef.current.coordinateToPrice(y);

      if (time !== null && clickedPrice !== null) {
        // Find the candle at this time first
        const candleIndex = candles.findIndex((c) => c.time === time);
        const candle = candleIndex !== -1 ? candles[candleIndex] : null;

        // Check if clicked on a marker
        const clickedMarker = findMarkerAtPosition(x, y);

        if (clickedMarker && onMarkerClick) {
          onMarkerClick(clickedMarker);
          return;
        }

        // For candle clicks
        if (candle && onCandleClick) {
          const clickedPriceNum = clickedPrice as number;
          let finalPrice = clickedPriceNum;
          let snappedLevel = "free";

          // Only snap to price levels if Cmd/Ctrl is held
          if (shouldSnap) {
            const priceLevels = [
              { price: candle.high, name: "high" },
              { price: candle.low, name: "low" },
              { price: candle.open, name: "open" },
              { price: candle.close, name: "close" },
            ];

            const closestLevel = priceLevels.reduce((closest, level) => {
              return Math.abs(level.price - clickedPriceNum) < Math.abs(closest.price - clickedPriceNum)
                ? level
                : closest;
            });

            finalPrice = closestLevel.price;
            snappedLevel = closestLevel.name;
          }

          // Create modified candle with price info
          const snappedCandle = {
            ...candle,
            _snappedPrice: finalPrice,
            _snappedLevel: snappedLevel,
          };

          onCandleClick(snappedCandle as ChartCandle, candleIndex);
          return;
        }

        // General chart click
        if (onChartClick) {
          let finalPrice = clickedPrice as number;

          // Only snap if Cmd/Ctrl is held and we're on a candle
          if (shouldSnap && candle) {
            const priceLevels = [candle.high, candle.low, candle.open, candle.close];
            finalPrice = priceLevels.reduce((closest, level) =>
              Math.abs(level - (clickedPrice as number)) < Math.abs(closest - (clickedPrice as number)) ? level : closest
            );
          }

          onChartClick(time as number, finalPrice);
        }
      }
    },
    [candles, draggingMarker, findMarkerAtPosition, onCandleClick, onMarkerClick, onChartClick]
  );

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={`w-full ${className} ${draggingMarker ? "cursor-grabbing" : ""}`}
        style={{ height }}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (draggingMarker) {
            setDraggingMarker(null);
            setDragPosition(null);
          }
        }}
        onContextMenu={handleContextMenu}
      />

      {/* Snap indicator overlay */}
      {snapIndicator && isModifierHeld && (
        <>
          {/* Horizontal line at snap level */}
          <div
            className="absolute left-0 right-16 pointer-events-none"
            style={{
              top: snapIndicator.y,
              height: 2,
              backgroundColor: snapIndicator.color,
              opacity: 0.9,
              boxShadow: `0 0 8px ${snapIndicator.color}`,
            }}
          />
          {/* Snap level label */}
          <div
            className="absolute right-16 pointer-events-none px-2 py-1 text-xs font-mono font-bold rounded shadow-lg"
            style={{
              top: snapIndicator.y - 12,
              backgroundColor: snapIndicator.color,
              color: snapIndicator.color === "#ffffff" ? "#000" : "#fff",
            }}
          >
            {snapIndicator.level} ${snapIndicator.price.toFixed(2)}
          </div>
          {/* Snap mode indicator */}
          <div className="absolute top-2 left-2 px-2 py-1 bg-blue-600 rounded text-xs text-white font-medium pointer-events-none shadow-lg">
            MAGNET MODE
          </div>
        </>
      )}

      {/* Drag indicator */}
      {draggingMarker && dragPosition && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: dragPosition.x - 10,
            top: dragPosition.y - 10,
            width: 20,
            height: 20,
            backgroundColor: draggingMarker.color,
            borderRadius: "50%",
            opacity: 0.8,
            boxShadow: `0 0 10px ${draggingMarker.color}`,
          }}
        />
      )}
    </div>
  );
}
