import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as cornerstone from 'cornerstone-core';
import * as cornerstoneTools from 'cornerstone-tools';
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import * as cornerstoneMath from 'cornerstone-math';
import dicomParser from 'dicom-parser';
import Hammer from 'hammerjs';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  Minimize2,
  Move,
  Pause,
  Play,
  RefreshCcw,
  Ruler,
  Sparkles,
  ZoomIn,
} from 'lucide-react';

const toolDefinitions = [
  { id: 'Wwwc', label: 'Window/Level', icon: Maximize2 },
  { id: 'Pan', label: 'Pan', icon: Move },
  { id: 'Zoom', label: 'Zoom', icon: ZoomIn },
  { id: 'Length', label: 'Measure', icon: Ruler },
];

let cornerstoneInitialized = false;

const initializeCornerstone = () => {
  if (cornerstoneInitialized) return;

  cornerstoneTools.external.cornerstone = cornerstone;
  cornerstoneTools.external.cornerstoneMath = cornerstoneMath;
  cornerstoneTools.external.Hammer = Hammer;
  cornerstoneTools.init({
    showSVGCursors: true,
  });

  cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
  cornerstoneWADOImageLoader.external.cornerstoneMath = cornerstoneMath;
  cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
  cornerstoneWADOImageLoader.configure({
    useWebWorkers: false,
  });

  cornerstoneTools.addTool(cornerstoneTools.WwwcTool);
  cornerstoneTools.addTool(cornerstoneTools.PanTool);
  cornerstoneTools.addTool(cornerstoneTools.ZoomTool);
  cornerstoneTools.addTool(cornerstoneTools.LengthTool);

  cornerstoneInitialized = true;
};

const getToolActiveBindings = (toolId: string) => {
  switch (toolId) {
    case 'Wwwc':
      return { mouseButtonMask: 1 };
    case 'Pan':
      return { mouseButtonMask: 4 };
    case 'Zoom':
      return { mouseButtonMask: 2 };
    case 'Length':
      return { mouseButtonMask: 1 };
    default:
      return { mouseButtonMask: 1 };
  }
};

const isLengthTool = (toolId: string) => toolId === 'Length';

const base64ToArrayBuffer = (base64: string) => {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = typeof window !== 'undefined' ? window.atob(clean) : Buffer.from(clean, 'base64').toString('binary');
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

const createDicomImageId = (fileName: string | undefined, filePath: string) => {
  const arrayBuffer = base64ToArrayBuffer(filePath);
  const blob = new Blob([arrayBuffer], { type: 'application/dicom' });
  const file = new File([blob], fileName || 'study.dcm', { type: 'application/dicom' });
  return cornerstoneWADOImageLoader.wadouri.fileManager.add(file);
};

interface ViewportImage {
  id: string;
  file_name: string;
  file_path: string;
  file_type?: string;
}

interface AnnotationRecord {
  id: string;
  annotation_type: string;
  annotation_text?: string;
  annotation_data?: any;
  created_at?: string;
  user_name?: string;
}

export interface ImagingDicomViewportProps {
  image: ViewportImage;
  imageStack?: ViewportImage[];
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
  overlay?: React.ReactNode;
  annotations?: AnnotationRecord[];
  readOnly?: boolean;
  onCreateAnnotation?: (
    imageId: string,
    annotation: { annotation_type: string; annotation_text?: string; annotation_data?: any },
    options?: { muteSuccess?: boolean }
  ) => void;
  onError?: (error: Error) => void;
}

const ImagingDicomViewport: React.FC<ImagingDicomViewportProps> = ({
  image,
  imageStack,
  currentIndex,
  onIndexChange,
  overlay,
  annotations = [],
  readOnly = false,
  onCreateAnnotation,
  onError,
}) => {
  initializeCornerstone();

  const elementRef = useRef<HTMLDivElement | null>(null);
  const imageIdCacheRef = useRef<Map<string, string>>(new Map());
  const measurementCacheRef = useRef<Set<string>>(new Set());
  const cineIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeIndexRef = useRef<number>(0);
  const activeImageRef = useRef<ViewportImage | null>(null);
  const [elementSize, setElementSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const [activeTool, setActiveTool] = useState<string>('Wwwc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentImageId, setCurrentImageId] = useState<string | null>(null);
  const [windowWidth, setWindowWidth] = useState<number | null>(null);
  const [windowCenter, setWindowCenter] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const filteredStack = useMemo(() => {
    if (!imageStack || imageStack.length === 0) return [image];
    const dicomOnly = imageStack.filter((img) => (img.file_type ? img.file_type === 'DICOM' : true));
    return dicomOnly.length > 0 ? dicomOnly : [image];
  }, [imageStack, image]);

  const initialIndex = useMemo(() => {
    if (currentIndex !== undefined && currentIndex >= 0) {
      return Math.min(currentIndex, filteredStack.length - 1);
    }
    const fallbackIndex = filteredStack.findIndex((img) => img.id === image.id);
    return fallbackIndex >= 0 ? fallbackIndex : 0;
  }, [currentIndex, filteredStack, image.id]);

  const [localIndex, setLocalIndex] = useState(initialIndex);
  useEffect(() => {
    setLocalIndex(initialIndex);
  }, [initialIndex]);

  const stackLength = filteredStack.length;
  const hasStack = stackLength > 1;
  const activeIndex = stackLength > 0 ? Math.min(localIndex, stackLength - 1) : 0;
  const activeImage = filteredStack[activeIndex] ?? image;
  activeIndexRef.current = activeIndex;
  activeImageRef.current = activeImage;

  const availableTools = useMemo(() => {
    if (readOnly) {
      return toolDefinitions.filter((tool) => tool.id !== 'Length');
    }
    return toolDefinitions;
  }, [readOnly]);

  const updateIndex = useCallback(
    (index: number) => {
      if (!hasStack) return;
      const normalized = ((index % stackLength) + stackLength) % stackLength;
      if (onIndexChange) {
        onIndexChange(normalized);
      } else {
        setLocalIndex(normalized);
      }
    },
    [hasStack, onIndexChange, stackLength],
  );

  const stepImage = useCallback(
    (delta: number) => {
      if (!hasStack) return;
      updateIndex(activeIndex + delta);
    },
    [hasStack, updateIndex, activeIndex],
  );

  const stopCine = useCallback(() => {
    if (cineIntervalRef.current) {
      clearInterval(cineIntervalRef.current);
      cineIntervalRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const toggleCine = useCallback(() => {
    if (!hasStack) return;

    if (isPlaying) {
      stopCine();
      return;
    }

    cineIntervalRef.current = setInterval(() => {
      const current = activeIndexRef.current;
      const next = (current + 1) % stackLength;
      updateIndex(next);
    }, 120);
    setIsPlaying(true);
  }, [hasStack, isPlaying, stackLength, updateIndex, stopCine]);

  useEffect(() => {
    return () => {
      stopCine();
    };
  }, [stopCine]);

  useEffect(() => {
    if (!hasStack && isPlaying) {
      stopCine();
    }
  }, [hasStack, isPlaying, stopCine]);

  const getOrCreateImageId = useCallback((img: ViewportImage) => {
    if (imageIdCacheRef.current.has(img.id)) {
      return imageIdCacheRef.current.get(img.id) as string;
    }
    const newId = createDicomImageId(img.file_name, img.file_path);
    imageIdCacheRef.current.set(img.id, newId);
    return newId;
  }, []);

  const applyTool = useCallback(
    (toolId: string) => {
      setActiveTool(toolId);
      const toolName = `${toolId}Tool`;

      if (isLengthTool(toolId)) {
        cornerstoneTools.setToolActive(toolName, { mouseButtonMask: 1 });
      } else {
        cornerstoneTools.setToolActive(toolName, getToolActiveBindings(toolId));
      }
    },
    [],
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return () => {};

    cornerstone.enable(element);
    applyTool('Wwwc');

    return () => {
      try {
        cornerstone.disable(element);
      } catch (disableError) {
        console.error('Failed to disable Cornerstone element', disableError);
      }
    };
  }, [applyTool]);

  const displayImage = useCallback(
    async (imgId: string) => {
      const element = elementRef.current;
      if (!element) return;

      try {
        cornerstone.resize(element, true);
        const csImage = await cornerstone.loadAndCacheImage(imgId);
        cornerstone.displayImage(element, csImage);
        const viewport = cornerstone.getDefaultViewportForImage(element, csImage);
        cornerstone.setViewport(element, viewport);
        setWindowWidth(viewport.voi?.windowWidth ?? null);
        setWindowCenter(viewport.voi?.windowCenter ?? null);
      } catch (err) {
        console.error('Failed to display DICOM image', err);
        const message = err instanceof Error ? err.message : 'Unable to display DICOM image';
        setError(message);
        if (onError && err instanceof Error) {
          onError(err);
        }
      }
    },
    [onError],
  );

  useEffect(() => {
    let cancelled = false;
    const loadImage = async () => {
      if (!activeImage?.file_path) return;
      setLoading(true);
      setError(null);

      try {
        const newImageId = getOrCreateImageId(activeImage);
        setCurrentImageId(newImageId);
        if (!cancelled) {
          await displayImage(newImageId);
        }
      } catch (err) {
        console.error('DICOM load failure', err);
        const message = err instanceof Error ? err.message : 'Failed to load DICOM image';
        setError(message);
        if (onError && err instanceof Error) {
          onError(err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      cancelled = true;
    };
  }, [activeImage, displayImage, getOrCreateImageId, onError]);

  useEffect(() => {
    return () => {
      imageIdCacheRef.current.forEach((id) => {
        cornerstoneWADOImageLoader.wadouri.fileManager.remove(id);
      });
      imageIdCacheRef.current.clear();
      measurementCacheRef.current.clear();
      stopCine();
    };
  }, [stopCine]);

  const handleReset = useCallback(() => {
    const element = elementRef.current;
    if (!element) return;

    if (currentImageId) {
      displayImage(currentImageId);
    }
  }, [displayImage, currentImageId]);

  const handleWindowing = useCallback(
    (type: 'lung' | 'mediastinum' | 'bone' | 'default') => {
      const element = elementRef.current;
      if (!element || !currentImageId) return;

      const imageObj = cornerstone.getImage(element);
      if (!imageObj) return;

      const viewport = cornerstone.getViewport(element);
      if (!viewport) return;

      const presets = {
        default: { ww: viewport.voi?.windowWidth ?? 400, wc: viewport.voi?.windowCenter ?? 40 },
        lung: { ww: 1500, wc: -600 },
        mediastinum: { ww: 350, wc: 50 },
        bone: { ww: 2500, wc: 480 },
      } as const;

      const preset = presets[type];
      viewport.voi.windowWidth = preset.ww;
      viewport.voi.windowCenter = preset.wc;
      cornerstone.setViewport(element, viewport);
      setWindowWidth(preset.ww);
      setWindowCenter(preset.wc);
    },
    [currentImageId],
  );

  const windowInfo = useMemo(() => {
    if (windowWidth == null || windowCenter == null) return null;
    return `WW ${Math.round(windowWidth)} · WC ${Math.round(windowCenter)}`;
  }, [windowWidth, windowCenter]);

  useEffect(() => {
    measurementCacheRef.current.clear();
  }, [activeImage?.id]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      cornerstone.resize(element, true);
      const imageId = currentImageId || (activeImageRef.current ? getOrCreateImageId(activeImageRef.current) : null);
      if (imageId) {
        displayImage(imageId);
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [displayImage, currentImageId, getOrCreateImageId]);

  const handleMeasurementCompleted = useCallback(
    (evt: any) => {
      if (!onCreateAnnotation || readOnly) return;
      const { measurementData, toolName } = evt.detail || {};
      if (!measurementData) return;

      const measurementId =
        measurementData?.uid ||
        measurementData?.uuid ||
        measurementData?.measurementId ||
        measurementData?.id ||
        `${measurementData?.toolType || 'measurement'}-${Date.now()}`;

      if (measurementCacheRef.current.has(measurementId)) return;
      measurementCacheRef.current.add(measurementId);

      const targetImage = activeImageRef.current || activeImage;
      if (!targetImage) return;

      try {
        const sanitized = JSON.parse(
          JSON.stringify({
            toolType: toolName || measurementData?.toolType || 'measurement',
            length: measurementData?.length,
            unit: measurementData?.units || measurementData?.unit || 'mm',
            text: measurementData?.text,
            handles: measurementData?.handles,
          }),
        );

        onCreateAnnotation(targetImage.id, {
          annotation_type: (toolName || measurementData?.toolType || 'measurement').toLowerCase(),
          annotation_data: sanitized,
        }, { muteSuccess: true });
      } catch (err) {
        console.error('Failed to serialize measurement annotation', err);
      }
    },
    [onCreateAnnotation, readOnly, activeImage],
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !onCreateAnnotation || readOnly) return;

    element.addEventListener(cornerstoneTools.EVENTS.MEASUREMENT_COMPLETED, handleMeasurementCompleted);
    return () => {
      element.removeEventListener(cornerstoneTools.EVENTS.MEASUREMENT_COMPLETED, handleMeasurementCompleted);
    };
  }, [handleMeasurementCompleted, onCreateAnnotation, readOnly]);

  const handleWheel = useCallback(
    (evt: WheelEvent) => {
      if (!hasStack) return;
      evt.preventDefault();
      const delta = evt.deltaY > 0 ? 1 : -1;
      stepImage(delta);
    },
    [hasStack, stepImage],
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return () => {};

    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      element.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const handleKeyDown = (evt: KeyboardEvent) => {
      if (!hasStack) return;
      if (evt.key === 'ArrowRight') {
        stepImage(1);
      } else if (evt.key === 'ArrowLeft') {
        stepImage(-1);
      }
    };

    element.addEventListener('keydown', handleKeyDown);
    return () => {
      element.removeEventListener('keydown', handleKeyDown);
    };
  }, [hasStack, stepImage]);

  const activeTools = availableTools;

  return (
    <div className="relative h-full bg-black rounded-xl overflow-hidden">
      <div className="absolute top-3 left-3 flex items-center gap-2 z-20">
        {activeTools.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => applyTool(id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium transition-colors border ${
              activeTool === id
                ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                : 'bg-black/40 text-slate-200 border-white/10 hover:bg-white/10'
            }`}
            title={label}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium transition-colors border bg-black/40 text-slate-200 border-white/10 hover:bg-white/10"
          title="Reset View"
        >
          <RefreshCcw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
        <button
          type="button"
          onClick={() => handleWindowing('default')}
          className="px-3 py-1.5 rounded-full text-[10px] font-medium bg-black/40 text-slate-200 border border-white/10 hover:bg-white/10"
        >
          Default
        </button>
        <button
          type="button"
          onClick={() => handleWindowing('lung')}
          className="px-3 py-1.5 rounded-full text-[10px] font-medium bg-black/40 text-slate-200 border border-white/10 hover:bg-white/10"
        >
          Lung
        </button>
        <button
          type="button"
          onClick={() => handleWindowing('mediastinum')}
          className="px-3 py-1.5 rounded-full text-[10px] font-medium bg-black/40 text-slate-200 border border-white/10 hover:bg-white/10"
        >
          Mediastinum
        </button>
        <button
          type="button"
          onClick={() => handleWindowing('bone')}
          className="px-3 py-1.5 rounded-full text-[10px] font-medium bg-black/40 text-slate-200 border border-white/10 hover:bg-white/10"
        >
          Bone
        </button>
      </div>

      {windowInfo && (
        <div className="absolute bottom-4 left-4 text-xs font-mono text-white bg-black/50 px-3 py-1.5 rounded-full z-20">
          {windowInfo}
        </div>
      )}

      {annotations.length > 0 && (
        <div className="absolute bottom-16 left-4 flex items-center gap-2 bg-black/50 text-white text-xs px-3 py-2 rounded-full z-20">
          <Sparkles className="w-3 h-3 text-amber-200" />
          <span>{annotations.length} annotation{annotations.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {hasStack && (
        <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-black/50 text-white text-xs px-3 py-2 rounded-full z-20">
          <button
            type="button"
            onClick={() => stepImage(-1)}
            className="p-1 rounded-full hover:bg-white/10"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-medium">
            {activeIndex + 1} / {stackLength}
          </span>
          <button
            type="button"
            onClick={() => stepImage(1)}
            className="p-1 rounded-full hover:bg-white/10"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleCine}
            className={`ml-2 flex items-center gap-1 px-3 py-1 rounded-full border ${
              isPlaying
                ? 'border-red-300 bg-red-500/20 text-red-200'
                : 'border-white/20 bg-white/10 text-white'
            }`}
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {isPlaying ? 'Stop' : 'Cine'}
          </button>
        </div>
      )}

      {overlay && (
        <div className="absolute bottom-4 right-4 text-xs text-white bg-black/40 px-3 py-2 rounded-lg z-10 mr-32">
          {overlay}
        </div>
      )}

      <div ref={elementRef} className="w-full h-full" tabIndex={0} />

      {loading && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur flex flex-col items-center justify-center text-slate-200 text-sm gap-3 z-30">
          <Loader2 className="w-8 h-8 animate-spin" />
          Loading DICOM image…
        </div>
      )}

      {error && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur flex flex-col items-center justify-center gap-3 text-center text-slate-100 p-6 z-40">
          <AlertTriangle className="w-10 h-10 text-red-400" />
          <div>
            <p className="text-base font-semibold">Unable to render DICOM</p>
            <p className="text-xs text-slate-300 mt-1">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImagingDicomViewport;
