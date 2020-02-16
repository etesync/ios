import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Paragraph } from 'react-native-paper';

import * as Permissions from 'expo-permissions';

import { Title } from './widgets/Typography';
import LoadingIndicator from './widgets/LoadingIndicator';

import { StoreState } from './store';
import { setPermission } from './store/actions';

import { logger } from './logging';

const wantedPermissions: Permissions.PermissionType[] = [Permissions.CALENDAR, Permissions.REMINDERS, Permissions.CONTACTS, Permissions.USER_FACING_NOTIFICATIONS];

export function AskForPermissions() {
  const dispatch = useDispatch();
  const permissions = useSelector((state: StoreState) => state.permissions);
  const alreadyAsked = wantedPermissions.length === permissions.size;

  return (
    <>
      <Title>Permissions</Title>
      {(alreadyAsked) ?
        <Paragraph>
          EteSync has already asked for the permissions before, so they can now only be changed from the device's Settings app.
        </Paragraph>
        :
        <Paragraph>EteSync requires access to your contacts, calendars and reminders in order to be able save them to your device. You can either give EteSync access now or do it later from the device Settings.</Paragraph>
      }
      <Button mode="contained" disabled={alreadyAsked} style={{ marginTop: 20 }} onPress={() => {
        (async () => {
          for (const permission of wantedPermissions) {
            const { status } = await Permissions.askAsync(permission);
            logger.info(`Permissions status for ${permission}: ${status}`);
            dispatch(setPermission(permission, status === Permissions.PermissionStatus.GRANTED));
          }
        })();
      }}>
        Ask for Permissions
      </Button>
    </>
  );
}


export function usePermissions() {
  const dispatch = useDispatch();
  const [shouldAsk, setShouldAsk] = React.useState<null | boolean>(null);
  const [asked, setAsked] = React.useState(false);

  if (!asked) {
    setAsked(true);
    (async () => {
      for (const permission of wantedPermissions) {
        const { status } = await Permissions.getAsync(permission);
        logger.info(`Permissions status for ${permission}: ${status}`);
        if (status === Permissions.PermissionStatus.UNDETERMINED) {
          setShouldAsk(true);
          return;
        } else {
          dispatch(setPermission(permission, status === Permissions.PermissionStatus.GRANTED));
        }
      }

      setShouldAsk(false);
    })();
  }

  if (shouldAsk === null) {
    return (<LoadingIndicator />);
  } else {
    return null;
  }
}

