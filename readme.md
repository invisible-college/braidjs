# Welcome to the Braid!

These libraries upgrade your website to the [braid protocol](https://tools.ietf.org/html/draft-toomim-braid-00), which adds *synchronization* to HTTP.

This makes web programming much easier, and gives you the following magical features for free:
 - Collaborative editing
 - Offline-mode (and resilience to network disconnects)
 - Peer-to-peer networking
 - Delta-compressed network updates
 - Shareable synchronized state across websites

*We intentionally keep this readme short.* Read more about braid at https://braid.news!

## This is the beta version 7

This version isn't released just yet!  It has bugs.

The current release is at https://github.com/invisible-college/statebus.  The
name is changing from `statebus` to `braidjs` with version 7.

[Roadmap](https://braid.news/roadmap) to version 7 release:
- [x] Rename `fetch` & `save` -> `get` & `set`
- [x] Rename `statebus` -> `braidjs`
- [x] Change JSON encoding
- [x] Remove recursion in `set`
- [ ] New [handler API](https://braid.news/roadmap/new-handlers)
- [ ] Incorporate the [Sync9](https://braid.news/sync9/performance) pruning peer-to-peer CRDT
  - [ ] Disk persistence
- [ ] Network protocol using extensions to regular HTTP instead of WebSocket
- [ ] New Proxy implementation
- [ ] Rename `key` -> `link`
- [ ] Implement MRU in cache
- [ ] Build P2P demo app

## How do I use this?

Read the instructions at https://braid.news/tutorial

## What's in this repository?

```
sync9.js      # The sync algorithm and data structures
braid.js      # A nice API to read, write, control, and react to state changes
client.js     # Support for web browsers
server.js     # Support for nodejs servers
```

## Contributing

Be sure to run the tests in extras/tests.js. You can just run:

```
npm test
```

...at the command line.
