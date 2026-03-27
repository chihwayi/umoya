import React, { useEffect, useRef, useState } from 'react';
import { Brain, ZoomIn, ZoomOut, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { ehrAxios } from '../services/api';
import { runtimeUrls } from '../config/runtime';

// Dynamic import of cornerstone to avoid SSR issues
let cs: any = null;
let csWADO: any = null;

async function initCornerstone() {
  if (cs) return;
  cs = await import('cornerstone-core');
  const parser = await import('dicom-parser');
  csWADO = await import('cornerstone-wado-image-loader');
  csWADO.external.cornerstone = cs;
  csWADO.external.dicomParser = parser;
  csWADO.configure({ useWebWorkers: false });
  cs.registerImageLoader('wadouri', csWADO.wadouri.loadImage);
}

interface HeatmapRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  findingLabel: string;
  color: string;
}

interface DicomViewerProps {
  orderId: string;
  studyUid: string;
  seriesUid: string;
  instanceUid: string;
  className?: string;
}

export const DicomViewer: React.FC<DicomViewerProps> = ({
  orderId,
  studyUid,
  seriesUid,
  instanceUid,
  className = '',
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [heatmapRegions, setHeatmapRegions] = useState<HeatmapRegion[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.4);
  const [error, setError] = useState<string | null>(null);

  // Fetch AI review / heatmap data
  useEffect(() => {
    ehrAxios.get(`/imaging/${orderId}/ai-review`)
      .then((res) => {
        const data = res.data as any;
        if (data.hasReview) {
          setHeatmapRegions(data.heatmapRegions ?? []);
        }
      })
      .catch(() => {});
  }, [orderId]);

  // Initialize cornerstone and load image
  useEffect(() => {
    if (!canvasRef.current) return;

    initCornerstone().then(() => {
      const element = canvasRef.current!;
      const baseUrl = (window as any).__EHR_API_BASE__ ?? runtimeUrls.ehrApi ?? '';
      const wadoUrl = `${baseUrl}/imaging/wado/${studyUid}/${seriesUid}/${instanceUid}`;
      const imageId = `wadouri:${wadoUrl}`;

      cs.enable(element);
      cs.loadImage(imageId)
        .then((image: any) => {
          const viewport = cs.getDefaultViewportForImage(element, image);
          cs.displayImage(element, image, viewport);
          setLoaded(true);
        })
        .catch(() => setError('Failed to load DICOM image'));
    });

    return () => {
      if (canvasRef.current && cs) {
        try { cs.disable(canvasRef.current); } catch {}
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyUid, seriesUid, instanceUid]);

  // Draw heatmap overlay
  useEffect(() => {
    if (!overlayCanvasRef.current || !loaded) return;
    const ctx = overlayCanvasRef.current.getContext('2d')!;
    ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);

    if (!showHeatmap) return;

    heatmapRegions.forEach((region) => {
      const hex = region.color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);

      ctx.fillStyle = `rgba(${r},${g},${b},${heatmapOpacity * region.confidence})`;
      ctx.fillRect(region.x, region.y, region.width, region.height);

      ctx.strokeStyle = region.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(region.x, region.y, region.width, region.height);

      ctx.fillStyle = region.color;
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(
        `${region.findingLabel} (${Math.round(region.confidence * 100)}%)`,
        region.x + 4,
        region.y - 4,
      );
    });
  }, [heatmapRegions, showHeatmap, heatmapOpacity, loaded]);

  const handleZoom = (direction: 'in' | 'out') => {
    if (!canvasRef.current || !cs) return;
    const vp = cs.getViewport(canvasRef.current);
    vp.scale *= direction === 'in' ? 1.25 : 0.8;
    cs.setViewport(canvasRef.current, vp);
  };

  const handleReset = () => {
    if (!canvasRef.current || !cs) return;
    cs.reset(canvasRef.current);
  };

  return (
    <div className={`bg-black rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-700">
        <Brain className="h-4 w-4 text-purple-400" />
        <span className="text-xs font-medium text-gray-300">DICOM Viewer</span>

        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => handleZoom('in')} className="p-1 text-gray-400 hover:text-white rounded">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button onClick={() => handleZoom('out')} className="p-1 text-gray-400 hover:text-white rounded">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button onClick={handleReset} className="p-1 text-gray-400 hover:text-white rounded">
            <RotateCcw className="h-4 w-4" />
          </button>

          {heatmapRegions.length > 0 && (
            <>
              <div className="w-px h-4 bg-gray-600 mx-1" />
              <button
                onClick={() => setShowHeatmap(!showHeatmap)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${showHeatmap ? 'bg-purple-600 text-white' : 'text-gray-400'}`}
              >
                {showHeatmap ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                AI Heatmap
              </button>
              {showHeatmap && (
                <input
                  type="range"
                  min={0.1}
                  max={0.8}
                  step={0.05}
                  value={heatmapOpacity}
                  onChange={(e) => setHeatmapOpacity(Number(e.target.value))}
                  className="w-20 accent-purple-500"
                  title="Heatmap opacity"
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Viewer canvas area */}
      <div className="relative" style={{ minHeight: 512 }}>
        {error ? (
          <div className="flex items-center justify-center h-64 text-red-400 text-sm">
            {error}
          </div>
        ) : (
          <>
            <div
              ref={canvasRef}
              className="w-full"
              style={{ minHeight: 512 }}
            />
            {/* Heatmap overlay canvas — same pixel dimensions as viewer */}
            <canvas
              ref={overlayCanvasRef}
              width={512}
              height={512}
              className="absolute inset-0 pointer-events-none"
              style={{ opacity: showHeatmap ? 1 : 0 }}
            />
          </>
        )}

        {!loaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <p className="text-gray-400 text-sm animate-pulse">Loading DICOM image...</p>
          </div>
        )}
      </div>

      {/* Finding legend */}
      {showHeatmap && heatmapRegions.length > 0 && (
        <div className="px-3 py-2 bg-gray-900 flex flex-wrap gap-3">
          {heatmapRegions.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-gray-300">
              <span
                className="inline-block w-3 h-3 rounded-sm border border-white border-opacity-30"
                style={{ backgroundColor: r.color, opacity: 0.8 }}
              />
              {r.findingLabel}
              <span className="text-gray-500">{Math.round(r.confidence * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
