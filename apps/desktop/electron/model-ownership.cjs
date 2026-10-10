'use strict';

// The SDK can hand two unrelated loadModel() calls the same "already
// registered" id, and a loader that adopts it would unload the other's model
// under a running session. Loaders claim ids here and refuse anyone else's.

const owners = new Map();

function claim(modelId, label) {
  owners.set(modelId, label);
}

function release(modelId) {
  owners.delete(modelId);
}

function ownerOf(modelId) {
  return owners.get(modelId) ?? null;
}

module.exports = { claim, release, ownerOf };
