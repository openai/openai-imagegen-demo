import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";


type Serializer<T> = (value: T) => string;

type Deserializer<T> = (value: string) => T;

const defaultSerializer = <T,>(value: T): string => JSON.stringify(value);

const defaultDeserializer = <T,>(value: string): T => JSON.parse(value) as T;

const usePersistedState = <T,>(
  key: string,
  initialValue: T,
  options: {
    serializer?: Serializer<T>;
    deserializer?: Deserializer<T>;
  } = {},
): [T, Dispatch<SetStateAction<T>>] => {
  const { serializer = defaultSerializer<T>, deserializer = defaultDeserializer<T> } = options;

  const initialRef = useRef(initialValue);
  const [value, setValue] = useState<T>(() => initialRef.current);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) {
        setValue(deserializer(stored));
      } else {
        setValue(initialRef.current);
      }
    } catch {
      setValue(initialRef.current);
    } finally {
      setHasHydrated(true);
    }
  }, [deserializer, key]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasHydrated) return;
    try {
      window.localStorage.setItem(key, serializer(value));
    } catch {
      /* ignore serialization failures */
    }
  }, [hasHydrated, key, serializer, value]);

  return [value, setValue];
};

export default usePersistedState;
