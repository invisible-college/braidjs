Note: current development is happening in the [braid-work/toomim-braidjs](https://github.com/braid-work/toomim-braidjs) repo.

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

[Roadmap](https://braid.news/roadmap) to release:
- [x] Rename `fetch` & `save` -> `get` & `set`
- [x] Rename `statebus` -> `braidjs`
- [x] Change JSON encoding
- [x] Remove recursion in `set`
- [ ] Incorporate the [Sync9](https://braid.news/sync9/performance) pruning peer-to-peer CRDT
  - [ ] Disk persistence
- [ ] New [API](https://braid.news/roadmap/new-api)
  - [ ] Add [cache eviction policy](https://en.wikipedia.org/wiki/Cache_replacement_policies#Most_recently_used_(MRU))
- [ ] New [network protocol](https://braid.news/protocol)
- [ ] New ES6 Proxy implementation
- [ ] Rename `key` -> `link`


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
