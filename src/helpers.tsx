// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from 'react';
import * as ICAL from 'ical.js';
import moment from 'moment';

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

  return '#' + toHex(red) + toHex(green) + toHex(blue) + toHex(alpha);
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

  return (b | (g << 8) | (r << 16) | (a << 24));
}

const allDayFormat = 'dddd, LL';
const fullFormat = 'LLLL';

export function formatDate(date: ICAL.Time) {
  const mDate = moment(date.toJSDate());
  if (date.isDate) {
    return mDate.format(allDayFormat);
  } else {
    return mDate.format(fullFormat);
  }
}

export function formatDateRange(start: ICAL.Time, end: ICAL.Time) {
  const mStart = moment(start.toJSDate());
  const mEnd = moment(end.toJSDate());
  let strStart;
  let strEnd;

  // All day
  if (start.isDate) {
    if (mEnd.diff(mStart, 'days', true) === 1) {
      return mStart.format(allDayFormat);
    } else {
      strStart = mStart.format(allDayFormat);
      strEnd = mEnd.clone().subtract(1, 'day').format(allDayFormat);
    }
  } else if (mStart.isSame(mEnd, 'day')) {
    strStart = mStart.format(fullFormat);
    strEnd = mEnd.format('LT');

    if (mStart.isSame(mEnd)) {
      return strStart;
    }
  } else {
    strStart = mStart.format(fullFormat);
    strEnd = mEnd.format(fullFormat);
  }

  return strStart + ' - ' + strEnd;
}

export function formatOurTimezoneOffset() {
  let offset = new Date().getTimezoneOffset();
  const prefix = (offset > 0) ? '-' : '+';
  offset = Math.abs(offset);
  const hours = Math.floor(offset / 60);
  const minutes = offset % 60;

  return `GMT${prefix}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function* arrayToChunkIterator<T>(arr: T[], size: number) {
  for (let i = 0 ; i < arr.length ; i += size) {
    yield arr.slice(i, i + size);
  }
}

export function isPromise(x: any): x is Promise<any> {
  return x && typeof x.then === 'function';
}

export function isDefined<T>(x: T | undefined): x is T {
  return x !== undefined;
}

export function startTask<T = any>(func: () => Promise<T> | T, delay = 0): Promise<T> {
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
      delay);
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
