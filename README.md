<p align="center">
  <img width="120" src="assets/icon.png" />
  <h1 align="center">EteSync - Secure Data Sync</h1>
</p>

**IMPORTANT:** this app is work-in-progress and very much incomplete.

Secure, end-to-end encrypted, and privacy respecting sync for your contacts, calendars and tasks (iOS client).

![GitHub tag](https://img.shields.io/github/tag/etesync/ios.svg)
[![Chat on freenode](https://img.shields.io/badge/irc.freenode.net-%23EteSync-blue.svg)](https://webchat.freenode.net/?channels=#etesync)

# Overview

Please see the [EteSync website](https://www.etesync.com) for more information.

EteSync is licensed under the [GPLv3 License](LICENSE).

# App is under heavy development

The app is work-in-progress and incomplete. Here's a short list of things that are less than optimal but will improve as we go along:

1. Setup is a bit clunky and requires manually adding an account to the device.
2. The app is quite slow and potentially buggy. Hangs are to be expected, and initial sync can even take a few minutes. Just wait.
3. Many buttons are just stubs and don't actually work.
4. Only calendars are currently synced to the device, the rest are just visible in the change log.
5. Everything is read-only at the moment. As in, you are able to edit/add calendar events but it won't actually sync the changes!
6. Sync is only triggered when you open the app and when you manually click the sync button. It doesn't yet sync automatically in the background.
7. Some parts have not been designed yet.

# Setup

The app is not yet on the app store so can't be installed directly, but we can use Expo Client to launch it and even sync!

Setup insturctions:
1. Install the [Expo Client](https://apps.apple.com/us/app/expo-client/id982107779) app on your iPhone.
2. Add CalDAV and CarDAV accounts to your iPhone as explained in [this video](https://stosb.com/~tom/ios_add_accounts.mp4).
3. Click on the link in [this page](https://stosb.com/~tom/expo.html) on your iPhone to launch the EteSync app in expo.

After doing the above you can now just launch the EteSync app directly from the Projects tab of the expo app. That's it!

Now you can just open the app and log in! Wait, it takes time. As long as the button is grey it's actually doing some work, so just wait. This will all be addressed before the final version is released.


# Thanks

<p>EteSync iOS is made possible with financial support from <a
href="https://nlnet.nl/">NLnet Foundation</a>, courtesy of <a
href="https://nlnet.nl/discovery">NGI0 Discovery<a/> and the <a
href="https://ec.europa.eu">European Commission</a> <a
href="https://ec.europa.eu/info/departments/communications-networks-content-and-technology_en">DG
CNECT</a>'s <a href="https://ngi.eu">Next Generation Internet</a>
programme.</p>
