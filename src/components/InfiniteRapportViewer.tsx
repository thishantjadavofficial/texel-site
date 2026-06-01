'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Grid3X3, Move } from 'lucide-react';

interface InfiniteRapportViewerProps {
  imageUrl: string;
  title: string;
}

export default function InfiniteRapportViewer({ imageUrl, title }: InfiniteRapportViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [scale, setScale] = useState<number>(1.0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showJointLines, setShowJointLines] = useState<boolean>(true);

  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  // Load the pattern image
  useEffect(() => {
    setLoading(true);
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      setImage(img);
      setLoading(false);
      // Center the image initially
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        setOffset({
          x: (canvas.width - img.width) / 2,
          y: (canvas.height - img.height) / 2
        });
      }
    };
    img.onerror = () => {
      setLoading(false);
      console.error('Failed to load textile design preview image.');
    };
  }, [imageUrl]);

  // Handle resizing of the canvas
  const handleResize = useCallback(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Core render loop
  const render = useCallback(() => {
    if (!canvasRef.current || !image) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear with dark tech grid background
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, width, height);

    // Draw background grid lines (cyber style)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.save();
    
    // Apply panning translation and zoom scaling
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    const imgW = image.width;
    const imgH = image.height;

    // Calculate column and row ranges to tile infinitely but ONLY render visible ones (Optimization)
    const minCol = Math.floor(-offset.x / (imgW * scale)) - 1;
    const maxCol = Math.floor((width - offset.x) / (imgW * scale)) + 1;
    const minRow = Math.floor(-offset.y / (imgH * scale)) - 1;
    const maxRow = Math.floor((height - offset.y) / (imgH * scale)) + 1;

    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        const dx = col * imgW;
        const dy = row * imgH;
        ctx.drawImage(image, dx, dy, imgW, imgH);

        // Draw seam markers at the edges of the central tile and other tiles
        if (showJointLines) {
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)'; // Cyber purple
          ctx.lineWidth = 1.5 / scale; // Keep line thickness constant relative to viewport zoom
          ctx.strokeRect(dx, dy, imgW, imgH);
          
          // Draw high-visibility corners at the exact joint seam vertices
          ctx.fillStyle = '#3b82f6'; // Electric blue corners
          const dotSize = 4 / scale;
          ctx.fillRect(dx - dotSize/2, dy - dotSize/2, dotSize, dotSize);
        }
      }
    }

    ctx.restore();

    // HUD overlays drawn directly on top of canvas (2D screen space)
    if (showJointLines) {
      ctx.fillStyle = 'rgba(10, 10, 12, 0.7)';
      ctx.fillRect(16, height - 48, 260, 32);
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(16, height - 48, 260, 32);
      ctx.fillStyle = '#60a5fa';
      ctx.font = '11px monospace';
      ctx.fillText(`Rapport Joint: ${imgW}px × ${imgH}px • Seams Active`, 28, height - 28);
    }
  }, [image, offset, scale, showJointLines]);

  // Request Animation Frame trigger
  useEffect(() => {
    if (!loading && image) {
      render();
    }
  }, [render, loading, image]);

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Zoom anchored on mouse coordinates (imperative non-passive event listener)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const currentScale = scaleRef.current;
      const currentOffset = offsetRef.current;

      // Convert mouse to world coordinates before zooming
      const worldX = (mouseX - currentOffset.x) / currentScale;
      const worldY = (mouseY - currentOffset.y) / currentScale;

      const zoomIntensity = 0.1;
      let newScale = currentScale;
      if (e.deltaY < 0) {
        newScale = Math.min(currentScale * (1 + zoomIntensity), 6.0);
      } else {
        newScale = Math.max(currentScale * (1 - zoomIntensity), 0.15);
      }

      // Recalculate offsets to anchor zoom
      const newOffsetX = mouseX - worldX * newScale;
      const newOffsetY = mouseY - worldY * newScale;

      setScale(newScale);
      setOffset({ x: newOffsetX, y: newOffsetY });
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  // Toolbar zoom actions
  const adjustZoom = (multiplier: number) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    
    // Zoom centered on canvas center
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const worldX = (centerX - offset.x) / scale;
    const worldY = (centerY - offset.y) / scale;

    const newScale = Math.max(0.25, Math.min(scale * multiplier, 4.0));
    setOffset({
      x: centerX - worldX * newScale,
      y: centerY - worldY * newScale
    });
    setScale(newScale);
  };

  const resetViewport = () => {
    if (!canvasRef.current || !image) return;
    const canvas = canvasRef.current;
    setScale(1.0);
    setOffset({
      x: (canvas.width - image.width) / 2,
      y: (canvas.height - image.height) / 2
    });
  };

  return (
    <div ref={containerRef} className="relative w-full h-[550px] md:h-[650px] bg-[#0a0a0c] rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0c] z-10 space-y-4">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-purple-500/20"></div>
            <div className="absolute inset-0 rounded-full border-2 border-t-purple-500 animate-spin"></div>
          </div>
          <p className="text-white/60 font-mono text-xs uppercase tracking-widest animate-pulse">Loading Rapport Textile Master...</p>
        </div>
      )}

      {/* Tiling Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className={`w-full h-full cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`}
      />

      {/* Floating Instructions HUD */}
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg p-3 text-left max-w-[280px] pointer-events-none transition-all duration-300">
        <h4 className="text-white font-semibold text-xs tracking-wide uppercase font-mono text-purple-400 mb-1">{title}</h4>
        <div className="flex items-center gap-1.5 text-[10px] text-white/50 font-mono mt-2">
          <Move className="w-3.5 h-3.5 text-blue-400" />
          <span>Click & Drag to pan tiles infinitely</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-white/50 font-mono mt-1">
          <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
          <span>Scroll wheel / Pinch to Zoom</span>
        </div>
      </div>

      {/* Immersive HUD Controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-black/65 backdrop-blur-md border border-white/10 rounded-xl p-1.5 shadow-xl">
        <button
          onClick={() => adjustZoom(1.2)}
          className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => adjustZoom(0.8)}
          className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={resetViewport}
          className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          title="Reset Fit"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <div className="w-[1px] h-6 bg-white/10 mx-1"></div>
        <button
          onClick={() => setShowJointLines(!showJointLines)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
            showJointLines
              ? 'bg-purple-600/30 border border-purple-500/50 text-purple-200'
              : 'text-white/60 hover:text-white hover:bg-white/10 border border-transparent'
          }`}
          title="Toggle Rapport Joints"
        >
          <Grid3X3 className="w-3.5 h-3.5" />
          <span>Rapport Joint Overlay</span>
        </button>
      </div>
    </div>
  );
}
