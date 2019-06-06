import { AsyncStorage } from 'react-native';

const indexedDBExists = __DEV__ && this.window.indexedDB;


function initialize(timeout) {
  const interf = {};
  const decorated = {};

  const withTimeout = (fn) => async (...args) =>
    await clocked(fn(...args), { timeout });

  if (indexedDBExists) {
    try {
      const idb = require('idb-keyval');
      Object.assign(interf, {
        getItem: idb.get,
        setItem: idb.set,
        getAllKeys: idb.keys,
        removeItem: idb.delete,
      });
    } catch (error) {
      throw new Error('The idb-keyval package is missing.');
    }
  } else {
    Object.assign(interf, {
      getItem: AsyncStorage.getItem,
      setItem: AsyncStorage.setItem,
      getAllKeys: AsyncStorage.getAllKeys,
      removeItem: (key) => AsyncStorage.setItem(key, null),
    });
  }

  for (let method in interf) {
    decorated[method] = withTimeout(interf[method])
  }

  return decorated;
}


function clocked(promise, options = {}) {
  const time = options.timeout || DEFAULT_TIMEOUT;

  return new Promise (async (resolve, reject) => {

    const onTimeout  = () => {
      const error = new Error(options.rejectionMessage || 'Timeout')
      console.error(error);
      // reject(error)
    }

    const success = (result) => {
      clearTimeout(timeout)
      resolve(result)
    }

    const timeout = setTimeout(onTimeout, time)

    return promise
      .then(success)
      .catch(reject);
  });
}

const storage = initialize(5000);

export async function keys() {
  return await storage.keys();
}


export async function get(...key) {
  let nsp = key.join('/');
  let response = await storage.get(nsp);
  return decode(response);
}


export async function set(nsp, value = null) {
  value = encode(value)
  let response = await storage.set(nsp, value)
  return response
}


export async function remove(...key) {
  let nsp = key.join('/')
  let response = await storage.remove(nsp)
  return response
}


export async function append(nsp, ...values) {

  let previousValue = decode(await storage.get(nsp))
  if (!previousValue)
    previousValue = []
  if (!(previousValue instanceof Array))
    throw new TypeError(`Cannot apply append to a non-array value`)

  let data = encode([ ...previousValue, ...values ])
  let response = await storage.set(nsp, data)
  return response
}


// eslint-disable-next-line complexity
function encode(data, defaultValue = null) {
  if (!data)
    data = defaultValue
  if (data.toJSON)
    data = data.toJSON()
  if (data instanceof Array && data.length)
    data = data
      .filter(item => item)
      .map(item => item.toJSON ? item.toJSON() : item)

  if (typeof data === 'object')
    return JSON.stringify(data)
  else if (typeof data === 'string')
    return data
  else if (typeof data === 'number')
    return data.toString()
  else if (!data)
    return null
  throw new TypeError(`Trying to encode non-object, non-textual data`)
}


function decode(data, defaultValue = null) {
  if (!data)
    data = defaultValue
  if (typeof data === 'string')
    try {
      return JSON.parse(data)
    }
    catch (error) {
      return data
    }
  else if (!data || !data.length)
    return null
  throw new TypeError(`Trying to decode non-textual data`)
}

export default storage;
