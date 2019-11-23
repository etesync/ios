import * as React from 'react';
import { useSelector } from 'react-redux';

import moment from 'moment';
import 'moment/locale/en-gb';

import { StoreState } from './store';
import { setLogLevel } from './logging';

export default React.memo(function SettingsGate(props: React.PropsWithChildren<{}>) {
  const settings = useSelector((state: StoreState) => state.settings);

  React.useEffect(() => {
    setLogLevel(settings.logLevel);
  }, [settings.logLevel]);

  React.useEffect(() => {
    moment.locale(settings.locale);
  }, [settings.locale]);

  return (
    <>{props.children}</>
  );
});
