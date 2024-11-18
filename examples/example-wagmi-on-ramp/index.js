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
  zkSync,
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
    chains: [mainnet, polygon, optimism, polygonZkEvm, gnosis, avalanche, arbitrum, zkSync, base],
    connectors: [injected()],
    transports: {
      [mainnet.id]: http(),
      [polygon.id]: http(),
      [optimism.id]: http(),
      [polygonZkEvm.id]: http(),
      [gnosis.id]: http(),
      [avalanche.id]: http(),
      [arbitrum.id]: http(),
      [zkSync.id]: http(),
      [base.id]: http(),
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

// 2. Get SDK settings (feature is enabled)
getSettingsButton.addEventListener('click', async () => {
  getSettingsButton.setAttribute('hidden', '');
  parentElement.innerHTML = getSpinnerHTML();

  settings = await sdk.getServerSettings();

  if (!settings.external.isOnRampEnabled) {
    parentElement.innerHTML = getErrorMessageHTML(
      'On-ramp not available for sdk, please contact support',
    );
    getSettingsButton.removeAttribute('hidden');
    return;
  }

  //also loading token info. U can use other tokens
  selectedToken = await sdk.getTokenByAddressAndNetwork(
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    Network.ethereum,
  );

  setAmountButton.removeAttribute('hidden');
  parentElement.innerHTML = getTokenInfoHTML(
    selectedToken.name,
    selectedToken.address,
    sdk.getNetwork(selectedToken.network).displayedName,
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
    sdk.getNetwork(selectedToken.network).displayedName,
    amountInEUR.toString(),
  );
  submitButton.removeAttribute('hidden');
});

// 4. Submit sending of token to recipient's debit card (this could require more than one
//    wallet interaction, e.g. sign permit and then send a transaction
submitButton.addEventListener('click', async () => {
  submitButton.setAttribute('hidden', '');
  parentElement.innerHTML = getSpinnerHTML();

  const tokenNetworkId = sdk.getNetworkChainId(selectedToken.network);

  const walletClient = await getWalletClient(config, { chainId: tokenNetworkId });

  try {
    const requestResult = await sdk.onRamp.requestOnRamp(
      walletClient,
      walletClient.account.address,
      selectedToken.address,
      selectedToken.network,
      amountInEUR.toString(),
    );
    parentElement.innerHTML = `
    ${getMessageHTML(`Request id is: ${requestResult.requestUid}`)}
    <br>
    ${getSpinnerHTML()}`;

    const result = await sdk.onRamp.watchRequestId(requestResult.requestUid);
    if (result) {
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
