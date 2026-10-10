'use strict';

const { command, flag } = require('paparam');

const { start } = require('./start');

function fail(err) {
  console.error(`slaps-studio: ${err?.message ?? err}`);
  process.exitCode = 1;
}

// paparam pre-fills every declared boolean flag to false, so cmd.flags alone
// can't tell "not passed" from "explicitly false". cmd.indices.flags only has
// an entry for flags actually typed on the command line.
function explicitFlag(cmd, name) {
  return cmd.indices.flags[name] !== undefined ? cmd.flags[name] : undefined;
}

const startCmd = command(
  'start',
  flag('--storage [dir]', 'use a custom profile storage directory'),
  (cmd) => start({ storage: cmd.flags.storage }).catch(fail),
);

const channelFlag = () => flag('--channel <name>', 'stable (newest release, default) or latest (master); remembered');

const installCmd = command('install', channelFlag(), (cmd) => {
  require('./install').install({ channel: cmd.flags.channel }).catch(fail);
});

const updateCmd = command('update', channelFlag(), (cmd) => {
  require('./update').update({ channel: cmd.flags.channel }).catch(fail);
});

const uninstallCmd = command(
  'uninstall',
  flag('--purge', 'also remove models, saved designs, and identity'),
  flag('--yes', 'skip the confirmation prompt'),
  flag('--models', 'also remove downloaded models'),
  flag('--progress', 'also remove saved designs and settings'),
  flag('--identity', 'also remove your identity'),
  (cmd) =>
    require('./uninstall')
      .uninstall({
        purge: cmd.flags.purge,
        yes: cmd.flags.yes,
        models: explicitFlag(cmd, 'models'),
        progress: explicitFlag(cmd, 'progress'),
        identity: explicitFlag(cmd, 'identity'),
      })
      .catch(fail),
);

const cli = command('slaps-studio', startCmd, installCmd, updateCmd, uninstallCmd);

function main(argv = process.argv.slice(2)) {
  try {
    cli.parse(argv);
  } catch (err) {
    console.error(`slaps-studio: ${err?.message ?? err}`);
    console.error('Run `slaps-studio --help` to see available commands.');
    process.exitCode = 1;
  }
}

module.exports = { main };
