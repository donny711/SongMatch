import React, { createContext, useContext, useRef, useCallback } from 'react';
import type { View } from 'react-native';

export type TargetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Registry = Record<string, React.RefObject<View | null>>;

interface MeasureContextValue {
  register: (id: string, ref: React.RefObject<View | null>) => void;
  unregister: (id: string) => void;
  measure: (id: string) => Promise<TargetRect | null>;
}

const MeasureContext = createContext<MeasureContextValue>({
  register: () => {},
  unregister: () => {},
  measure: async () => null,
});

export function TutorialMeasureProvider({ children }: { children: React.ReactNode }) {
  const registry = useRef<Registry>({});

  const register = useCallback((id: string, ref: React.RefObject<View | null>) => {
    registry.current[id] = ref;
  }, []);

  const unregister = useCallback((id: string) => {
    delete registry.current[id];
  }, []);

  const measure = useCallback(async (id: string): Promise<TargetRect | null> => {
    const ref = registry.current[id];
    if (!ref?.current) return null;

    return new Promise((resolve) => {
      ref.current!.measureInWindow((x, y, width, height) => {
        if (width === 0 && height === 0) {
          resolve(null);
        } else {
          resolve({ x, y, width, height });
        }
      });
    });
  }, []);

  return (
    <MeasureContext.Provider value={{ register, unregister, measure }}>
      {children}
    </MeasureContext.Provider>
  );
}

export function useTutorialMeasure() {
  return useContext(MeasureContext);
}
