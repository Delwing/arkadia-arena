# arkadia-arena

A plugin for the [Arkadia Web Client](https://github.com/Delwing/arkadia-web-client-extension):
the fight on your location acted out as a pixel-art JRPG battle. Open it with
`/arena` or from the ☰ menu.

## Files

```
plugin.ts          wiring only: feed, window, alias, menu entry
arena/combat.ts    pure: roster/action types, matching combat lines to fighters
arena/feed.ts      client events -> roster + fight beats, over the ArenaHost port
arena/ArenaScene.ts canvas scene: actors, moves, effects
arena/sprites.ts   pixel grids and the desc -> sprite rules
arena/window.ts    the window's DOM; arena/styles.ts its injected CSS
client/apiHost.ts  ArenaHost over the plugin API - the only module that knows it
shared/text.ts     foldText / fuzzyMatchScore, copied from the client
test/              vitest
```

- `plugin.json` — registry manifest. Keep its `version` in sync with
  `package.json` and `PLUGIN_VERSION` in `plugin.ts`.
- `DESCRIPTION.md` — the plugin's page in the registry, in Polish.

## Commands

```
yarn install
yarn typecheck      tsc --noEmit
yarn test           vitest run
yarn build          esbuild -> dist/plugin.js
yarn dev            watch + serve dist/ on :5181
```

To try it in the client: *Skrypty -> Dodaj plugin -> Z adresu URL* with
`http://localhost:5181/plugin.js`, or open the client with
`?add-script=http://localhost:5181/plugin.js` once.

## Client features it uses

Any plugin API client works. Newer clients add two things the plugin picks up
when present: `api.people.subscribe()` (otherwise it re-reads the people list
every minute) and `finisher` on `combat.gag` (otherwise only the default `FIN`
prefix counts as a killing blow).

## Release

Push a `v<version>` tag matching `package.json`; `publish.yml` sends the sources
to the plugin registry. Pushes to `master` deploy `dist/` to GitHub Pages.
