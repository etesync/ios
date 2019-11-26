import * as React from 'react';

export const defaultColor = '#8BC34A';

export function colorIntToHtml(color?: number) {
  if (color === undefined) {
    return defaultColor;
  }

  // tslint:disable:no-bitwise
  const blue = color & 0xFF;
  const green = (color >> 8) & 0xFF;
  const red = (color >> 16) & 0xFF;
  const alpha = (color >> 24) & 0xFF;
  // tslint:enable

  function toHex(num: number) {
    const ret = num.toString(16);
    return (ret.length === 1) ? '0' + ret : ret;
  }

  return '#' + toHex(red) + toHex(green) + toHex(blue) +
    ((alpha > 0) ? toHex(alpha) : '');
}

export function colorHtmlToInt(color?: string) {
  if (!color) {
    color = defaultColor;
  }

  const match = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i);

  if (!match) {
    return undefined;
  }

  const r = parseInt(match[1], 16);
  const g = parseInt(match[2], 16);
  const b = parseInt(match[3], 16);
  const a = (match[4]) ? parseInt(match[4], 16) : 0xFF;

  return (b | (g << 8) | (r << 16) | (a << 24)) >>> 0;
}

export function isPromise(x: any): x is Promise<any> {
  return x && typeof x.then === 'function';
}

export function isDefined<T>(x: T | undefined): x is T {
  return x !== undefined;
}

export function startTask<T = any>(func: () => Promise<T> | T): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(
      () => {
        try {
          const ret = func();
          if (isPromise(ret)) {
            ret.then(resolve)
              .catch(reject);
          } else {
            resolve(ret);
          }
        } catch (e) {
          reject(e);
        }
      },
      0);
  });
}

function isFunction(f: any): f is Function {
  return f instanceof Function;
}

export function useIsMounted() {
  const isMounted = React.useRef(false);
  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  return isMounted;
}

type PromiseParam = Promise<any> | (() => Promise<any>) | undefined;

export function useLoading(): [boolean, Error | undefined, (promise: PromiseParam) => void] {
  const isMounted = useIsMounted();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error>();

  function setPromise(inPromise: PromiseParam) {
    setLoading(true);
    setError(undefined);

    startTask(() => {
      const promise = (isFunction(inPromise) ? inPromise() : inPromise);

      if (isPromise(promise)) {
        promise.catch((e) => {
          if (isMounted.current) {
            setError(e);
          }
        }).finally(() => {
          if (isMounted.current) {
            setLoading(false);
          }
        });
      } else {
        setLoading(false);
      }
    });
  }

  return [loading, error, setPromise];
}
