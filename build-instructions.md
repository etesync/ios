These are high-level instructions for building the app.

# Basic build

1. Run `yarn` to install the latest version of the deps.
2. From the `ios` directory run `pod install`
3. Build from xcode

# Update deploy version (and include a new bundle)

Before doing the above build do the following:

1. Update the deploy version (the number in the export url) in:
  1. ios/etesync/Supporting/EXShell.{plist,json}
  2. `deploy_dist.sh`
2. run `yarn export` the same way it's run in `deploy_dist.sh` (you can essentially run the script and just let the deployment itself fail).
3. Copy over the bundle and the manifest to the right place:
  1. `cp dist/bundles/ios-*.js ios/etesync/Supporting/shell-app.bundle`
  2. `cp dist/ios-index.json ios/etesync/Supporting/shell-app-manifest.json`
4. Follow the basic build instructions above.
