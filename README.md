<p align="center">
  <img width="120" src="assets/icon.png" />
  <h1 align="center">EteSync - Secure Data Sync</h1>
</p>

Secure, end-to-end encrypted, and privacy respecting sync for your contacts, calendars and tasks (iOS client).

![GitHub tag](https://img.shields.io/github/tag/etesync/ios.svg)
[![Chat on freenode](https://img.shields.io/badge/irc.freenode.net-%23EteSync-blue.svg)](https://webchat.freenode.net/?channels=#etesync)

# Overview

Please see the [EteSync website](https://www.etesync.com) for more information.

EteSync is licensed under the [GPLv3 License](LICENSE).

# App is currently in beta

The app is still missing a few features to be ready for release. Here's a short list of things that are less than optimal but will improve as we go along:

1. Setup is a bit clunky and requires manually adding an account to the device.
2. Some operations are a bit slow so initial sync can even take a few minutes. Just wait. Don't interrupt it.
3. Address books are not currently synced to the device, you can only view the change log. This is due to [an expo bug](https://github.com/expo/expo/pull/6016) that we already fixed upstream, but are waiting for a release that includes it.
4. Sync is only triggered when you open the app and when you manually click the sync button. It doesn't yet sync automatically in the background.
5. Only basic recurrence rules are currently supported. Waiting on Expo SDK 36 which includes [this pull request](https://github.com/expo/expo/pull/6300).

# Setup

For setup instructions please take a look at the [user guide](https://www.etesync.com/user-guide/ios/).

# Thanks

<p>EteSync iOS is made possible with financial support from <a
href="https://nlnet.nl/">NLnet Foundation</a>, courtesy of <a
href="https://nlnet.nl/discovery">NGI0 Discovery<a/> and the <a
href="https://ec.europa.eu">European Commission</a> <a
href="https://ec.europa.eu/info/departments/communications-networks-content-and-technology_en">DG
CNECT</a>'s <a href="https://ngi.eu">Next Generation Internet</a>
programme.</p>
