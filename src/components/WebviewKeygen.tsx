// SPDX-FileCopyrightText: © 2019 EteSync Authors
// SPDX-License-Identifier: GPL-3.0-only

import * as React from "react";
import { WebView } from "react-native-webview";

interface Keys {
  privateKey: string;
  publicKey: string;
  error?: string;
}

interface PropsType {
  onFinish: (keys: Keys) => void;
}

export default React.memo(function WebviewKeygen(props: PropsType) {
  return (
    <WebView
      style={{ height: 0, width: 0 }}
      originWhitelist={["*"]}
      source={{ html: `
<!doctype html>
<html lang="en">
  <body>
    <script language="JavaScript">
      (async function() {
        try {
          function abBtoa( buffer ) {
            var binary = '';
            var bytes = new Uint8Array( buffer );
            var len = bytes.byteLength;
            for (var i = 0; i < len; i++) {
                binary += String.fromCharCode( bytes[ i ] );
            }
            return window.btoa( binary );
          }

          var keys = await window.crypto.subtle.generateKey(
              {
                  name: "RSA-OAEP",
                  modulusLength: 3072,
                  publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
                  hash: {name: "SHA-1"},
              },
              true,
              ["encrypt", "decrypt"]
          );
          var ret = {
            publicKey: abBtoa(await window.crypto.subtle.exportKey('spki', keys.publicKey)),
            privateKey: abBtoa(await window.crypto.subtle.exportKey('pkcs8', keys.privateKey)),
          };
          window.ReactNativeWebView.postMessage(JSON.stringify(ret));
        } catch(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ error: e.toString() }));
        }
      })();
    </script>
  </body>
</html>
` }}
      onMessage={({ nativeEvent: state }) => {
        const keys = JSON.parse(state.data);
        props.onFinish(keys);
      }}
    />
  );
});
