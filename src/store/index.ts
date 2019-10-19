import { createStore, applyMiddleware } from 'redux';
import { persistStore } from 'redux-persist';
import thunkMiddleware from 'redux-thunk';
import { createLogger } from 'redux-logger';

import promiseMiddleware from './promise-middleware';

import reducers from './construct';
import * as actions from './actions';

// Workaround babel limitation
export * from './reducers';
export * from './construct';

const middleware = [
  thunkMiddleware,
  promiseMiddleware,
];

if (__DEV__) {
  const ignoreActions = [
    'persist/PERSIST',
    'persist/REHYDRATE',
    actions.setSyncStateJournal.toString(),
    actions.unsetSyncStateJournal.toString(),
    actions.setSyncStateEntry.toString(),
    actions.unsetSyncStateEntry.toString(),
    actions.setSyncInfoCollection.toString(),
    actions.unsetSyncInfoCollection.toString(),
    actions.setSyncInfoItem.toString(),
    actions.unsetSyncInfoItem.toString(),
  ];

  const predicate = (_: any, action: { type: string }) => {
    return !ignoreActions.includes(action.type);
  };

  const logger = {
    log: (msg: string) => {
      if (msg[0] === '#') {
        console.log(msg);
      }
    },
  };

  middleware.push(createLogger({
    predicate,
    logger,
    stateTransformer: () => 'state',
    actionTransformer: ({ type, error, payload }) => ({ type, error, payload: !!payload }),
    titleFormatter: (action: { type: string, error: any, payload: boolean }, time: string, took: number) => {
      let prefix = '->';
      if (action.error) {
        prefix = 'xx';
      } else if (action.payload) {
        prefix = '==';
      }
      return `# ${prefix} ${action.type} @ ${time} (in ${took.toFixed(2)} ms)`;
    },
    colors: {
      title: false,
      prevState: false,
      action: false,
      nextState: false,
      error: false,
    },
  }));
}

export const store = createStore(
  reducers,
  applyMiddleware(...middleware)
);

export const persistor = persistStore(store);
