import * as React from 'react';
import { NetInfo, ConnectionInfo } from 'react-native';
import { useSelector } from 'react-redux';

import moment from 'moment';
import 'moment/locale/en-gb';

import { StoreState, store } from './store';
import { setConnectionInfo } from './store/actions';
import { logger, setLogLevel } from './logging';

function handleConnectivityChange(connectionInfo: ConnectionInfo) {
  logger.info(`ConnectionfInfo: ${connectionInfo.type} ${connectionInfo.effectiveType}`);
  store.dispatch(setConnectionInfo(connectionInfo));
}

export default React.memo(function SettingsGate(props: React.PropsWithChildren<{}>) {
  const settings = useSelector((state: StoreState) => state.settings);

  React.useEffect(() => {
    setLogLevel(settings.logLevel);
  }, [settings.logLevel]);

  React.useEffect(() => {
    moment.locale(settings.locale);
  }, [settings.locale]);

  // Not really settings but the app's general state.
  React.useEffect(() => {
    NetInfo.addEventListener('connectionChange', handleConnectivityChange as any);
    return () => NetInfo.removeEventListener('connectionChange', handleConnectivityChange as any);
  }, []);

  return (
    <>{props.children}</>
  );
});
