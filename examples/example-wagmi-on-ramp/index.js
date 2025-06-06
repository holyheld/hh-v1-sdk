import './index.css';

import { connect, createConfig, http, getWalletClient } from '@wagmi/core';
import {
  arbitrum,
  avalanche,
  base,
  gnosis,
  mainnet,
  optimism,
  polygon,
  polygonZkEvm,
  zksync,
  blast,
  mode,
  bsc,
  manta
} from '@wagmi/core/chains';
import { injected } from '@wagmi/connectors';
import HolyheldSDK, { HolyheldSDKError, HolyheldSDKErrorCode, Network } from '@holyheld/sdk';
import {
  getSpinnerHTML,
  getTokenInfoHTML,
  getDataHTML,
  getErrorMessageHTML,
  getMessageHTML,
} from './templates';

const parentElement = document.querySelector('section');
const connectButton = document.querySelector('#connect');
const initializeButton = document.querySelector('#initialize');
const getSettingsButton = document.querySelector('#get-settings');
const setAmountButton = document.querySelector('#set-amount');
const submitButton = document.querySelector('#request');

let config;
let sdk;
let settings;
let selectedToken;
let amountInEUR;

// 0. Connect wallet
connectButton.addEventListener('click', async () => {
  if (!window.ethereum) {
    alert('Enable injected provider, for example MetaMask.');
    return;
  }

  connectButton.setAttribute('hidden', '');
  parentElement.innerHTML = getSpinnerHTML();

  config = createConfig({
    chains: [mainnet, polygon, optimism, polygonZkEvm, gnosis, avalanche, arbitrum, zksync, base, blast, mode, bsc, manta],
    connectors: [injected()],
    transports: {
      [mainnet.id]: http(),
      [polygon.id]: http(),
      [optimism.id]: http(),
      [polygonZkEvm.id]: http(),
      [gnosis.id]: http(),
      [avalanche.id]: http(),
      [arbitrum.id]: http(),
      [zksync.id]: http(),
      [base.id]: http(),
      [blast.id]: http(),
      [mode.id]: http(),
      [bsc.id]: http(),
      [manta.id]: http(),
    },
  });

  await connect(config, { connector: injected() });

  initializeButton.removeAttribute('hidden');
  parentElement.innerHTML = '';
});

// 1. Initialize SDK
initializeButton.addEventListener('click', async () => {
  initializeButton.setAttribute('hidden', '');
  parentElement.innerHTML = getSpinnerHTML();

  // create .env with variable `VITE_HOLYHELD_SDK_API_KEY` or set it here
  const apiKey = import.meta.env.VITE_HOLYHELD_SDK_API_KEY;

  if (!apiKey) {
    alert('Set variable `VITE_HOLYHELD_SDK_API_KEY`.');
    return;
  }

  sdk = new HolyheldSDK({ apiKey, logger: true });
  await sdk.init();

  getSettingsButton.removeAttribute('hidden');
  parentElement.innerHTML = '';
});

// 2. Get SDK settings (check that the feature is enabled)
getSettingsButton.addEventListener('click', async () => {
  getSettingsButton.setAttribute('hidden', '');
  parentElement.innerHTML = getSpinnerHTML();

  settings = await sdk.getServerSettings();

  if (!settings.external.isOnRampEnabled) {
    parentElement.innerHTML = getErrorMessageHTML(
      'On-ramp is not available for SDK, please contact support',
    );
    getSettingsButton.removeAttribute('hidden');
    return;
  }

  // also loading token info. You can use other tokens
  selectedToken = await sdk.evm.getTokenByAddressAndNetwork(
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    Network.arbitrum,
  );

  setAmountButton.removeAttribute('hidden');
  parentElement.innerHTML = getTokenInfoHTML(
    selectedToken.name,
    selectedToken.address,
    sdk.evm.getNetwork(selectedToken.network).displayedName,
  );
});

// 3. Choose amount of token to be sent
setAmountButton.addEventListener('click', async () => {
  const input = parentElement.querySelector('input');
  amountInEUR = Number(input.value);

  if (!amountInEUR) {
    alert('Choose amount.');
    return;
  }

  setAmountButton.setAttribute('hidden', '');
  parentElement.innerHTML = getSpinnerHTML();

  parentElement.innerHTML = getDataHTML(
    selectedToken.name,
    selectedToken.address,
    sdk.evm.getNetwork(selectedToken.network).displayedName,
    amountInEUR.toString(),
  );
  submitButton.removeAttribute('hidden');
});

// 4. Submit sending of a token to the recipient's debit card
//    (this may require more than one wallet interaction, e.g.,
//    signing a permit and then sending a transaction)
submitButton.addEventListener('click', async () => {
  submitButton.setAttribute('hidden', '');
  parentElement.innerHTML = getSpinnerHTML();

  const tokenNetworkId = sdk.evm.getNetworkChainId(selectedToken.network);

  const walletClient = await getWalletClient(config, { chainId: tokenNetworkId });

  try {
    const requestResult = await sdk.evm.onRamp.requestOnRamp({
      walletAddress: walletClient.account.address,
      tokenAddress: selectedToken.address,
      tokenNetwork: selectedToken.network,
      EURAmount: amountInEUR.toString(),
    });
    parentElement.innerHTML = `
    ${getMessageHTML(`Request id is: ${requestResult.requestUid}`)}
    <br>
    ${getSpinnerHTML()}`;

    const result = await sdk.evm.onRamp.watchRequestId(requestResult.requestUid);
    if (result.success) {
      parentElement.innerHTML = getMessageHTML(`Request success`);
    } else {
      parentElement.innerHTML = getErrorMessageHTML(`Request rejected`);
    }
  } catch (error) {
    if (
      error instanceof HolyheldSDKError &&
      error.code === HolyheldSDKErrorCode.FailedWatchOnRampRequest
    ) {
      parentElement.innerHTML = getErrorMessageHTML(`Watch failed by: ${error}`);
      return;
    }
    if (
      error instanceof HolyheldSDKError &&
      error.code === HolyheldSDKErrorCode.FailedOnRampRequest
    ) {
      parentElement.innerHTML = getErrorMessageHTML(
        `Request failed by: ${error.payload.reason ?? 'unknown'}`,
      );
      return;
    }
    parentElement.innerHTML = getErrorMessageHTML(`Request or watch failed by: ${error}`);
  }
});
