import fs from "fs";
import readline from "readline";

import dotenv from "dotenv";
import ora from "ora";
import { Command } from "commander";
import { exec } from "child_process";

import { providers, Wallet } from "ethers";

const { JsonRpcProvider } = providers;

// === Constants ==================================================================================

const DEFAULT_RPC_URL = "http://localhost:8545";
const CONFIG_FILENAME = ".deploy-config.json";

// === Implementation =============================================================================

/**
 * Asks the user a question and returns the answer.
 *
 * @param {string} question the question contents.
 * @param {?string} type an optional type to parse the answer as. Currently only supports 'int' for
 *        decimal integers. and `bool` for booleans.
 * @returns a promise resolving to user's response
 */
function ask(question, type) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question(question, (input) => {
      if (type === "int" && input) {
        input = parseInt(input.trim());
        if (isNaN(input)) {
          reject("Invalid input");
        }
      }
      if (type === "bool") {
        if (!input) {
          input = undefined;
        } else {
          switch (input.trim()) {
            case "y":
            case "Y":
            case "true":
            case "True":
              input = true;
              break;
            case "n":
            case "N":
            case "false":
            case "False":
              input = false;
              break;
            default:
              reject("Invalid input");
              break;
          }
        }
      }
      resolve(input);
      rl.close();
    });
  });
}

function newPlan() {
  let self = {
    items: [],
    add: function (label, action) {
      self.items.push({ label, action });
    },
  };
  return self;
}

async function getOptimismWallet(config) {
  config.wallet = new Wallet(config.privateKey, config.optimismProvider);
}

async function getPolygonWallet(config) {
  config.wallet = new Wallet(config.privateKey, config.polygonProvider);
}

async function getEthereumWallet(config) {
  config.wallet = new Wallet(config.privateKey, config.ethereumProvider);
}

async function getPrivateKey(config) {
  if (!config.privateKey) {
    config.privateKey = process.env.PRIVATE_KEY;
  }
  if (!config.privateKey) {
    config.privateKey = await ask("Enter your private key: ");
  }
}

async function getEthereumRpcUrl(config) {
  if (!config.ethereumRpcUrl) {
    config.ethereumRpcUrl = process.env.ETH_RPC_URL;
  }
  if (!config.ethereumRpcUrl) {
    config.ethereumRpcUrl = await ask(`Enter Ethereum RPC URL: (${DEFAULT_RPC_URL}) `);
  }
  if (!config.ethereumRpcUrl) {
    config.ethereumRpcUrl = DEFAULT_RPC_URL;
  }
}

async function getOptimismRpcUrl(config) {
  if (!config.optimismRpcUrl) {
    config.optimismRpcUrl = process.env.OP_RPC_URL;
  }
  if (!config.optimismRpcUrl) {
    config.optimismRpcUrl = await ask(`Enter Optimism RPC URL: (${DEFAULT_RPC_URL}) `);
  }
  if (!config.optimismRpcUrl) {
    config.optimismRpcUrl = DEFAULT_RPC_URL;
  }
}

async function getPolygonRpcUrl(config) {
  if (!config.polygonRpcUrl) {
    config.polygonRpcUrl = process.env.POLYGON_RPC_URL;
  }
  if (!config.polygonRpcUrl) {
    config.polygonRpcUrl = await ask(`Enter Polygon RPC URL: (${DEFAULT_RPC_URL}) `);
  }
  if (!config.polygonRpcUrl) {
    config.polygonRpcUrl = DEFAULT_RPC_URL;
  }
}

async function getEthereumProvider(config) {
  config.ethereumProvider = new JsonRpcProvider(config.ethereumRpcUrl);
}

async function getPolygonProvider(config) {
  config.polygonProvider = new JsonRpcProvider(config.polygonRpcUrl);
}

async function getOptimismProvider(config) {
  config.optimismProvider = new JsonRpcProvider(config.optimismRpcUrl);
}

async function getOptimismEtherscanApiKey(config) {
  if (!config.optimismEtherscanApiKey) {
    config.optimismEtherscanApiKey = process.env.OPTIMISM_ETHERSCAN_API_KEY;
  }
  if (!config.optimismEtherscanApiKey) {
    config.optimismEtherscanApiKey = await ask(
      `Enter Optimism Etherescan API KEY: (https://optimistic.etherscan.io/myaccount) `,
    );
  }
}

async function getEthereumEtherscanApiKey(config) {
  if (!config.ethereumEtherscanApiKey) {
    config.ethereumEtherscanApiKey = process.env.ETHERSCAN_API_KEY;
  }
  if (!config.ethereumEtherscanApiKey) {
    config.ethereumEtherscanApiKey = await ask(`Enter Ethereum Etherescan API KEY: (https://etherscan.io/myaccount) `);
  }
}

async function getPolygonscanApiKey(config) {
  if (!config.polygonscanApiKey) {
    config.polygonscanApiKey = process.env.POLYGONSCAN_API_KEY;
  }
  if (!config.polygonscanApiKey) {
    config.polygonscanApiKey = await ask(`Enter Polygonscan API KEY: (https://polygonscan.com/myaccount) `);
  }
}

async function getStateBridgeAddress(config) {
  if (!config.stateBridgeAddress) {
    config.stateBridgeAddress = process.env.STATE_BRIDGE_ADDRESS;
  }
  if (!config.stateBridgeAddress) {
    config.stateBridgeAddress = await ask("Enter State Bridge Address: ");
  }
}

async function getOptimismWorldIDAddress(config) {
  if (!config.optimismWorldIDAddress) {
    config.optimismWorldIDAddress = process.env.OPTIMISM_WORLD_ID_ADDRESS;
  }
  if (!config.optimismWorldIDAddress) {
    config.optimismWorldIDAddress = await ask("Enter Optimism World ID Address: ");
  }
}

async function getPolygonWorldIDAddress(config) {
  if (!config.polygonWorldIDAddress) {
    config.polygonWorldIDAddress = process.env.POLYGON_WORLD_ID_ADDRESS;
  }
  if (!config.polygonWorldIDAddress) {
    config.polygonWorldIDAddress = await ask("Enter Polygon World ID Address: ");
  }
}

async function getWorldIDIdentityManagerAddress(config) {
  if (!config.worldIDIdentityManagerAddress) {
    config.worldIDIdentityManagerAddress = process.env.WORLD_ID_IDENTITY_MANAGER_ADDRESS;
  }
  if (!config.worldIDIdentityManagerAddress) {
    config.worldIDIdentityManagerAddress = await ask("Enter World ID Identity Manager Address: ");
  }
}

async function loadConfiguration(useConfig) {
  if (!useConfig) {
    return {};
  }
  let answer = await ask(`Do you want to load configuration from prior runs? [Y/n]: `, "bool");
  const spinner = ora("Configuration Loading").start();
  if (answer === undefined) {
    answer = true;
  }
  if (answer) {
    if (!fs.existsSync(CONFIG_FILENAME)) {
      spinner.warn("Configuration load requested but no configuration available: continuing");
      return {};
    }
    try {
      const fileContents = JSON.parse(fs.readFileSync(CONFIG_FILENAME).toString());
      if (fileContents) {
        spinner.succeed("Configuration loaded");
        return fileContents;
      } else {
        spinner.warn("Unable to parse configuration: deleting and continuing");
        fs.rmSync(CONFIG_FILENAME);
        return {};
      }
    } catch {
      spinner.warn("Unable to parse configuration: deleting and continuing");
      fs.rmSync(CONFIG_FILENAME);
      return {};
    }
  } else {
    spinner.succeed("Configuration not loaded");
    return {};
  }
}

async function saveConfiguration(config) {
  const oldData = (() => {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILENAME).toString());
    } catch {
      return {};
    }
  })();

  const data = JSON.stringify({ ...oldData, ...config });
  fs.writeFileSync(CONFIG_FILENAME, data);
}

async function deployStateBridge(config) {
  const spinner = ora("Deploying State Bridge...").start();

  exec(
    `forge script script/deploy/DeployStateBridgeGoerli.s.sol --fork-url ${config.ETH_RPC_URL} \
  --etherscan-api-key ${config.ethereumEtherscanApiKey} --broadcast --verify -vvvv`,
    function (err, stdout, stderr) {
      if (err) console.error(stderr);
      console.log(stdout);
    },
  );

  spinner.succeed("DeployStateBridgeGoerli.s.sol ran successfully!");
}

async function deployPolygonWorldID(config) {
  const spinner = ora("Deploying PolygonWorldID...").start();

  exec(
    `forge script script/deploy/DeployPolygonWorldID.s.sol --fork-url ${config.POLYGON_RPC_URL} \
  --etherscan-api-key ${config.polygonscanApiKey} --broadcast --verify -vvvv`,
    function (err, stdout, stderr) {
      if (err) console.error(stderr);
      console.log(stdout);
    },
  );

  spinner.succeed("DeployPolygonWorldID.s.sol ran successfully!");
}

async function deployMockWorldID(config) {
  const spinner = ora("Deploying PolygonWorldID...").start();

  exec(
    `forge script script/deploy/DeployMockWorldID.s.sol --fork-url ${config.ETH_RPC_URL} \
  --etherscan-api-key ${config.ethereumEtherscanApiKey} --broadcast --verify -vvvv`,
    function (err, stdout, stderr) {
      if (err) console.error(stderr);
      console.log(stdout);
    },
  );

  spinner.succeed("DeployMockWorldID.s.sol ran successfully!");
}

async function deployOptimismWorldID(config) {
  const spinner = ora("Deploying OptimismWorldID...").start();

  exec(
    `forge script script/deploy/DeployOptimismWorldID.s.sol --fork-url ${config.OP_RPC_URL} \
  --etherscan-api-key ${config.polygonscanApiKey} --broadcast --verify -vvvv`,
    function (err, stdout, stderr) {
      if (err) console.error(stderr);
      console.log(stdout);
    },
  );

  spinner.succeed("DeployOptimismWorldID.s.sol ran successfully!");
}

async function initializeStateBridge(config) {}

async function buildTestnetDeploymentActionPlan(plan, config) {
  dotenv.config();

  await getPrivateKey(config);
  await getEthereumRpcUrl(config);
  await getOptimismRpcUrl(config);
  await getPolygonRpcUrl(config);
  await getEthereumProvider(config);
  await getOptimismProvider(config);
  await getPolygonProvider(config);
  await getEthereumWallet(config);
  await getOptimismWallet(config);
  await getPolygonWallet(config);
  await getEthereumEtherscanApiKey(config);
  await getOptimismEtherscanApiKey(config);
  await getPolygonscanApiKey(config);
  await saveConfiguration(config);
  await deployStateBridge(config);
  await deployPolygonWorldID(config);
  await deployOptimismWorldID(config);
  await getStateBridgeAddress(config);
  await getWorldIDIdentityManagerAddress(config);
  await getOptimismWorldIDAddress(config);
  await getPolygonWorldIDAddress(config);
  await saveConfiguration(config);
  await initializeStateBridge(config);
}

async function buildMockActionPlan(plan, config) {
  dotenv.config();

  await getPrivateKey(config);
  await getEthereumRpcUrl(config);
  await getOptimismRpcUrl(config);
  await getPolygonRpcUrl(config);
  await getEthereumProvider(config);
  await getOptimismProvider(config);
  await getPolygonProvider(config);
  await getEthereumWallet(config);
  await getOptimismWallet(config);
  await getPolygonWallet(config);
  await getEthereumEtherscanApiKey(config);
  await getOptimismEtherscanApiKey(config);
  await getPolygonscanApiKey(config);
  await saveConfiguration(config);
  await deployStateBridge(config);
  await deployPolygonWorldID(config);
  await deployOptimismWorldID(config);
  await getStateBridgeAddress(config);
  await getWorldIDIdentityManagerAddress(config);
  await getOptimismWorldIDAddress(config);
  await getPolygonWorldIDAddress(config);
  await saveConfiguration(config);
  await initializeStateBridge(config);
}

async function buildUpgradeActionPlan(plan, config) {
  dotenv.config();

  await getPrivateKey(config);
  await getPolygonRpcUrl(config);
  await getOptimismRpcUrl(config);
  await getEthereumRpcUrl(config);
  await getPolygonProvider(config);
  await getOptimismProvider(config);
  await getEthereumProvider(config);
  await getPolygonWallet(config);
  await getOptimismWallet(config);
  await getEthereumWallet(config);
}

/** Builds a plan using the provided function and then executes the plan.
 *
 * @param {(plan: Object, config: Object) => Promise<void>} planner The function that performs the
 *        planning process.
 * @param {Object} config The configuration object for the plan.
 * @returns {Promise<void>}
 */
async function buildAndRunPlan(planner, config) {
  let plan = newPlan();
  await planner(plan, config);

  for (const item of plan.items) {
    console.log(item.label);
    await item.action(config);
  }
}

async function main() {
  const program = new Command();

  program
    .name("deploy-testnet")
    .description("A CLI interface for deploying the WorldID state bridge on the Goerli testnet.")
    .option("--no-config", "Do not use any existing configuration.");

  program
    .command("deploy-testnet")
    .description("Interactively deploys the WorldID state bridge on the Goerli testnet.")
    .action(async () => {
      const options = program.opts();
      let config = await loadConfiguration(options.config);
      await buildAndRunPlan(buildTestnetDeploymentActionPlan, config);
      await saveConfiguration(config);
    });

  program
    .name("mock")
    .description("A CLI interface to mock the WorldID identity manager along with the WorldID state bridge.")
    .action(async () => {
      const options = program.opts();
      let config = await loadConfiguration(options.config);
      await buildAndRunPlan(buildMockActionPlan, config);
      await saveConfiguration(config);
    });

  // program
  //   .command("upgrade")
  //   .description("Interactively upgrades the deployed WorldID identity manager.")
  //   .action(async () => {
  //     const options = program.opts();
  //     let config = await loadConfiguration(options.config);
  //     await buildAndRunPlan(buildUpgradeActionPlan, config);
  //     await saveConfiguration(config);
  //   });

  // await program.parseAsync();
}

main().then(() => process.exit(0));