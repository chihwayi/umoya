import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

export type BgTaskStatus = 'running' | 'done' | 'error';
export type BgTaskIcon = 'guidelines' | 'analysis' | 'ai' | 'search';

export interface BackgroundTask {
  id: string;
  label: string;
  icon: BgTaskIcon;
  status: BgTaskStatus;
  startedAt: number;
  finishedAt?: number;
  result?: any;
  error?: string;
}

interface BackgroundTaskContextType {
  tasks: BackgroundTask[];
  registerTask: (label: string, icon?: BgTaskIcon) => string;
  completeTask: (id: string, result: any) => void;
  failTask: (id: string, error: string) => void;
  dismissTask: (id: string) => void;
  getTask: (id: string) => BackgroundTask | undefined;
}

const BackgroundTaskContext = createContext<BackgroundTaskContextType | undefined>(undefined);

export const useBackgroundTasks = () => {
  const ctx = useContext(BackgroundTaskContext);
  if (!ctx) throw new Error('useBackgroundTasks requires BackgroundTaskProvider');
  return ctx;
};

let taskCounter = 0;

export const BackgroundTaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const tasksRef = useRef<BackgroundTask[]>([]);

  const sync = (updated: BackgroundTask[]) => {
    tasksRef.current = updated;
    setTasks([...updated]);
  };

  const registerTask = useCallback((label: string, icon: BgTaskIcon = 'guidelines'): string => {
    const id = `bgtask_${Date.now()}_${++taskCounter}`;
    const task: BackgroundTask = { id, label, icon, status: 'running', startedAt: Date.now() };
    sync([...tasksRef.current, task]);
    return id;
  }, []);

  const completeTask = useCallback((id: string, result: any) => {
    sync(tasksRef.current.map(t =>
      t.id === id ? { ...t, status: 'done', result, finishedAt: Date.now() } : t
    ));
  }, []);

  const failTask = useCallback((id: string, error: string) => {
    sync(tasksRef.current.map(t =>
      t.id === id ? { ...t, status: 'error', error, finishedAt: Date.now() } : t
    ));
  }, []);

  const dismissTask = useCallback((id: string) => {
    sync(tasksRef.current.filter(t => t.id !== id));
  }, []);

  const getTask = useCallback((id: string) => tasksRef.current.find(t => t.id === id), []);

  return (
    <BackgroundTaskContext.Provider value={{ tasks, registerTask, completeTask, failTask, dismissTask, getTask }}>
      {children}
    </BackgroundTaskContext.Provider>
  );
};
